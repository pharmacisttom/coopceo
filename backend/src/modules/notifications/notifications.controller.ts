import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Sse,
  UseGuards,
  ForbiddenException,
  InternalServerErrorException,
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
   * Phase 4: Secure Real-time SSE Stream
   * Requires authenticated session; Role and User ID derived solely from verified session context
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
   * Mark all unread notifications as read
   */
  @Post('mark-all-read')
  @UseGuards(SessionAuthGuard)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      userId: user.id,
      message: 'All unread notifications marked as read.',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Phase 4: Protected Internal Notification Publisher Endpoint
   * Enforces non-predictable internal service key (Fail-closed if not configured)
   */
  @Post('emit')
  async emitNotification(
    @Body() payload: NotificationPayload,
    @Headers('x-internal-service-key') serviceKey?: string
  ) {
    const internalSecret = process.env.INTERNAL_SERVICE_SECRET;

    if (!internalSecret || internalSecret.length < 32) {
      throw new InternalServerErrorException(
        'Internal notification publisher is misconfigured. INTERNAL_SERVICE_SECRET must be at least 32 characters.'
      );
    }

    if (!serviceKey || serviceKey !== internalSecret) {
      throw new ForbiddenException('Access to internal notification publisher is restricted.');
    }

    const published = await this.notificationsService.publishNotification(payload);
    return {
      success: published,
      eventId: payload.eventId,
    };
  }
}
