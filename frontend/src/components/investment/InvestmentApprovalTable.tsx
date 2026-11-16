'use client';

import React, { useState } from 'react';
import { useAlert } from '../../hooks/useAlert';
import { ShieldCheck, XCircle, CheckCircle2, Lock, Eye, AlertCircle } from 'lucide-react';

export interface PendingInvestment {
  id: string;
  referenceId: string;
  investmentType: string;
  issuerName: string;
  amount: number;
  expectedYield: number;
  tenorMonths: number;
  makerName: string;
  makerSubmittedAt: string;
  status: 'PENDING_CHECKER' | 'APPROVED' | 'REJECTED';
}

const INITIAL_PENDING: PendingInvestment[] = [
  {
    id: 'inv-101',
    referenceId: 'INV-889102',
    investmentType: 'พันธบัตรรัฐบาล (LB28DA)',
    issuerName: 'กระทรวงการคลัง / ธนาคารแห่งประเทศไทย',
    amount: 15000000,
    expectedYield: 3.25,
    tenorMonths: 36,
    makerName: 'คุณสมชาย พัฒนากร (Maker)',
    makerSubmittedAt: '2026-11-16 10:15',
    status: 'PENDING_CHECKER',
  },
  {
    id: 'inv-102',
    referenceId: 'INV-889103',
    investmentType: 'หุ้นกู้เอกชน ปตท. (PTT275A)',
    issuerName: 'บมจ. ปตท. (อันดับเครดิต AAA)',
    amount: 25000000,
    expectedYield: 3.85,
    tenorMonths: 24,
    makerName: 'คุณสมชาย พัฒนากร (Maker)',
    makerSubmittedAt: '2026-11-16 11:00',
    status: 'PENDING_CHECKER',
  },
];

export const InvestmentApprovalTable: React.FC = () => {
  const [items, setItems] = useState<PendingInvestment[]>(INITIAL_PENDING);
  const { confirm, criticalTransactionConfirm, stepUp2FA, success, warning, error, loading, closeLoading } = useAlert();

  const handleApprove = async (item: PendingInvestment) => {
    // 1. Initial Review Confirmation
    const initialConfirm = await confirm(
      'ตรวจสอบและอนุมัติการลงทุน',
      `คุณต้องการอนุมัติรายการ ${item.referenceId} วงเงิน ${item.amount.toLocaleString()} บาท หรือไม่?`,
      {
        confirmButtonText: 'ดำเนินการต่อเพื่อยืนยัน Step-Up 2FA',
        isGoldAccent: true,
      }
    );

    if (!initialConfirm.isConfirmed) return;

    // 2. Step-up Authentication Prompt (WebAuthn / Passkey / TOTP)
    const stepUpResult = await stepUp2FA(
      `ยืนยันตัวตน Step-Up 2FA สำหรับรายการ ${item.referenceId}`
    );

    if (!stepUpResult.success) {
      warning('การอนุมัติถูกยกเลิก', 'ไม่ได้รับรหัสยืนยันตัวตนระดับสูง');
      return;
    }

    // 3. Backend Verification with Non-dismissible Loading state (Rule 8 & Rule 9)
    loading('กำลังบันทึกการอนุมัติทางบัญชี...', 'ระบบกำลังตรวจสอบสิทธิ์ Checker และบันทึก Audit Log');

    setTimeout(async () => {
      closeLoading();

      // Update State
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'APPROVED' as const } : i))
      );

      await success(
        'อนุมัติการลงทุนเรียบร้อย',
        `รายการ ${item.referenceId} ได้รับการอนุมัติและผูกบัญชีการลงทุนแล้ว บันทึก Audit Log รหัส TX-${Date.now().toString().slice(-6)} เรียบร้อย`
      );
    }, 1200);
  };

  const handleReject = async (item: PendingInvestment) => {
    const rejectConfirm = await confirm(
      'ปฏิเสธคำขอการลงทุน',
      `คุณต้องการปฏิเสธรายการ ${item.referenceId} ใช่หรือไม่? รายการนี้จะถูกส่งกลับไปยังผู้สร้าง (Maker)`,
      {
        confirmButtonText: 'ยืนยันปฏิเสธ',
        isDanger: true,
      }
    );

    if (rejectConfirm.isConfirmed) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'REJECTED' as const } : i))
      );
      await warning('ปฏิเสธรายการแล้ว', `แจ้งเตือนไปยัง ${item.makerName} เรียบร้อยแล้ว`);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              คิวตรวจสอบและอนุมัติการลงทุน (Checker Role)
            </h3>
            <p className="text-xs text-slate-400">
              บังคับใช้ Maker-Checker Dual Control และ Step-Up MFA ป้องกันการทุจริตภายในสหกรณ์
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50">
          Checker Authorization
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
            <tr>
              <th className="py-3 px-3">รหัสรายการ</th>
              <th className="py-3 px-3">ประเภท / ตราสาร</th>
              <th className="py-3 px-3 text-right">มูลค่า (บาท)</th>
              <th className="py-3 px-3 text-center">ผลตอบแทน</th>
              <th className="py-3 px-3">ผู้สร้างคำขอ (Maker)</th>
              <th className="py-3 px-3 text-center">สถานะ</th>
              <th className="py-3 px-3 text-right">ดำเนินการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-3 font-mono font-medium text-cyan-400">
                  {item.referenceId}
                </td>
                <td className="py-3 px-3">
                  <div className="font-semibold text-slate-200">{item.investmentType}</div>
                  <div className="text-[11px] text-slate-500">{item.issuerName}</div>
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-amber-400">
                  ฿{item.amount.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-center font-mono">
                  <span className="text-emerald-400 font-semibold">{item.expectedYield}%</span>
                  <span className="text-slate-500 text-[11px]"> ({item.tenorMonths}ด.)</span>
                </td>
                <td className="py-3 px-3">
                  <div className="text-slate-300">{item.makerName}</div>
                  <div className="text-[10px] text-slate-500">{item.makerSubmittedAt}</div>
                </td>
                <td className="py-3 px-3 text-center">
                  {item.status === 'PENDING_CHECKER' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      รอ Checker ตรวจสอบ
                    </span>
                  )}
                  {item.status === 'APPROVED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      อนุมัติสำเร็จ
                    </span>
                  )}
                  {item.status === 'REJECTED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                      ปฏิเสธแล้ว
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right space-x-2">
                  {item.status === 'PENDING_CHECKER' ? (
                    <>
                      <button
                        onClick={() => handleReject(item)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-800/40 text-rose-400 hover:bg-rose-950/40 text-xs transition-colors"
                      >
                        ปฏิเสธ
                      </button>
                      <button
                        onClick={() => handleApprove(item)}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20"
                      >
                        อนุมัติ (Step-Up)
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">ดำเนินการแล้ว</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestmentApprovalTable;

