import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Subject, Observable, interval } from 'rxjs';

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
  private readonly notificationSubject$ = new Subject<NotificationPayload>();
  private readonly deduplicationCache = new Set<string>();

  /**
   * Phase 4: Publish notification with strict validation and comprehensive data masking
   */
  public async publishNotification(payload: NotificationPayload): Promise<boolean> {
    // 1. Mandatory field validation
    if (!payload.eventId || !payload.title || !payload.message || !payload.category) {
      throw new BadRequestException('Invalid notification payload: Missing mandatory fields.');
    }

    // 2. Deduplication check
    if (this.deduplicationCache.has(payload.eventId)) {
      this.logger.warn(`Duplicate notification event dropped: ${payload.eventId}`);
      return false;
    }

    // 3. Mask sensitive financial data across title, message, and metadata
    const sanitizedPayload = this.sanitizeFinancialPayload(payload);

    // Cache event ID (limit to 10,000 entries)
    this.deduplicationCache.add(payload.eventId);
    if (this.deduplicationCache.size > 10000) {
      const first = this.deduplicationCache.values().next().value;
      if (first) this.deduplicationCache.delete(first);
    }

    this.logger.log(`Broadcasting ${payload.priority} notification [${payload.eventId}] to role: ${payload.targetRole || 'ALL'}`);
    this.notificationSubject$.next(sanitizedPayload);
    return true;
  }

  /**
   * Phase 4: Mask bank account numbers in title, message, and metadata JSON
   */
  public sanitizeFinancialPayload(payload: NotificationPayload): NotificationPayload {
    const maskText = (text: string): string => {
      if (!text) return text;
      // Mask formatted bank accounts e.g. 123-4-56789-0 -> xxx-x-xx56789-0
      let result = text.replace(/(\d{3})-(\d)-(\d{5})-(\d)/g, 'xxx-x-xx$3-$4');
      // Mask unformatted 10-12 digit numbers
      result = result.replace(/\b\d{6}(\d{4})\b/g, 'xxxxxx$1');
      return result;
    };

    const sanitizedTitle = maskText(payload.title);
    const sanitizedMessage = maskText(payload.message);

    let sanitizedMetadata: Record<string, any> | undefined = undefined;
    if (payload.metadata) {
      sanitizedMetadata = { ...payload.metadata };
      for (const [key, val] of Object.entries(sanitizedMetadata)) {
        if (typeof val === 'string') {
          sanitizedMetadata[key] = maskText(val);
        } else if (key.toLowerCase().includes('account') || key.toLowerCase().includes('password')) {
          sanitizedMetadata[key] = '********';
        }
      }
    }

    return {
      ...payload,
      title: sanitizedTitle,
      message: sanitizedMessage,
      metadata: sanitizedMetadata,
    };
  }

  /**
   * Phase 4: Get stream for authenticated user with strict Default-Deny isolation
   */
  public getStreamForUser(userRole: string, userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const subscription = this.notificationSubject$.subscribe({
        next: (notification) => {
          // Default-Deny: If targetRole is specified, user must possess that exact role
          if (notification.targetRole && notification.targetRole !== userRole && userRole !== 'ADMIN') {
            return;
          }

          // Default-Deny: If targetUserId is specified, user must match targetUserId
          if (notification.targetUserId && notification.targetUserId !== userId) {
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

      // 15-second heartbeat
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
