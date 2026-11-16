import { NotificationsService, NotificationPayload } from '../../backend/src/modules/notifications/notifications.service';

describe('NotificationsService Unit Tests (Deduplication & Sanitization)', () => {
  let service: NotificationsService;

  beforeEach(() => {
    service = new NotificationsService();
  });

  // Rule 2 Notification: Event Deduplication
  it('should accept unique event and drop duplicate event IDs', async () => {
    const payload: NotificationPayload = {
      id: 'notif-1',
      eventId: 'evt-dup-test-001',
      category: 'NEW_BANK_DATA',
      priority: 'INFORMATION',
      status: 'UNREAD',
      title: 'ข้อมูลธนาคารใหม่',
      message: 'อัตราดอกเบี้ยเงินฝากปรับขึ้น',
      createdAt: new Date().toISOString(),
    };

    const firstPublish = await service.publishNotification(payload);
    expect(firstPublish).toBe(true);

    // Second publish with same eventId must be rejected
    const secondPublish = await service.publishNotification(payload);
    expect(secondPublish).toBe(false);
  });

  // Rule 8 Notification: Sensitive Financial Data Masking
  it('should mask sensitive bank account numbers in notification messages', async () => {
    const rawPayload: NotificationPayload = {
      id: 'notif-2',
      eventId: 'evt-mask-test-002',
      category: 'INVESTMENT_PENDING_APPROVAL',
      priority: 'CRITICAL',
      status: 'UNREAD',
      title: 'โอนเงินเข้าบัญชี',
      message: 'โอนเงินไปยังบัญชี 123-4-56789-0 เรียบร้อยแล้ว',
      createdAt: new Date().toISOString(),
    };

    // Spy on getStream or subject emission
    const stream = service.getStreamForUser('CHECKER');
    let emittedMessage = '';

    const sub = stream.subscribe((event: any) => {
      if (event.type === 'notification') {
        const parsed = JSON.parse(event.data);
        emittedMessage = parsed.message;
      }
    });

    await service.publishNotification(rawPayload);
    sub.unsubscribe();

    expect(emittedMessage).toContain('xxx-x-xx56789-0');
    expect(emittedMessage).not.toContain('123-4-56789-0');
  });

  // Rule 9 Notification: Mandatory validation
  it('should throw error when missing required payload fields', async () => {
    const invalidPayload = {
      eventId: 'evt-inv-001',
    } as any;

    await expect(service.publishNotification(invalidPayload)).rejects.toThrow(
      'Invalid notification payload'
    );
  });
});

