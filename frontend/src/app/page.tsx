'use client';

import React, { useState } from 'react';
import { useAlert } from '../hooks/useAlert';
import { useSSE, CoopNotification } from '../hooks/useSSE';
import { useAuth } from '../hooks/useAuth';
import NotificationCenter from '../components/notification/NotificationCenter';
import MakerCheckerModal from '../components/investment/MakerCheckerModal';
import InvestmentApprovalTable from '../components/investment/InvestmentApprovalTable';
import {
  Shield,
  Bell,
  CheckCircle,
  AlertOctagon,
  AlertTriangle,
  Info,
  Sparkles,
  Zap,
  Landmark,
  Clock,
  TrendingDown,
  Layers,
  Lock,
  Moon,
  Sun,
  Database,
  Server,
  LogIn,
  LogOut,
} from 'lucide-react';

const INITIAL_DEMO_NOTIFICATIONS: CoopNotification[] = [
  {
    id: 'notif-001',
    eventId: 'evt-bank-991',
    title: 'ข้อมูลธนาคารพาณิชย์ปรับปรุงใหม่',
    message: 'ธนาคารกรุงไทยปรับอัตราดอกเบี้ยเงินฝากประจำ 12 เดือน เพิ่มขึ้น 0.25% เป็น 2.10% ต่อปี',
    category: 'NEW_BANK_DATA',
    priority: 'INFORMATION',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    actionUrl: '#bank-rates',
  },
  {
    id: 'notif-002',
    eventId: 'evt-bond-992',
    title: 'หุ้นกู้ใกล้ครบกำหนดไถ่ถอนใน 15 วัน',
    message: 'หุ้นกู้ บมจ. ปูนซิเมนต์ไทย (SCC26DA) วงเงิน 30,000,000 บาท จะครบกำหนดในวันที่ 30 พ.ย. 2026 กรุณาเตรียมแผนสภาพคล่อง',
    category: 'BOND_MATURITY',
    priority: 'WARNING',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    actionUrl: '#bonds',
  },
  {
    id: 'notif-003',
    eventId: 'evt-liq-993',
    title: 'ระดับสภาพคล่องสำรองต่ำกว่าเกณฑ์ความปลอดภัย',
    message: 'อัตราส่วนสภาพคล่องสุทธิ (Liquidity Coverage) ลดลงเหลือ 5.8% (เกณฑ์กำหนดสหกรณ์ขั้นต่ำ 6.0%) ควรพิจารณาสำรองเงินสด',
    category: 'LOW_LIQUIDITY',
    priority: 'CRITICAL',
    status: 'UNREAD',
    createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    actionUrl: '#liquidity',
  },
];

