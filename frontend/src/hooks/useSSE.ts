import { useEffect, useRef, useState, useCallback } from 'react';
import alertService from '../components/alert/alert.service';

export type NotificationPriority = 'INFORMATION' | 'WARNING' | 'CRITICAL';
export type NotificationStatus = 'UNREAD' | 'READ' | 'ACKNOWLEDGED';
export type NotificationCategory = 'NEW_BANK_DATA' | 'BOND_MATURITY' | 'LOW_LIQUIDITY' | 'INVESTMENT_PENDING_APPROVAL' | 'SYSTEM';

export interface CoopNotification {
  id: string;
  eventId: string;
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
  enabled?: boolean;
  onNewNotification?: (notification: CoopNotification) => void;
  onAuthError?: () => void;
}

export function useSSE({
  url = '/api/v1/notifications/stream',
  enabled = true,
  onNewNotification,
  onAuthError,
}: UseSSEOptions = {}) {
  const [notifications, setNotifications] = useState<CoopNotification[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // LRU / Set for deduplication (tracks eventIds seen in last 10 minutes)
  const seenEventIds = useRef<Set<string>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 10;
  const isUnmountedRef = useRef<boolean>(false);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

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
        credentials: 'same-origin',
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
      const res = await fetch(`/api/v1/notifications/${id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      if (res.ok) {
        alertService.toast('บันทึกการรับทราบเรียบร้อยแล้ว', 'success', 'top-end', 2000);
      }
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
        credentials: 'same-origin',
      });
    } catch (err) {
      console.warn('Failed to sync markAllAsRead', err);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || isUnmountedRef.current) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Phase 4: Never append token to query string! Rely on HttpOnly session cookie
    const es = new EventSource(url, { withCredentials: true });
    eventSourceRef.current = es;

    es.onopen = () => {
      if (isUnmountedRef.current) return;
      setIsConnected(true);
      retryCountRef.current = 0;
    };

    es.addEventListener('notification', (event: MessageEvent) => {
      if (isUnmountedRef.current) return;
      try {
        const payload: CoopNotification = JSON.parse(event.data);

        // Deduplication Guard: Ignore if we have seen this eventId recently
        if (seenEventIds.current.has(payload.eventId)) {
          return;
        }

        seenEventIds.current.add(payload.eventId);
        if (seenEventIds.current.size > 1000) {
          const firstKey = seenEventIds.current.values().next().value;
          if (firstKey) seenEventIds.current.delete(firstKey);
        }

        // Bound in-memory state: keep at most 500 notifications
        setNotifications((prev) => [payload, ...prev].slice(0, 500));

        // Priority Toast
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
      if (isUnmountedRef.current) return;
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Stop reconnecting if max retries exceeded
      if (retryCountRef.current >= maxRetries) {
        console.warn('[SSE] Max connection retries reached. Stopping reconnection.');
        onAuthError?.();
        return;
      }

      // Exponential backoff with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 15000);
      const jitter = Math.random() * 500;
      const retryDelay = baseDelay + jitter;
      retryCountRef.current += 1;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectTimeoutRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          connect();
        }
      }, retryDelay);
    };
  }, [enabled, url, onNewNotification, onAuthError]);

  useEffect(() => {
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
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
