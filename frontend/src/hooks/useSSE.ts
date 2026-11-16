import { useEffect, useRef, useState, useCallback } from 'react';
import alertService from '../components/alert/alert.service';

export type NotificationPriority = 'INFORMATION' | 'WARNING' | 'CRITICAL';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ACKNOWLEDGED';
export type NotificationCategory = 'NEW_BANK_DATA' | 'BOND_MATURITY' | 'LOW_LIQUIDITY' | 'INVESTMENT_PENDING_APPROVAL' | 'SYSTEM';

export interface CoopNotification {
  id: string; // UUID
  eventId: string; // Deduplication Key
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  status: NotificationStatus;
  createdAt: string;
  acknowledgedAt?: string | null;
  targetRole?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

interface UseSSEOptions {
  url?: string;
  authToken?: string;
  enabled?: boolean;
  onNewNotification?: (notification: CoopNotification) => void;
}

export function useSSE({
  url = '/api/v1/notifications/stream',
  authToken,
  enabled = true,
  onNewNotification,
}: UseSSEOptions = {}) {
  const [notifications, setNotifications] = useState<CoopNotification[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  
  // Deduplication cache: tracks eventIds seen in last 10 minutes to prevent duplicate alerts
  const seenEventIds = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);

  // Recalculate unread count
  useEffect(() => {
    const unread = notifications.filter((n) => n.status === 'UNREAD').length;
    setUnreadCount(unread);
  }, [notifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'READ' as const } : item))
    );
    try {
      await fetch(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.warn('Failed to sync markAsRead to backend', err);
    }
  }, []);

  const acknowledge = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'ACKNOWLEDGED' as const, acknowledgedAt: now } : item
      )
    );
    try {
      await fetch(`/api/v1/notifications/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      alertService.toast('บันทึกการรับทราบเรียบร้อยแล้ว', 'success', 'top-end', 2000);
    } catch (err) {
      console.error('Failed to sync acknowledge to backend', err);
      alertService.toast('ไม่สามารถบันทึกการรับทราบได้', 'error');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((item) => (item.status === 'UNREAD' ? { ...item, status: 'READ' as const } : item))
    );
    try {
      await fetch('/api/v1/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.warn('Failed to sync markAllAsRead', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined') return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = authToken ? `${url}?token=${encodeURIComponent(authToken)}` : url;
    const es = new EventSource(sseUrl, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
      console.log('[SSE] Notification stream connected.');
    };

    es.addEventListener('notification', (event: MessageEvent) => {
      try {
        const payload: CoopNotification = JSON.parse(event.data);

        // Deduplication Guard: Ignore if we have seen this eventId recently
        if (seenEventIds.current.has(payload.eventId)) {
          console.warn(`[SSE] Duplicate event detected and dropped: ${payload.eventId}`);
          return;
        }

        seenEventIds.current.add(payload.eventId);
        // Evict if cache exceeds 1,000 items
        if (seenEventIds.current.size > 1000) {
          const firstKey = seenEventIds.current.values().next().value;
          if (firstKey) seenEventIds.current.delete(firstKey);
        }

        // Prepend new notification
        setNotifications((prev) => [payload, ...prev]);

        // Trigger toast/alert based on Priority
        if (payload.priority === 'CRITICAL') {
          alertService.toast(`[สำคัญเร่งด่วน] ${payload.title}`, 'error', 'top-end', 6000);
        } else if (payload.priority === 'WARNING') {
          alertService.toast(`[เตือน] ${payload.title}`, 'warning', 'top-end', 4500);
        } else {
          alertService.toast(payload.title, 'info', 'bottom-end', 3000);
        }

        onNewNotification?.(payload);
      } catch (err) {
        console.error('[SSE] Failed to parse notification payload', err);
      }
    });

    es.addEventListener('heartbeat', () => {
      // Keep-alive heartbeat from NestJS server
    });

    es.onerror = (err) => {
      console.warn('[SSE] Connection error or server offline. Reconnecting...', err);
      setIsConnected(false);
      es.close();

      // Exponential backoff reconnect: 1s, 2s, 4s, 8s, max 15s
      const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
      retryCountRef.current += 1;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, retryDelay);
    };
  }, [enabled, url, authToken, onNewNotification]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    notifications,
    setNotifications,
    isConnected,
    unreadCount,
    markAsRead,
    acknowledge,
    markAllAsRead,
  };
}
