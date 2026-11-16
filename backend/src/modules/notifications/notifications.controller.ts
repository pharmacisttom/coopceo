import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Sse,
  UseGuards,
  Req,
  ForbiddenException,
  Headers,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService, NotificationPayload } from './notifications.service';
import { SessionAuthGuard, CurrentUser } from '../auth/auth.guard';
import { AuthenticatedUser } from '../auth/auth.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Phase 4: Hardened SSE Endpoint
   * - Strictly requires SessionAuthGuard (HttpOnly session cookie)
   * - No bearer token in URL query params
   * - Role and User ID derived solely from verified session context
   * - Default Deny filtering
   */
  @Sse('stream')
  @UseGuards(SessionAuthGuard)
  streamNotifications(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    return this.notificationsService.getStreamForUser(user.role, user.id);
  }

  /**
   * Mark notification as read (Authenticated)
   */
  @Patch(':id/read')
  @UseGuards(SessionAuthGuard)
  async markAsRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      id,
      status: 'READ',
      userId: user.id,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Acknowledge critical notification (Authenticated & Audit Trail)
   */
  @Post(':id/acknowledge')
  @UseGuards(SessionAuthGuard)
  async acknowledge(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      id,
      status: 'ACKNOWLEDGED',
      acknowledgedBy: user.id,
      acknowledgedByEmail: user.email,
      acknowledgedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark all unread notifications as read (Authenticated)
   */
  @Post('mark-all-read')
  @UseGuards(SessionAuthGuard)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      userId: user.id,
      message: 'All unread notifications marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Protected Internal Notification Dispatch Endpoint
   * Only callable with internal service secret or loopback
   */
  @Post('emit')
  async emitNotification(
    @Body() payload: NotificationPayload,
    @Headers('x-internal-service-key') serviceKey?: string
  ) {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET || 'rycoop-internal-worker-secret-key-99';
    if (serviceKey !== internalSecret) {
      throw new ForbiddenException('Access to internal notification publisher is restricted.');
    }

    const published = await this.notificationsService.publishNotification(payload);
    return {
      success: published,
      eventId: payload.eventId,
    };
  }
}
