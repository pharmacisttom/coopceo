'use client';

import React, { useState, useEffect } from 'react';
import { useAlert } from '../../hooks/useAlert';
import { useAuth } from '../../hooks/useAuth';
import { useInvestmentPasskey } from '../../hooks/useAuth';
import { Lock, Fingerprint, ShieldCheck } from 'lucide-react';

export interface PendingInvestment {
  id: string;
  referenceId: string;
  investmentType: string;
  issuerName: string;
  amount: number;
  expectedYield: number;
  tenorMonths: number;
  makerEmail: string;
  makerSubmittedAt: string;
  status: 'PENDING_CHECKER' | 'APPROVED' | 'REJECTED';
}

export const InvestmentApprovalTable: React.FC = () => {
  const [items, setItems] = useState<PendingInvestment[]>([]);
  const { user } = useAuth();
  const { confirm, success, warning, error, loading, closeLoading } = useAlert();
  const { requestStepUpVerification, isVerifying } = useInvestmentPasskey();

  const fetchProposals = async () => {
    try {
      const res = await fetch('/api/v1/investments', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // Keep existing list if offline
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleApprove = async (item: PendingInvestment) => {
    if (!user || user.role !== 'CHECKER') {
      warning('สิทธิ์ไม่เพียงพอ', `คุณกำลังเข้าสู่ระบบด้วยบทบาท [${user?.role || 'Guest'}] เฉพาะผู้มีบทบาท [CHECKER] เท่านั้นที่สามารถอนุมัติรายการลงทุนได้`);
      return;
    }

    // Segregation of duties front check
    if (user.email.toLowerCase() === item.makerEmail.toLowerCase()) {
      error('ตรวจพบการละเมิด Segregation of Duties', 'ผู้สร้างคำขอ (Maker) ไม่สามารถอนุมัติรายการของตนเองได้');
      return;
    }

    // 1. Initial Review Confirmation
    const initialConfirm = await confirm(
      'ตรวจสอบและอนุมัติการลงทุน (Checker Review)',
      `คุณต้องการอนุมัติรายการ ${item.referenceId} วงเงิน ฿${item.amount.toLocaleString()} บาท หรือไม่?`,
      {
        confirmButtonText: 'ดำเนินการต่อเพื่อยืนยัน Step-Up MFA',
        isGoldAccent: true,
      }
    );

    if (!initialConfirm.isConfirmed) return;

    // 2. Request Transaction-Bound Step-Up Challenge (Passkey or TOTP)
    const stepUpResult = await requestStepUpVerification(item.referenceId, item.amount);
    if (!stepUpResult.success || !stepUpResult.challengeId || !stepUpResult.stepUpToken) {
      return;
    }

    // 3. Submit to backend with Non-dismissible Loading state (Rule 8 & 9)
    loading('กำลังบันทึกการอนุมัติทางบัญชี...', 'ระบบกำลังตรวจสอบลายเซ็น Step-Up และบันทึก Audit Log');

    try {
      const approveRes = await fetch(`/api/v1/investments/${item.referenceId}/checker-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          challengeId: stepUpResult.challengeId,
          stepUpToken: stepUpResult.stepUpToken,
          mfaType: stepUpResult.mfaType || 'PASSKEY',
        }),
      });

      closeLoading();

      if (!approveRes.ok) {
        const errData = await approveRes.json().catch(() => ({}));
        throw new Error(errData.message || 'การอนุมัติล้มเหลว');
      }

      const approveData = await approveRes.json();

      // Update State
      setItems((prev) =>
        prev.map((i) => (i.referenceId === item.referenceId ? { ...i, status: 'APPROVED' as const } : i))
      );

      await success(
        'อนุมัติการลงทุนเรียบร้อย',
        `รายการ ${item.referenceId} ได้รับการอนุมัติและบันทึกประวัติการตรวจสอบสมบูรณ์ (Checker: ${user.fullName})`
      );
    } catch (err: any) {
      closeLoading();
      await error('การอนุมัติล้มเหลว', err?.message || 'ไม่สามารถบันทึกการอนุมัติได้');
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
              ผู้ตรวจสอบปัจจุบัน: <span className="text-amber-400 font-medium">{user ? user.fullName : 'รอเข้าสู่ระบบ'}</span>
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50 flex items-center gap-1.5">
          <Fingerprint className="w-3.5 h-3.5" />
          Step-Up Passkey Protected
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
                  <div className="text-slate-300 font-mono text-[11px]">{item.makerEmail}</div>
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
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={isVerifying}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 ml-auto"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      อนุมัติ (Step-Up)
                    </button>
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
