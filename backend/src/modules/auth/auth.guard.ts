import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService, AuthenticatedUser } from './auth.service';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // 1. Check HttpOnly cookie first (primary secure transport)
    let sessionToken = request.cookies?.['rycoop_session'];

    // 2. Fallback to Authorization: Bearer header for API integration tests
    if (!sessionToken && request.headers.authorization) {
      const parts = request.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        sessionToken = parts[1];
      }
    }

    if (!sessionToken) {
      throw new UnauthorizedException('Authentication required. Missing session cookie or bearer token.');
    }

    // 3. Validate session against AuthService
    const user = this.authService.validateSession(sessionToken);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Session is invalid or user account has been disabled.');
    }

    // Attach validated user context to request
    request.user = user;
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated.');
    }

    // Admin does NOT automatically inherit financial Maker or Checker authority (Principle of Least Privilege)
    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Requires one of the following roles: [${requiredRoles.join(', ')}]. Current role: ${user.role}`
      );
    }

    return true;
  }
}
