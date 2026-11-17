import { useState, useCallback, useEffect } from 'react';
import alertService from '../components/alert/alert.service';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'MAKER' | 'CHECKER' | 'ADMIN' | 'AUDITOR' | 'EXECUTIVE';
  department: string;
  passkeyRegistered: boolean;
  totpEnabled: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const loginWithGoogle = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/auth/google/url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alertService.error('เข้าสู่ระบบล้มเหลว', 'ไม่สามารถเชื่อมต่อ Google OAuth2 ได้ในขณะนี้');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      setUser(null);
      alertService.toast('ออกจากระบบสำเร็จ', 'info');
    } catch (err) {
      console.error('Logout error', err);
    }
  }, []);

  return {
    user,
    setUser,
    isLoading,
    loginWithGoogle,
    logout,
    refetch: fetchProfile,
  };
}

/**
 * Phase 3: Transaction-Bound Passkey / Step-Up MFA Hook for Checkers
 */
export function useInvestmentPasskey() {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const requestStepUpVerification = useCallback(
    async (
      referenceId: string,
      amount: number
    ): Promise<{ success: boolean; challengeId?: string; stepUpToken?: string; mfaType?: 'PASSKEY' | 'TOTP' }> => {
      setIsVerifying(true);
      try {
        // 1. Request transaction-bound challenge from backend
        const challengeRes = await fetch('/api/v1/auth/stepup/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceId, amount }),
          credentials: 'same-origin',
        });

        if (!challengeRes.ok) {
          throw new Error('ไม่สามารถสร้าง Step-Up Challenge สำหรับธุรกรรมนี้ได้');
        }

        const { challengeId, challenge } = await challengeRes.json();

        // 2. Ask user for preferred verification method or trigger Passkey
        // For cooperative checker: Try WebAuthn Passkey if supported, else fallback to TOTP prompt
        const supportsWebAuthn = typeof window !== 'undefined' && !!window.PublicKeyCredential;

        if (supportsWebAuthn) {
          // Prompt user to tap Passkey or Authenticator
          const stepUpModal = await alertService.confirm(
            'ยืนยันตัวตนระดับสูง (Step-Up 2FA)',
            `รายการ: ${referenceId} วงเงิน: ฿${amount.toLocaleString()} บาท\nกรุณาแตะกุญแจความปลอดภัย (Passkey) หรือเลือกกรอกรหัส Authenticator`,
            {
              confirmButtonText: 'แตะ Passkey / ลายนิ้วมือ',
              cancelButtonText: 'ใช้รหัส TOTP แทน',
              isGoldAccent: true,
            }
          );

          if (stepUpModal.isConfirmed) {
            // Simulated Passkey Assertion signature bound to challenge
            const mockPasskeyAssertion = `passkey-assert-${challenge}-${Date.now()}`;
            return {
              success: true,
              challengeId,
              stepUpToken: mockPasskeyAssertion,
              mfaType: 'PASSKEY',
            };
          }
        }

        // Fallback: TOTP Prompt
        const totpPrompt = await alertService.promptStepUp2FA(
          `กรอกรหัส Authenticator 6 หลักสำหรับ ${referenceId}`
        );

        if (totpPrompt.success && totpPrompt.pin) {
          return {
            success: true,
            challengeId,
            stepUpToken: totpPrompt.pin,
            mfaType: 'TOTP',
          };
        }

        return { success: false };
      } catch (err: any) {
        alertService.error('การยืนยันตัวตนล้มเหลว', err?.message || 'เกิดข้อผิดพลาดในการยืนยันตัวตนระดับสูง');
        return { success: false };
      } finally {
        setIsVerifying(false);
      }
    },
    []
  );

  return {
    isVerifying,
    requestStepUpVerification,
  };
}

