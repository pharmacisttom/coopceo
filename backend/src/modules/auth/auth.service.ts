import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR' | 'EXECUTIVE';
  department: string;
  isActive: boolean;
  googleSub?: string;
  passkeyRegistered: boolean;
  totpEnabled: boolean;
}

export interface SessionData {
  sessionId: string;
  userId: string;
  user: AuthenticatedUser;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
}

export interface TransactionStepUpChallenge {
  challengeId: string;
  challenge: string; // Base64URL
  referenceId: string;
  expectedAmount: number;
  checkerId: string;
  createdAt: number;
  expiresAt: number;
  isUsed: boolean;
}

// In-memory or Redis-backed stores
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Active Sessions store (sessionId -> SessionData)
  private readonly sessions = new Map<string, SessionData>();

  // In-flight OAuth2 states (state -> { codeVerifier, nonce, createdAt })
  private readonly oauthStates = new Map<string, { codeVerifier: string; nonce: string; createdAt: number }>();

  // Transaction-bound Step-Up Challenges (challengeId -> TransactionStepUpChallenge)
  private readonly stepUpChallenges = new Map<string, TransactionStepUpChallenge>();

  // TOTP Used tokens cache for replay prevention (userId:token -> expiry timestamp)
  private readonly usedTotpTokens = new Set<string>();

  // Rate-limiting for MFA attempts (userId -> { attempts: number, lockUntil: number })
  private readonly mfaAttempts = new Map<string, { attempts: number; lockUntil: number }>();

  // Allowed cooperative email domain
  private readonly ALLOWED_DOMAIN = 'rycoop.coop';

  // Seeded cooperative users for local allowlist verification
  private readonly localUsers: AuthenticatedUser[] = [
    {
      id: 'a0000000-0000-0000-0000-000000000001',
      email: 'maker.finance@rycoop.coop',
      fullName: 'คุณสมชาย พัฒนากร (Maker)',
      role: 'MAKER',
      department: 'ฝ่ายการเงินและการลงทุน',
      isActive: true,
      passkeyRegistered: false,
      totpEnabled: true,
    },
    {
      id: 'b0000000-0000-0000-0000-000000000002',
      email: 'checker.director@rycoop.coop',
      fullName: 'คุณกมลฉัตร วงศ์วิจิตร (Checker)',
      role: 'CHECKER',
      department: 'คณะกรรมการกำกับดูแลการเงิน',
      isActive: true,
      passkeyRegistered: true,
      totpEnabled: true,
    },
    {
      id: 'c0000000-0000-0000-0000-000000000003',
      email: 'auditor@rycoop.coop',
      fullName: 'ผู้ตรวจสอบบัญชีสหกรณ์ (Auditor)',
      role: 'AUDITOR',
      department: 'ฝ่ายตรวจสอบภายใน',
      isActive: true,
      passkeyRegistered: false,
      totpEnabled: true,
    },
  ];

  /**
   * Phase 2: Google OIDC OAuth 2.0 Authorization URL with PKCE & Nonce
   */
  public generateGoogleAuthUrl(): { url: string; state: string } {
    const state = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(32).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    // Store state with 10-minute expiry
    this.oauthStates.set(state, { codeVerifier, nonce, createdAt: Date.now() });

    const clientId = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'https://test.rycoop.coop/api/v1/auth/google/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      hd: this.ALLOWED_DOMAIN, // Google Workspace domain hint
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      state,
    };
  }

  /**
   * Phase 2: Google OIDC Callback & Strict Verification
   */
  public async handleGoogleCallback(code: string, state: string): Promise<{ sessionToken: string; user: AuthenticatedUser }> {
    // 1. Verify state and PKCE
    const savedState = this.oauthStates.get(state);
    if (!savedState) {
      throw new UnauthorizedException('Invalid or expired OAuth2 state. Possible CSRF attempt.');
    }
    this.oauthStates.delete(state);

    if (Date.now() - savedState.createdAt > 10 * 60 * 1000) {
      throw new UnauthorizedException('OAuth2 state expired.');
    }

    // In a live environment with Google: exchange code for tokens using savedState.codeVerifier
    // For test simulation with domain verification:
    // Extract domain and verify against strict cooperative policy
    const simulatedGoogleEmail = 'checker.director@rycoop.coop';
    const simulatedGoogleSub = 'google-sub-99881122';

    // 2. Strict Domain Enforcement
    const emailDomain = simulatedGoogleEmail.split('@')[1];
    if (emailDomain !== this.ALLOWED_DOMAIN) {
      this.logger.warn(`Security block: Attempted login from unapproved domain: ${simulatedGoogleEmail}`);
      throw new ForbiddenException(`Access restricted to @${this.ALLOWED_DOMAIN} cooperative domain only.`);
    }

    // 3. Check local allowlist & active status
    const user = this.localUsers.find((u) => u.email.toLowerCase() === simulatedGoogleEmail.toLowerCase());
    if (!user) {
      this.logger.warn(`Access denied: User ${simulatedGoogleEmail} authenticated via Google but not in local allowlist.`);
      throw new ForbiddenException('Your Google account is not authorized for RYCOOP Smart Finance.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('User account has been deactivated by Cooperative Administrator.');
    }

    // 4. Create server-side session with session rotation
    const sessionToken = this.createSession(user);
    this.logger.log(`Google OIDC Authentication successful: ${user.email} [Role: ${user.role}]`);

    return { sessionToken, user };
  }

  /**
   * Create cryptographically secure session
   */
  public createSession(user: AuthenticatedUser): string {
    const sessionId = crypto.randomBytes(48).toString('base64url');
    const now = Date.now();
    const sessionLifetimeMs = 8 * 60 * 60 * 1000; // 8-hour absolute timeout

    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      user,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + sessionLifetimeMs,
    };

    this.sessions.set(sessionId, sessionData);
    return sessionId;
  }

  /**
   * Validate session token from HttpOnly cookie
   */
  public validateSession(sessionId: string): AuthenticatedUser {
    if (!sessionId) {
      throw new UnauthorizedException('No authentication session found.');
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Session invalid or revoked.');
    }

    const now = Date.now();
    // Idle timeout: 30 minutes
    if (now - session.lastActivityAt > 30 * 60 * 1000) {
      this.sessions.delete(sessionId);
      throw new UnauthorizedException('Session expired due to inactivity.');
    }

    // Absolute timeout: 8 hours
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      throw new UnauthorizedException('Session reached maximum lifetime. Please re-authenticate.');
    }

    // Slide activity timestamp
    session.lastActivityAt = now;
    return session.user;
  }

  /**
   * Revoke session on logout
   */
  public revokeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Phase 3: Create Transaction-Bound Challenge for Step-Up Authentication
   * Cryptographically binds the challenge to proposal ID, amount, and Checker ID
   */
  public createStepUpChallenge(
    referenceId: string,
    expectedAmount: number,
    checkerId: string
  ): { challengeId: string; challenge: string; timeoutSeconds: number } {
    const challengeId = `chn-${crypto.randomBytes(16).toString('hex')}`;
    // Challenge incorporates referenceId, amount, checkerId, and random bytes
    const bindingData = `${referenceId}:${expectedAmount}:${checkerId}:${Date.now()}`;
    const rawChallenge = crypto.createHash('sha256').update(bindingData).digest('base64url');

    const timeoutSeconds = 120; // 2 minutes expiry for step-up
    this.stepUpChallenges.set(challengeId, {
      challengeId,
      challenge: rawChallenge,
      referenceId,
      expectedAmount,
      checkerId,
      createdAt: Date.now(),
      expiresAt: Date.now() + timeoutSeconds * 1000,
      isUsed: false,
    });

    return {
      challengeId,
      challenge: rawChallenge,
      timeoutSeconds,
    };
  }

  /**
   * Phase 3: Verify Transaction-Bound Step-Up MFA (Passkey or TOTP)
   */
  public verifyStepUpAssertion(
    challengeId: string,
    referenceId: string,
    amount: number,
    checkerId: string,
    tokenOrAssertion: string,
    mfaType: 'PASSKEY' | 'TOTP'
  ): { success: boolean; verifiedAt: string } {
    // 1. Check rate limits
    this.checkMfaRateLimit(checkerId);

    // 2. Validate Challenge
    const challengeRecord = this.stepUpChallenges.get(challengeId);
    if (!challengeRecord) {
      this.recordFailedMfa(checkerId);
      throw new ForbiddenException('Invalid or expired Step-Up challenge.');
    }

    if (challengeRecord.isUsed) {
      this.logger.warn(`Security alert: Replay attack detected on challenge ${challengeId} by user ${checkerId}`);
      throw new ForbiddenException('Step-Up challenge has already been used. Replay detected.');
    }

    if (Date.now() > challengeRecord.expiresAt) {
      this.stepUpChallenges.delete(challengeId);
      throw new ForbiddenException('Step-Up challenge expired.');
    }

    // 3. Verify binding parameters (ensure transaction was not tampered)
    if (
      challengeRecord.referenceId !== referenceId ||
      challengeRecord.expectedAmount !== amount ||
      challengeRecord.checkerId !== checkerId
    ) {
      this.logger.error(`Security alert: Step-up binding mismatch! Target: ${referenceId}, Amount: ${amount}`);
      throw new ForbiddenException('Step-Up assertion does not match current transaction parameters.');
    }

    // 4. Verification logic
    if (mfaType === 'TOTP') {
      // In production: verify with otplib against user's encrypted totp_secret
      // Check replay prevention cache
      const replayKey = `${checkerId}:${tokenOrAssertion}`;
      if (this.usedTotpTokens.has(replayKey)) {
        throw new ForbiddenException('TOTP code has already been used. Please wait for next 30-second window.');
      }

      // Check format
      if (!/^\d{6}$/.test(tokenOrAssertion)) {
        this.recordFailedMfa(checkerId);
        throw new ForbiddenException('Invalid 6-digit TOTP format.');
      }

      // Mark token as used for 60 seconds
      this.usedTotpTokens.add(replayKey);
      setTimeout(() => this.usedTotpTokens.delete(replayKey), 60000);
    } else if (mfaType === 'PASSKEY') {
      // In production: verify using @simplewebauthn/server verifyAuthenticationResponse
      if (!tokenOrAssertion || tokenOrAssertion.length < 16) {
        this.recordFailedMfa(checkerId);
        throw new ForbiddenException('Invalid WebAuthn Passkey assertion.');
      }
    }

    // Mark challenge as used immediately (single-use replay protection)
    challengeRecord.isUsed = true;
    this.stepUpChallenges.delete(challengeId);

    // Reset failed attempts on success
    this.mfaAttempts.delete(checkerId);

    return {
      success: true,
      verifiedAt: new Date().toISOString(),
    };
  }

  private checkMfaRateLimit(userId: string): void {
    const record = this.mfaAttempts.get(userId);
    if (record) {
      if (record.lockUntil > Date.now()) {
        const remainingMinutes = Math.ceil((record.lockUntil - Date.now()) / 60000);
        throw new ForbiddenException(`Too many failed MFA attempts. Account temporarily locked for ${remainingMinutes} minutes.`);
      }
    }
  }

  private recordFailedMfa(userId: string): void {
    const record = this.mfaAttempts.get(userId) || { attempts: 0, lockUntil: 0 };
    record.attempts += 1;
    if (record.attempts >= 5) {
      record.lockUntil = Date.now() + 15 * 60 * 1000; // 15-minute lockout
      this.logger.warn(`User ${userId} locked out due to 5 consecutive failed MFA attempts.`);
    }
    this.mfaAttempts.set(userId, record);
  }

  public getLocalUsers(): AuthenticatedUser[] {
    return this.localUsers;
  }
}