export default function SmartFinanceDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const { user, loginWithGoogle, logout } = useAuth();
  const {
    success,
    error,
    warning,
    info,
    confirm,
    toast,
  } = useAlert();

  // Hardened SSE hook
  const {
    notifications,
    setNotifications,
    isConnected,
    unreadCount,
    markAsRead,
    acknowledge,
    markAllAsRead,
  } = useSSE();

  React.useEffect(() => {
    if (notifications.length === 0) {
      setNotifications(INITIAL_DEMO_NOTIFICATIONS);
    }
  }, [notifications.length, setNotifications]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark');
    }
  };

  const triggerSimulation = (type: 'BANK' | 'BOND' | 'LIQUIDITY' | 'INVESTMENT') => {
    const timestamp = new Date().toISOString();
    const eventId = `evt-${Date.now()}`;

    let newEvent: CoopNotification;

    switch (type) {
      case 'BANK':
        newEvent = {
          id: `notif-${Date.now()}`,
          eventId,
          title: 'อัปเดตดอกเบี้ยเงินฝากธนาคารออมสิน',
          message: 'พบการปรับอัตราดอกเบี้ยเงินฝากสหกรณ์พิเศษ เป็น 2.35% ต่อปี มีผลตั้งแต่สัปดาห์หน้า',
          category: 'NEW_BANK_DATA',
          priority: 'INFORMATION',
          status: 'UNREAD',
          createdAt: timestamp,
          actionUrl: '#bank-rates',
        };
        break;
      case 'BOND':
        newEvent = {
          id: `notif-${Date.now()}`,
          eventId,
          title: 'แจ้งเตือน: หุ้นกู้ บมจ.กัลฟ์ ครบกำหนดใน 7 วัน',
          message: 'หุ้นกู้ GULF26NA วงเงิน 20,000,000 บาท เตรียมโอนคืนเข้าบัญชีหลักสหกรณ์',
          category: 'BOND_MATURITY',
          priority: 'WARNING',
          status: 'UNREAD',
          createdAt: timestamp,
          actionUrl: '#bonds',
        };
        break;
      case 'LIQUIDITY':
        newEvent = {
          id: `notif-${Date.now()}`,
          eventId,
          title: '[เร่งด่วน] สภาพคล่องลดต่ำลงสู่ระดับสีส้ม',
          message: 'ยอดถอนเงินฝากสมาชิกรายใหญ่เกิน 10,000,000 บาท สภาพคล่องคงเหลือ 4.9% ต่ำกว่าเกณฑ์วิกฤต',
          category: 'LOW_LIQUIDITY',
          priority: 'CRITICAL',
          status: 'UNREAD',
          createdAt: timestamp,
          actionUrl: '#liquidity',
        };
        break;
      case 'INVESTMENT':
        newEvent = {
          id: `notif-${Date.now()}`,
          eventId,
          title: 'รายการลงทุนใหม่รอการอนุมัติ (Checker Queue)',
          message: 'Maker ได้ส่งรายการซื้อพันธบัตร ธปท. วงเงิน 15,000,000 บาท รอการตรวจสอบ',
          category: 'INVESTMENT_PENDING_APPROVAL',
          priority: 'WARNING',
          status: 'UNREAD',
          createdAt: timestamp,
          actionUrl: '#checker-queue',
        };
        break;
    }

    setNotifications((prev) => [newEvent, ...prev]);

    if (newEvent.priority === 'CRITICAL') {
      toast(`[สำคัญเร่งด่วน] ${newEvent.title}`, 'error', 'top-end', 5000);
    } else if (newEvent.priority === 'WARNING') {
      toast(`[แจ้งเตือน] ${newEvent.title}`, 'warning', 'top-end', 4000);
    } else {
      toast(newEvent.title, 'info', 'bottom-end', 3000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-amber-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  RYCOOP <span className="text-cyan-400">Smart Finance</span>
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  TEST RC01
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ระบบกำกับดูแลการเงิน & Maker-Checker Dual Control
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            {/* Real-time Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>SSE Hardened</span>
            </div>

            {/* Dark/Light toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors"
              title="สลับโหมดสี"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-400" />}
            </button>

            {/* Notification Center */}
            <NotificationCenter
              notifications={notifications}
              unreadCount={unreadCount}
              isConnected={isConnected}
              onMarkAsRead={markAsRead}
              onAcknowledge={acknowledge}
              onMarkAllAsRead={markAllAsRead}
              onSelectAction={(n) => {
                info(`รายละเอียด: ${n.title}`, n.message);
              }}
            />

            {/* User Session Profile or Login */}
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-800 text-xs">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-amber-500 flex items-center justify-center font-bold text-slate-950">
                  {user.role.substring(0, 2)}
                </div>
                <div className="hidden md:block text-left">
                  <div className="font-semibold text-white leading-none">{user.fullName}</div>
                  <div className="text-[10px] text-cyan-400 font-mono mt-0.5">Role: {user.role}</div>
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="ออกจากระบบ"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={loginWithGoogle}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Google Login (@rycoop.coop)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        {/* Banner: Security Hardening RC01 Status */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950/40 to-slate-900 border border-cyan-500/30 p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Lock className="w-4 h-4" />
                </span>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  RYCOOP Security Hardened Release Candidate 01 (RC01)
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                แก้ไขช่องโหว่ความปลอดภัยระดับวิกฤต: บังคับใช้ Server-Side Session สำหรับ Maker-Checker, ป้องกัน Race Condition ด้วย Row-Level Lock, บังคับใช้ Step-Up Authentication ที่ผูกกับพารามิเตอร์ธุรกรรม, และจำกัดสิทธิ์ SSE แบบ Default-Deny
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-mono shrink-0">
              <span className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700 text-emerald-400">
                ✓ Maker!=Checker Enforced
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700 text-amber-400">
                ✓ Step-Up Challenge Bound
              </span>
              <span className="px-2.5 py-1 rounded bg-slate-900/80 border border-slate-700 text-cyan-400">
                ✓ Safe Port Mapping
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: SweetAlert2 Centralized Service Showcase */}
        <section className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                SweetAlert2 Centralized Alert Service (Navy, Cyan, Gold Theme)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ทดสอบโมดอลแจ้งเตือนทุกประเภทตามข้อกำหนด: รองรับ Responsive, Focus Trap, ESC, และ Accessibility
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-800/50">
              alert.service.ts
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5">
            <button
              onClick={() => success('บันทึกข้อมูลเรียบร้อย', 'ข้อมูลสมาชิกล่าสุดถูกบันทึกลงระบบหลักแล้ว')}
              className="p-3 rounded-xl bg-slate-950/70 border border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-950/20 text-emerald-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Success Alert</span>
            </button>

            <button
              onClick={() => error('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'ไม่สามารถเชื่อมต่อฐานข้อมูลหลักชั่วคราว รหัส ERR-5002')}
              className="p-3 rounded-xl bg-slate-950/70 border border-rose-500/30 hover:border-rose-400 hover:bg-rose-950/20 text-rose-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <AlertOctagon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Error Alert</span>
            </button>

            <button
              onClick={() => warning('เตือนความเสี่ยงสภาพคล่อง', 'อัตราส่วนเงินสดสำรองกำลังเข้าใกล้ระดับขั้นต่ำตามเกณฑ์กำกับ')}
              className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-950/20 text-amber-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <AlertTriangle className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Warning Alert</span>
            </button>

            <button
              onClick={() => info('รอบปิดบัญชีสิ้นปี 2026', 'ระบบจะประมวลผลเงินปันผลสมาชิกในวันที่ 25 ธันวาคม')}
              className="p-3 rounded-xl bg-slate-950/70 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/20 text-cyan-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <Info className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Information Alert</span>
            </button>

            <button
              onClick={async () => {
                const res = await confirm('ยืนยันการปิดงบประจำวัน', 'คุณต้องการเริ่มกระบวนการคำนวณดอกเบี้ยสะสมหรือไม่?');
                if (res.isConfirmed) success('เริ่มประมวลผลแล้ว', 'กำลังรัน Batch Job ใน Background Worker');
              }}
              className="p-3 rounded-xl bg-slate-950/70 border border-blue-500/30 hover:border-blue-400 hover:bg-blue-950/20 text-blue-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <Shield className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Confirm Alert</span>
            </button>

            <button
              onClick={() => toast('อัปเดตข้อมูลแบบเรียลไทม์แล้ว', 'success', 'top-end', 3000)}
              className="p-3 rounded-xl bg-slate-950/70 border border-purple-500/30 hover:border-purple-400 hover:bg-purple-950/20 text-purple-400 flex flex-col items-center justify-center gap-2 text-xs font-medium transition-all group"
            >
              <Bell className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span>Toast Notification</span>
            </button>
          </div>
        </section>

        {/* Section 2: Real-time Event Simulation Triggers */}
        <section className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                จำลองเหตุการณ์แจ้งเตือนทางการเงิน 4 กรณีหลัก (Real-time SSE Event Generators)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                กดปุ่มเพื่อสร้างเหตุการณ์เข้าสู่ระบบ Notification Center ผ่าน SSE (พร้อมระบบป้องกัน Duplicate Event)
              </p>
            </div>
            <span className="text-xs font-mono text-amber-400 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-800/50">
              Event Deduplication Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-cyan-400 mb-2">
                  <Landmark className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">1. ข้อมูลธนาคารใหม่</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  แจ้งเตือนอัตราดอกเบี้ยและผลิตภัณฑ์เงินฝากธนาคารพาณิชย์ที่มีการเปลี่ยนแปลงล่าสุด
                </p>
              </div>
              <button
                onClick={() => triggerSimulation('BANK')}
                className="mt-4 w-full py-2 px-3 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ยิงเหตุการณ์ข้อมูลธนาคาร</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">2. หุ้นกู้ครบกำหนด</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ระบบแจ้งเตือนตราสารหนี้/หุ้นกู้ใกล้ครบกำหนดไถ่ถอน (30 วัน, 15 วัน, 7 วัน)
                </p>
              </div>
              <button
                onClick={() => triggerSimulation('BOND')}
                className="mt-4 w-full py-2 px-3 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ยิงเหตุการณ์หุ้นกู้ครบกำหนด</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-rose-500/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-400 mb-2">
                  <TrendingDown className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">3. สภาพคล่องต่ำ</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  เตือนด่วนเมื่อ Liquidity Ratio ต่ำกว่าเกณฑ์ปลอดภัยของสหกรณ์ (Critical Priority)
                </p>
              </div>
              <button
                onClick={() => triggerSimulation('LIQUIDITY')}
                className="mt-4 w-full py-2 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ยิงเหตุการณ์สภาพคล่องต่ำ</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <Lock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">4. รายการรออนุมัติ</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  แจ้งเตือนรายการลงทุนใหม่ที่ Maker บันทึกเข้ามา และรอ Checker ตรวจสอบ
                </p>
              </div>
              <button
                onClick={() => triggerSimulation('INVESTMENT')}
                className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-700/60 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ยิงคำขอลงทุนใหม่</span>
              </button>
            </div>
          </div>
        </section>

        {/* Section 3: Maker-Checker Dual Control Workflow */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-2">
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              กระบวนการควบคุมแบบคู่ (Maker–Checker Dual Authorization Workflow)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ป้องกันการทุจริตภายในสหกรณ์: บังคับใช้การยืนยันตัวตนสองชั้น, ห้าม Maker อนุมัติรายการตนเอง, และยืนยันตัวตนด้วย Step-Up Passkey
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <MakerCheckerModal />
            </div>

            <div className="lg:col-span-7">
              <InvestmentApprovalTable />
            </div>
          </div>
        </section>

        {/* Section 4: System Architecture & Infrastructure Readiness Summary */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>สถานะสถาปัตยกรรมระบบและความปลอดภัย (Infrastructure & Safety Matrix)</span>
            </div>
            <span className="font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
              Status: Hardened TEST RC01
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>PostgreSQL & Outbox Queue</span>
              </div>
              <p className="text-[11px] text-slate-400">
                จัดเก็บประวัติและ Audit Logs พร้อมระบบ Row-level Lock ป้องกัน Race Condition ในรายการอนุมัติ
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Google OIDC & Passkey</span>
              </div>
              <p className="text-[11px] text-slate-400">
                จำกัดเฉพาะโดเมน @rycoop.coop พร้อมการตรวจสอบลายเซ็น Step-Up MFA ที่ผูกกับพารามิเตอร์ธุรกรรม
              </p>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-rose-400" />
                <span>Zero Production Impact</span>
              </div>
              <p className="text-[11px] text-slate-400">
                แยกพอร์ต 8080/8443, Docker Network และ Database จากระบบเดิม 100% ไม่กระทบ Production ของสหกรณ์
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        RYCOOP Smart Finance Enterprise • Security Hardening RC01 Release Candidate
      </footer>
    </div>
  );
}
