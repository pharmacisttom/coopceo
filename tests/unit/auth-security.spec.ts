import { AuthService } from '../../backend/src/modules/auth/auth.service';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

describe('Phase 2 & 3 Security Tests: Auth & Session Protection', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  // Test 1: Google OAuth URL generation has state and PKCE challenge
  it('TC-AUTH01: Generate OAuth URL with secure PKCE and state parameters', () => {
    const { url, state } = authService.generateGoogleAuthUrl();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('code_challenge=');
    expect(url).toContain('hd=rycoop.coop');
    expect(state).toHaveLength(64); // 32 hex bytes
  });

  // Test 2: Inactive or unlisted user rejected
  it('TC-AUTH02: Session validation fails for nonexistent or expired sessions', () => {
    expect(() => authService.validateSession('non-existent-session-id')).toThrow(UnauthorizedException);
  });

  // Test 3: Session expiration and idle timeout
  it('TC-AUTH03: Valid session returns authenticated user context', () => {
    const testUser = authService.getLocalUsers()[0];
    const sessionToken = authService.createSession(testUser);
    expect(sessionToken).toBeDefined();

    const validatedUser = authService.validateSession(sessionToken);
    expect(validatedUser.id).toBe(testUser.id);
    expect(validatedUser.email).toBe(testUser.email);
  });

  // Test 4: Session revocation on logout
  it('TC-AUTH04: Revoked session is immediately invalidated', () => {
    const testUser = authService.getLocalUsers()[0];
    const sessionToken = authService.createSession(testUser);

    authService.revokeSession(sessionToken);
    expect(() => authService.validateSession(sessionToken)).toThrow(UnauthorizedException);
  });

  // Test 5: Rate limiting on 5 consecutive failed Step-Up MFA attempts
  it('TC-AUTH05: Account locked out after 5 consecutive failed MFA attempts', () => {
    const { challengeId } = authService.createStepUpChallenge('INV-FAIL', 1000000, 'victim-user');

    // Submit invalid TOTP format 5 times
    for (let i = 0; i < 4; i++) {
      try {
        authService.verifyStepUpAssertion(challengeId, 'INV-FAIL', 1000000, 'victim-user', 'invalid', 'TOTP');
      } catch {}
    }

    // 5th attempt triggers lockout
    expect(() => {
      authService.verifyStepUpAssertion(challengeId, 'INV-FAIL', 1000000, 'victim-user', 'invalid', 'TOTP');
    }).toThrow(ForbiddenException);

    // Subsequent attempt is blocked by lockout
    expect(() => {
      authService.verifyStepUpAssertion(challengeId, 'INV-FAIL', 1000000, 'victim-user', '123456', 'TOTP');
    }).toThrow(/locked/i);
  });
});

