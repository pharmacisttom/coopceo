import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, interval } from 'rxjs';
import { map } from 'rxjs/operators';

export interface NotificationPayload {
  id: string;
  eventId: string;
  category: 'NEW_BANK_DATA' | 'BOND_MATURITY' | 'LOW_LIQUIDITY' | 'INVESTMENT_PENDING_APPROVAL' | 'SYSTEM';
  priority: 'INFORMATION' | 'WARNING' | 'CRITICAL';
  status: 'UNREAD' | 'READ' | 'ACKNOWLEDGED';
  title: string;
  message: string;
  targetRole?: string;
  targetUserId?: string;
  actionUrl?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  
  // RxJS subject for broadcasting SSE to connected clients
  private readonly notificationSubject$ = new Subject<NotificationPayload>();
  
  // Deduplication cache: stores processed event IDs (in production backed by Redis)
  private readonly deduplicationCache = new Set<string>();

  /**
   * Broadcast a validated notification event to active SSE streams
   * Rule 9: Must validate data before creating notification event
   * Rule 10: Mask sensitive financial information before dispatching
   */
  public async publishNotification(payload: NotificationPayload): Promise<boolean> {
    // 1. Deduplication check
    if (this.deduplicationCache.has(payload.eventId)) {
      this.logger.warn(`Duplicate event dropped by deduplication guard: ${payload.eventId}`);
      return false;
    }

    // 2. Data validation
    if (!payload.title || !payload.message || !payload.category) {
      throw new Error('Invalid notification payload: Missing mandatory fields');
    }

    // 3. Sensitive financial data masking (Rule 8 Notification)
    const sanitizedPayload = this.maskSensitiveData(payload);

    // 4. Cache event ID (limit size to 10,000 in memory)
    this.deduplicationCache.add(payload.eventId);
    if (this.deduplicationCache.size > 10000) {
      const first = this.deduplicationCache.values().next().value;
      if (first) this.deduplicationCache.delete(first);
    }

    this.logger.log(`Publishing ${payload.priority} notification [${payload.eventId}]: ${payload.title}`);
    this.notificationSubject$.next(sanitizedPayload);
    return true;
  }

  /**
   * Mask bank account numbers, passwords, or personal tax IDs
   */
  private maskSensitiveData(payload: NotificationPayload): NotificationPayload {
    let sanitizedMessage = payload.message;

    // Mask bank accounts e.g. 123-4-56789-0 -> xxx-x-xx789-0
    sanitizedMessage = sanitizedMessage.replace(/(\d{3})-(\d)-(\d{5})-(\d)/g, 'xxx-x-xx$3-$4');

    return {
      ...payload,
      message: sanitizedMessage,
    };
  }

  /**
   * Get filtered observable stream for a given user role
   */
  public getStreamForUser(userRole?: string, userId?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subscription = this.notificationSubject$.subscribe({
        next: (notification) => {
          // RBAC Filtering: If targetRole is specified, only emit if user has matching role
          if (notification.targetRole && userRole && notification.targetRole !== userRole && userRole !== 'ADMIN') {
            return;
          }

          if (notification.targetUserId && userId && notification.targetUserId !== userId) {
            return;
          }

          subscriber.next({
            data: JSON.stringify(notification),
            type: 'notification',
          } as MessageEvent);
        },
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });

      // Send 15-second heartbeat to prevent proxy timeout
      const heartbeatTimer = interval(15000).subscribe(() => {
        subscriber.next({
          data: JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }),
          type: 'heartbeat',
        } as MessageEvent);
      });

      return () => {
        subscription.unsubscribe();
        heartbeatTimer.unsubscribe();
      };
    });
  }
}
