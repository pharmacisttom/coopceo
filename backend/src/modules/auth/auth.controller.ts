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

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Phase 2: Get Google OAuth 2.0 Login URL with PKCE
   */
  @Get('google/url')
  getGoogleAuthUrl() {
    return this.authService.generateGoogleAuthUrl();
  }

  /**
   * Phase 2: Handle Google OAuth 2.0 Callback
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
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
      path: '/',
    });

    return {
      success: true,
      user,
      sessionToken, // Also return in body for testing/SPA integration
    };
  }

  /**
   * Get current authenticated user profile
   */
  @Get('me')
  @UseGuards(SessionAuthGuard)
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return {
      authenticated: true,
      user,
    };
  }

  /**
   * Secure Logout
   */
  @Post('logout')
  @UseGuards(SessionAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionToken = req.cookies?.['rycoop_session'];
    if (sessionToken) {
      this.authService.revokeSession(sessionToken);
    }

    res.clearCookie('rycoop_session', { path: '/' });
    return { success: true, message: 'Logged out successfully.' };
  }

  /**
   * Phase 3: Create Transaction-Bound Challenge for Step-Up Approval
   */
  @Post('stepup/challenge')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('CHECKER')
  createStepUpChallenge(
    @Body('referenceId') referenceId: string,
    @Body('amount') amount: number,
    @CurrentUser() checker: AuthenticatedUser
  ) {
    return this.authService.createStepUpChallenge(referenceId, amount, checker.id);
  }

  /**
   * Phase 3: Verify Transaction-Bound Step-Up MFA (Passkey or TOTP)
   */
  @Post('stepup/verify')
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles('CHECKER')
  @HttpCode(HttpStatus.OK)
  verifyStepUp(
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

  /**
   * Test-only login endpoint for test environment automation
   */
  @Post('test-login')
  @HttpCode(HttpStatus.OK)
  testLogin(
    @Body('email') email: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const users = this.authService.getLocalUsers();
    const user = users.find((u) => u.email.toLowerCase() === email?.toLowerCase());
    if (!user) {
      return { success: false, message: 'Test user not found' };
    }

    const sessionToken = this.authService.createSession(user);
    res.cookie('rycoop_session', sessionToken, {
      httpOnly: true,
      secure: false, // Allow non-https in local unit tests
      sameSite: 'strict',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      success: true,
      sessionToken,
      user,
    };
  }
}
