import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService, AuthenticatedUser } from './auth.service';
import { SessionAuthGuard, CurrentUser, Roles, RolesGuard } from './auth.guard';
import { WebAuthnService } from './webauthn.service';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly webAuthnService: WebAuthnService
  ) {}

  /**
   * Phase 1: Real Google OAuth 2.0 PKCE Auth URL
   */
  @Get('google/url')
  async getGoogleAuthUrl() {
    return this.authService.generateGoogleAuthUrl();
  }

  /**
   * Phase 1: Real Google OAuth 2.0 Callback with strict domain and token verification
   */
  @Post('google/callback')
  @HttpCode(HttpStatus.OK)
  async handleGoogleCallback(
    @Body('code') code: string,
    @Body('state') state: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const { sessionToken, user } = await this.authService.handleGoogleCallback(code, state);

    // Set secure HttpOnly cookie
    res.cookie('rycoop_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'test',
      sameSite: 'strict',
      maxAge: 8 * 3600 * 1000, // 8 hours
      path: '/',
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
      },
    };
  }

  /**
   * Current Authenticated Session Profile
   */
  @Get('me')
  @UseGuards(SessionAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
      },
    };
  }

  /**
   * Secure Logout & Session Revocation
   */
  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionToken = req.cookies?.['rycoop_session'];
    if (sessionToken) {
      await this.authService.revokeSession(sessionToken);
    }

    res.clearCookie('rycoop_session', { path: '/' });
    return { success: true, message: 'Logged out successfully.' };
  }

  /**
   * Phase 2: WebAuthn Passkey Registration Options
   */
  @Get('webauthn/register-options')
  @UseGuards(SessionAuthGuard)
  async getWebAuthnRegisterOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.webAuthnService.generateRegistrationOptions(user);
  }

  /**
   * Phase 2: WebAuthn Passkey Registration Verification
   */
  @Post('webauthn/register-verify')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyWebAuthnRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() response: any
  ) {
    return this.webAuthnService.verifyRegistration(user.id, response);
  }

  /**
   * Phase 2: Transaction-Bound Step-Up Challenge Generation for Checkers
   */
  @Post('stepup/challenge')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('CHECKER')
  async createStepUpChallenge(
    @Body('referenceId') referenceId: string,
    @Body('amount') amount: number,
    @CurrentUser() checker: AuthenticatedUser
  ) {
    return this.authService.createStepUpChallenge(referenceId, amount, checker.id);
  }

  /**
   * Phase 2: Transaction-Bound Step-Up MFA Verification
   */
  @Post('stepup/verify')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('CHECKER')
  @HttpCode(HttpStatus.OK)
  async verifyStepUp(
    @Body('challengeId') challengeId: string,
    @Body('referenceId') referenceId: string,
    @Body('amount') amount: number,
    @Body('tokenOrAssertion') tokenOrAssertion: string,
    @Body('mfaType') mfaType: 'PASSKEY' | 'TOTP',
    @CurrentUser() checker: AuthenticatedUser
  ) {
    return this.authService.verifyStepUpAssertion(
      challengeId,
      referenceId,
      amount,
      checker.id,
      tokenOrAssertion,
      mfaType
    );
  }
}
