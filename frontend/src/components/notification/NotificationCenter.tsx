'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCheck, ShieldAlert, AlertTriangle, Info, Landmark, TrendingDown, Clock, ExternalLink } from 'lucide-react';
import { CoopNotification, NotificationPriority, NotificationCategory } from '../../hooks/useSSE';

interface NotificationCenterProps {
  notifications: CoopNotification[];
  unreadCount: number;
  isConnected: boolean;
  onMarkAsRead: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectAction?: (notification: CoopNotification) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  isConnected,
  onMarkAsRead,
  onAcknowledge,
  onMarkAllAsRead,
  onSelectAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'APPROVAL'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filter items
  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'CRITICAL') return item.priority === 'CRITICAL';
    if (filter === 'APPROVAL') return item.category === 'INVESTMENT_PENDING_APPROVAL';
    return true;
  });

  const hasCriticalUnread = notifications.some(
    (n) => n.priority === 'CRITICAL' && n.status === 'UNREAD'
  );

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'NEW_BANK_DATA':
        return <Landmark className="w-4 h-4 text-cyan-400" />;
      case 'BOND_MATURITY':
        return <Clock className="w-4 h-4 text-amber-400" />;
      case 'LOW_LIQUIDITY':
        return <TrendingDown className="w-4 h-4 text-rose-500" />;
      case 'INVESTMENT_PENDING_APPROVAL':
        return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-cyan-400" />;
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/30">
            วิกฤติ / เร่งด่วน
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            แจ้งเตือน
          </span>
        );
      case 'INFORMATION':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            ข้อมูล
          </span>
        );
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`ศูนย์การแจ้งเตือน ${unreadCount > 0 ? `มี ${unreadCount} รายการใหม่` : ''}`}
        className="relative p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-700/60 text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-400"
      >
        <Bell className="w-5 h-5" />

        {/* Live SSE status indicator dot */}
        <span
          title={isConnected ? 'เชื่อมต่อระบบแจ้งเตือนแบบเรียลไทม์' : 'กำลังเชื่อมต่อใหม่...'}
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
          }`}
        />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-5 h-5 px-1 text-[11px] font-bold rounded-full text-white shadow-lg ${
              hasCriticalUnread
                ? 'bg-rose-600 animate-pulse ring-2 ring-rose-400/50'
                : 'bg-cyan-600 ring-2 ring-cyan-400/40'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-[420px] max-w-[95vw] rounded-2xl bg-slate-900/95 border border-cyan-500/25 shadow-2xl backdrop-blur-xl z-50 text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-cyan-400" />
                ศูนย์แจ้งเตือนธุรกรรม (RYCOOP)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {isConnected ? 'Real-time' : 'Reconnecting...'}
              </span>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* Tab Filter */}
          <div className="flex border-b border-slate-800/80 px-2 pt-2 bg-slate-950/40 text-xs font-medium">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 border-b-2 transition-colors ${
                filter === 'ALL'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('CRITICAL')}
              className={`px-3 py-1.5 border-b-2 transition-colors ${
                filter === 'CRITICAL'
                  ? 'border-rose-500 text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              เร่งด่วน ({notifications.filter((n) => n.priority === 'CRITICAL').length})
            </button>
            <button
              onClick={() => setFilter('APPROVAL')}
              className={`px-3 py-1.5 border-b-2 transition-colors ${
                filter === 'APPROVAL'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              รออนุมัติ ({notifications.filter((n) => n.category === 'INVESTMENT_PENDING_APPROVAL').length})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-700">
            {filteredNotifications.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs">
                ไม่มีรายการแจ้งเตือนในหมวดหมู่นี้
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isUnread = n.status === 'UNREAD';
                const isAcknowledged = n.status === 'ACKNOWLEDGED';

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 transition-colors text-left flex gap-3 ${
                      isUnread
                        ? 'bg-slate-800/40 hover:bg-slate-800/70 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-800/30 opacity-85'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="mt-0.5 p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0 h-fit">
                      {getCategoryIcon(n.category)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        {getPriorityBadge(n.priority)}
                        <span className="text-[11px] text-slate-500 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-100 truncate">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-relaxed">
                        {n.message}
                      </p>

                      {/* Footer Actions */}
                      <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-1.5">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => onMarkAsRead(n.id)}
                              className="text-[11px] text-slate-400 hover:text-slate-200"
                            >
                              อ่านแล้ว
                            </button>
                          )}
                          {!isAcknowledged && (
                            <button
                              type="button"
                              onClick={() => onAcknowledge(n.id)}
                              className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40"
                            >
                              รับทราบ
                            </button>
                          )}
                          {isAcknowledged && (
                            <span className="text-[10px] text-emerald-400/90 flex items-center gap-1 font-medium">
                              ✓ รับทราบแล้ว
                            </span>
                          )}
                        </div>

                        {n.actionUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAction?.(n);
                              setIsOpen(false);
                            }}
                            className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1"
                          >
                            <span>ดำเนินการ</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-500 flex justify-between items-center">
            <span>RYCOOP Notification Outbox Engine</span>
            <span className="font-mono text-slate-400">Security Level: Enterprise</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
