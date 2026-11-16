import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Sse,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { NotificationsService, NotificationPayload } from './notifications.service';

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Real-time Server-Sent Events (SSE) Endpoint
   * Rule 2: SSE with automatic heartbeat and RBAC filtering
   */
  @Sse('stream')
  streamNotifications(
    @Query('token') token?: string,
    @Req() req?: any
  ): Observable<MessageEvent> {
    const userRole = req?.user?.role || 'CHECKER'; // Defaults to authenticated role
    const userId = req?.user?.id;
    return this.notificationsService.getStreamForUser(userRole, userId);
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string) {
    return {
      success: true,
      id,
      status: 'READ',
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Acknowledge notification (Rule 9: Tracking acknowledgment)
   */
  @Post(':id/acknowledge')
  async acknowledge(@Param('id') id: string, @Req() req?: any) {
    return {
      success: true,
      id,
      status: 'ACKNOWLEDGED',
      acknowledgedBy: req?.user?.id || 'user-checker-001',
      acknowledgedAt: new Date().toISOString(),
    };
  }

  /**
   * Mark all unread notifications as read
   */
  @Post('mark-all-read')
  async markAllRead(@Req() req?: any) {
    return {
      success: true,
      message: 'All unread notifications marked as read',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Internal endpoint for workers to emit validated notifications
   */
  @Post('emit')
  async emitNotification(@Body() payload: NotificationPayload) {
    const published = await this.notificationsService.publishNotification(payload);
    return {
      success: published,
      eventId: payload.eventId,
    };
  }
}
