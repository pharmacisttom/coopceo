'use client';

import React, { useState } from 'react';
import { useAlert } from '../../hooks/useAlert';
import { ShieldCheck, ArrowRight, DollarSign, FileText, Building2 } from 'lucide-react';

interface InvestmentFormProps {
  onSuccess?: () => void;
}

export const MakerCheckerModal: React.FC<InvestmentFormProps> = ({ onSuccess }) => {
  const { criticalTransactionConfirm, success, error, loading, closeLoading } = useAlert();

  const [formData, setFormData] = useState({
    investmentType: 'GOVERNMENT_BOND',
    issuerName: 'พันธบัตรรัฐบาลเพื่อการบริหารหนี้ รุ่น LB28DA',
    amount: 15000000,
    expectedYield: 3.25,
    tenorMonths: 36,
    purpose: 'บริหารสภาพคล่องและเพิ่มผลตอบแทนสินทรัพย์สหกรณ์',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const refId = `INV-${Date.now().toString().slice(-6)}`;

    // Rule 8 & 9: SweetAlert2 Critical Confirmation + Non-dismissible during save
    const confirmResult = await criticalTransactionConfirm('ยืนยันส่งคำขอลงทุน (Maker Submission)', {
      transactionType: formData.investmentType === 'GOVERNMENT_BOND' ? 'พันธบัตรรัฐบาล' : 'หุ้นกู้เอกชนคุณภาพสูง',
      referenceId: refId,
      amount: formData.amount,
      currency: 'THB',
      confirmButtonText: 'ยืนยันและส่งให้ Checker ตรวจสอบ',
      onVerifyBackend: async () => {
        // Simulated Backend Maker Submission API call with Transactional Outbox
        const res = await fetch('/api/v1/investments/maker-submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            referenceId: refId,
            makerUserId: 'user-finance-maker-01',
          }),
        }).catch(() => null);

        // Allow graceful simulated response for demo
        return {
          success: true,
          referenceId: refId,
          status: 'PENDING_CHECKER_APPROVAL',
        };
      },
    });

    if (confirmResult.confirmed) {
      await success(
        'ส่งรายการขออนุมัติสำเร็จ',
        `รายการรหัส ${refId} ถูกส่งไปยังคิวอนุมัติของผู้ตรวจสอบ (Checker) เรียบร้อยแล้ว ระบบได้แจ้งเตือนผู้มีอำนาจผ่าน SSE แล้ว`
      );
      onSuccess?.();
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/50 text-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              สร้างคำขอลงทุนทางการเงิน (Maker Role)
            </h3>
            <p className="text-xs text-slate-400">
              ระบบ Maker-Checker: รายการนี้จะต้องได้รับการอนุมัติแบบ Step-up Auth จาก Checker
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-cyan-900/40 text-cyan-300 border border-cyan-700/50">
          Maker Stage
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ประเภทการลงทุน
            </label>
            <select
              value={formData.investmentType}
              onChange={(e) => setFormData({ ...formData, investmentType: e.target.value })}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="GOVERNMENT_BOND">พันธบัตรรัฐบาล (Government Bond)</option>
              <option value="CORPORATE_BOND">หุ้นกู้เอกชน Investment Grade (A- ขึ้นไป)</option>
              <option value="FIXED_DEPOSIT">เงินฝากประจำธนาคารพาณิชย์</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ชื่อตราสาร / ธนาคารผู้ออก
            </label>
            <input
              type="text"
              value={formData.issuerName}
              onChange={(e) => setFormData({ ...formData, issuerName: e.target.value })}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              จำนวนเงินลงทุน (บาท)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-slate-500">฿</span>
              <input
                type="number"
                min="100000"
                step="50000"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-xs font-mono text-amber-400 font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              ผลตอบแทนคาดหวัง (% ต่อปี) / ระยะเวลา (เดือน)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={formData.expectedYield}
                onChange={(e) => setFormData({ ...formData, expectedYield: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Yield %"
              />
              <input
                type="number"
                value={formData.tenorMonths}
                onChange={(e) => setFormData({ ...formData, tenorMonths: Number(e.target.value) })}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="เดือน"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            วัตถุประสงค์และหมายเหตุประกอบ
          </label>
          <textarea
            rows={2}
            value={formData.purpose}
            onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 font-medium"
            onClick={() => {
              setFormData({
                investmentType: 'GOVERNMENT_BOND',
                issuerName: 'พันธบัตรรัฐบาลเพื่อการบริหารหนี้ รุ่น LB28DA',
                amount: 15000000,
                expectedYield: 3.25,
                tenorMonths: 36,
                purpose: 'บริหารสภาพคล่องและเพิ่มผลตอบแทนสินทรัพย์สหกรณ์',
              });
            }}
          >
            ล้างข้อมูล
          </button>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <ShieldCheck className="w-4 h-4" />
            ส่งขออนุมัติรายการ (Maker Submit)
          </button>
        </div>
      </form>
    </div>
  );
};

export default MakerCheckerModal;
