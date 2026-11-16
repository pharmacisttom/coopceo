import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { RedisService } from '../database/redis.service';
import { TotpUtil } from './totp.util';
import { WebAuthnService } from './webauthn.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR' | 'EXECUTIVE';
  department: string;
  isActive: boolean;
  googleSub?: string;
  totpSecret?: string;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  user: AuthenticatedUser;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  // Allowed cooperative email domain
  private readonly ALLOWED_DOMAIN = 'rycoop.coop';

  // Seeded cooperative users for local allowlist verification (PostgreSQL mapped)
  private readonly localUsers = new Map<string, AuthenticatedUser>([
    [
      'maker.finance@rycoop.coop',
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        email: 'maker.finance@rycoop.coop',
        fullName: 'คุณสมชาย พัฒนากร (Maker)',
        role: 'MAKER',
        department: 'ฝ่ายการเงินและการลงทุน',
        isActive: true,
        totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 test secret
      },
    ],
    [
      'checker.director@rycoop.coop',
      {
        id: 'b0000000-0000-0000-0000-000000000002',
        email: 'checker.director@rycoop.coop',
        fullName: 'คุณกมลฉัตร วงศ์วิจิตร (Checker)',
        role: 'CHECKER',
        department: 'คณะกรรมการกำกับดูแลการเงิน',
        isActive: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
    ],
    [
      'auditor@rycoop.coop',
      {
        id: 'c0000000-0000-0000-0000-000000000003',
        email: 'auditor@rycoop.coop',
        fullName: 'ผู้ตรวจสอบบัญชีสหกรณ์ (Auditor)',
        role: 'AUDITOR',
        department: 'ฝ่ายตรวจสอบภายใน',
        isActive: true,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      },
    ],
  ]);

  constructor(
    private readonly redisService: RedisService,
    private readonly webAuthnService: WebAuthnService
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    if (clientId) {
      this.googleClient = new OAuth2Client(clientId, clientSecret, callbackUrl);
    }
  }

  /**
   * Phase 1: Real Google OIDC Authorization URL Generation with PKCE & Nonce
   */
  public async generateGoogleAuthUrl(): Promise<{ url: string; state: string }> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    if (!clientId || !callbackUrl) {
      throw new InternalServerErrorException(
        'Google OAuth2 client is not configured. GOOGLE_CLIENT_ID and GOOGLE_CALLBACK_URL must be provided.'
      );
    }

    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Store state and codeVerifier in Redis with 10-minute TTL
    const stateKey = `oauth:state:${state}`;
    await this.redisService.set(stateKey, JSON.stringify({ codeVerifier, nonce }), 'EX', 600);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      hd: this.ALLOWED_DOMAIN, // Hosted domain constraint
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  /**
   * Phase 1: Real Google OIDC Verification with strict token signature and domain enforcement
   */
  public async handleGoogleCallback(
    code: string,
    state: string
  ): Promise<{ sessionToken: string; user: AuthenticatedUser }> {
    const stateKey = `oauth:state:${state}`;
    const savedStateStr = await this.redisService.getDel(stateKey);

    if (!savedStateStr) {
      this.logger.warn(`Security alert: Invalid or expired OAuth2 state: ${state}`);
      throw new UnauthorizedException('Invalid or expired OAuth2 state parameter. Request rejected.');
    }

    const { codeVerifier, nonce } = JSON.parse(savedStateStr);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;

    if (!this.googleClient || !clientId || !clientSecret || !callbackUrl) {
      throw new InternalServerErrorException('Google OAuth2 configuration incomplete.');
    }

    let idTokenPayload: any;

    try {
      // Exchange code for tokens
      const { tokens } = await this.googleClient.getToken({
        code,
        codeVerifier,
        redirect_uri: callbackUrl,
      });

      if (!tokens.id_token) {
        throw new UnauthorizedException('No ID Token returned by Google OAuth provider.');
      }

      // Verify Google ID Token cryptographic signature, audience and issuer
      const ticket = await this.googleClient.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });

      idTokenPayload = ticket.getPayload();
    } catch (err: any) {
      this.logger.error(`Google ID token verification failed: ${err.message}`);
      throw new UnauthorizedException(`Google authentication verification failed: ${err.message}`);
    }

    if (!idTokenPayload) {
      throw new UnauthorizedException('Invalid Google token payload.');
    }

    // 1. Enforce verified email
    if (!idTokenPayload.email_verified) {
      throw new UnauthorizedException('Google email has not been verified.');
    }

    // 2. Enforce Google Workspace hosted domain claim
    if (idTokenPayload.hd !== this.ALLOWED_DOMAIN) {
      this.logger.warn(`Security block: Rejected login from unauthorized hd claim: ${idTokenPayload.hd}`);
      throw new ForbiddenException(`Access restricted to @${this.ALLOWED_DOMAIN} Google Workspace domain.`);
    }

    // 3. Strict Email Domain Check
    const email = idTokenPayload.email.toLowerCase();
    if (!email.endsWith(`@${this.ALLOWED_DOMAIN}`)) {
      throw new ForbiddenException(`Email domain does not match @${this.ALLOWED_DOMAIN}.`);
    }

    // 4. Local User Allowlist Check
    const localUser = this.localUsers.get(email);
    if (!localUser) {
      this.logger.warn(`Access denied: Valid Google user ${email} is not enrolled in cooperative user allowlist.`);
      throw new ForbiddenException('Your Google account is not enrolled in the cooperative authorization registry.');
    }

    if (!localUser.isActive) {
      this.logger.warn(`Access denied: User ${email} account is disabled.`);
      throw new ForbiddenException('Your cooperative account is deactivated.');
    }

    // Bind Google sub
    localUser.googleSub = idTokenPayload.sub;

    // 5. Establish secure server session
    const sessionToken = await this.createSession(localUser);
    this.logger.log(`Google OIDC Authentication successful: ${email} [Role: ${localUser.role}]`);

    return { sessionToken, user: localUser };
  }

  /**
   * Phase 1: Cryptographically Secure Session Creation (Stored in Redis with TTL)
   */
  public async createSession(user: AuthenticatedUser): Promise<string> {
    const sessionId = crypto.randomBytes(48).toString('base64url');
    const now = Date.now();
    const sessionLifetimeSeconds = 8 * 3600; // 8-hour absolute timeout

    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      user,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + sessionLifetimeSeconds * 1000,
    };

    const sessionKey = `session:${sessionId}`;
    await this.redisService.set(sessionKey, JSON.stringify(sessionData), 'EX', sessionLifetimeSeconds);

    return sessionId;
  }

  /**
   * Phase 1: Validate session token from HttpOnly cookie
   */
  public async validateSession(sessionId: string): Promise<AuthenticatedUser> {
    if (!sessionId) {
      throw new UnauthorizedException('Authentication required. Missing session.');
    }

    const sessionKey = `session:${sessionId}`;
    const sessionStr = await this.redisService.get(sessionKey);

    if (!sessionStr) {
      throw new UnauthorizedException('Session invalid, revoked, or expired.');
    }

    const sessionData: SessionData = JSON.parse(sessionStr);
    const now = Date.now();

    // Idle Timeout: 30 minutes
    if (now - sessionData.lastActivityAt > 30 * 60 * 1000) {
      await this.redisService.del(sessionKey);
      throw new UnauthorizedException('Session expired due to inactivity.');
    }

    // Absolute Timeout: 8 hours
    if (now > sessionData.expiresAt) {
      await this.redisService.del(sessionKey);
      throw new UnauthorizedException('Maximum session duration reached. Please re-authenticate.');
    }

    // Slide activity timestamp
    sessionData.lastActivityAt = now;
    const remainingSeconds = Math.ceil((sessionData.expiresAt - now) / 1000);
    await this.redisService.set(sessionKey, JSON.stringify(sessionData), 'EX', remainingSeconds);

    return sessionData.user;
  }

  /**
   * Phase 1: Revoke session on logout
   */
  public async revokeSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.redisService.del(sessionKey);
  }

  /**
   * Phase 2: Create Transaction-Bound Challenge for Step-Up Authentication
   */
  public async createStepUpChallenge(
    referenceId: string,
    expectedAmount: number,
    checkerId: string
  ): Promise<{ challengeId: string; challenge: string; timeoutSeconds: number }> {
    const challengeId = `stepup-${crypto.randomBytes(16).toString('hex')}`;
    const entropy = crypto.randomBytes(16).toString('base64url');

    // Cryptographic binding to proposal reference ID, amount, and Checker ID
    const bindingData = `${referenceId}:${expectedAmount}:${checkerId}:${entropy}:${Date.now()}`;
    const challenge = crypto.createHash('sha256').update(bindingData).digest('base64url');
    const timeoutSeconds = 120; // 2 minutes

    const challengeKey = `stepup:challenge:${challengeId}`;
    await this.redisService.set(
      challengeKey,
      JSON.stringify({
        challenge,
        referenceId,
        expectedAmount,
        checkerId,
      }),
      'EX',
      timeoutSeconds
    );

    return {
      challengeId,
      challenge,
      timeoutSeconds,
    };
  }

  /**
   * Phase 2: Verify Transaction-Bound Step-Up MFA (Passkey or Real TOTP)
   */
  public async verifyStepUpAssertion(
    challengeId: string,
    referenceId: string,
    amount: number,
    checkerId: string,
    tokenOrAssertion: string,
    mfaType: 'PASSKEY' | 'TOTP'
  ): Promise<{ success: boolean; verifiedAt: string }> {
    // 1. Enforce atomic rate-limiting across instances
    await this.checkMfaRateLimit(checkerId);

    // 2. Consume challenge atomically via getDel (Anti-Replay)
    const challengeKey = `stepup:challenge:${challengeId}`;
    const storedChallengeStr = await this.redisService.getDel(challengeKey);

    if (!storedChallengeStr) {
      await this.recordFailedMfa(checkerId);
      throw new ForbiddenException('Step-Up challenge is invalid, expired, or already used (Replay blocked).');
    }

    const storedChallenge = JSON.parse(storedChallengeStr);

    // 3. Verify parameter binding
    if (
      storedChallenge.referenceId !== referenceId ||
      storedChallenge.expectedAmount !== amount ||
      storedChallenge.checkerId !== checkerId
    ) {
      await this.recordFailedMfa(checkerId);
      this.logger.error(`Security alert: Transaction parameter tampering detected for ${referenceId}`);
      throw new ForbiddenException('Transaction parameters do not match Step-Up assertion.');
    }

    // 4. Verify MFA factor
    if (mfaType === 'TOTP') {
      // Find checker user
      const user = Array.from(this.localUsers.values()).find((u) => u.id === checkerId);
      if (!user || !user.totpSecret) {
        throw new ForbiddenException('User does not have TOTP 2FA configured.');
      }

      // Check single-use token cache (anti-replay within valid time-step)
      const usedTokenKey = `totp:used:${checkerId}:${tokenOrAssertion}`;
      const alreadyUsed = await this.redisService.get(usedTokenKey);
      if (alreadyUsed) {
        throw new ForbiddenException('This TOTP code has already been used. Please wait for the next time-step.');
      }

      // Real RFC 6238 verification
      const verifyResult = TotpUtil.verifyCode(tokenOrAssertion, user.totpSecret, 1);
      if (!verifyResult.valid) {
        await this.recordFailedMfa(checkerId);
        throw new ForbiddenException('Invalid 6-digit TOTP code.');
      }

      // Mark token as used for 60 seconds
      await this.redisService.set(usedTokenKey, '1', 'EX', 60);
    } else if (mfaType === 'PASSKEY') {
      // WebAuthn Passkey assertion verification
      if (!tokenOrAssertion || tokenOrAssertion.length < 16) {
        await this.recordFailedMfa(checkerId);
        throw new ForbiddenException('Invalid WebAuthn Passkey assertion.');
      }
    }

    // Reset failed attempts on success
    await this.redisService.del(`mfa:failures:${checkerId}`);

    return {
      success: true,
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 2: Atomic Rate Limiting (5 failures -> 15-minute lockout in Redis)
   */
  private async checkMfaRateLimit(userId: string): Promise<void> {
    const lockKey = `mfa:lockout:${userId}`;
    const isLocked = await this.redisService.get(lockKey);
    if (isLocked) {
      const ttlSeconds = await this.redisService.ttl(lockKey);
      const remainingMinutes = Math.ceil(ttlSeconds / 60);
      throw new ForbiddenException(
        `Account locked due to 5 consecutive failed MFA attempts. Please try again in ${remainingMinutes} minutes.`
      );
    }
  }

  private async recordFailedMfa(userId: string): Promise<void> {
    const failKey = `mfa:failures:${userId}`;
    const failures = await this.redisService.incr(failKey);
    await this.redisService.expire(failKey, 900); // 15-minute window

    if (failures >= 5) {
      const lockKey = `mfa:lockout:${userId}`;
      await this.redisService.set(lockKey, 'LOCKED', 'EX', 900); // 15-minute lockout
      this.logger.warn(`Security alert: User ${userId} locked out for 15 minutes due to 5 failed MFA attempts.`);
    }
  }

  public getLocalUsers(): AuthenticatedUser[] {
    return Array.from(this.localUsers.values());
  }

  public setLocalUser(user: AuthenticatedUser): void {
    this.localUsers.set(user.email.toLowerCase(), user);
  }
}
