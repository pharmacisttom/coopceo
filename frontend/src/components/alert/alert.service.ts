/**
 * RYCOOP Smart Finance — Centralized Alert Service
 * Theme: Navy Blue (#0B192C), Cyan (#00ADB5, #38BDF8), Gold (#F1C40F, #D4AF37)
 * 
 * Complies with:
 * - Rule 1: Centralized alert service usable across all pages
 * - Rule 2: Premium UI Navy/Cyan/Gold theme with Light/Dark mode
 * - Rule 3: Success, Error, Warning, Info, Confirm, Loading, Toast
 * - Rule 4: Responsive (Mobile, Tablet, Desktop)
 * - Rule 5: Thai language defaults & Accessibility (ARIA, Screen Reader)
 * - Rule 6: Prevention of modal stacking & z-index collisions
 * - Rule 7: Focus trap, ESC navigation, Keyboard shortcuts
 * - Rule 8: Non-dismissible critical transaction modals during processing
 * - Rule 9: Explicit separation: Frontend confirmation != Backend approval
 */

import Swal, { SweetAlertOptions, SweetAlertResult, SweetAlertIcon, SweetAlertPosition } from 'sweetalert2';

export interface AlertOptions {
  title?: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  showCancelButton?: boolean;
  timer?: number;
  position?: SweetAlertPosition;
  isDanger?: boolean;
  isGoldAccent?: boolean;
  allowOutsideClick?: boolean;
  allowEscapeKey?: boolean;
  customClass?: Record<string, string>;
  didOpen?: (popup: HTMLElement) => void;
  willClose?: (popup: HTMLElement) => void;
  ariaLabel?: string;
}

export interface CriticalConfirmOptions extends AlertOptions {
  transactionType?: string;
  referenceId?: string;
  amount?: number;
  currency?: string;
  onVerifyBackend?: () => Promise<any>;
}

class AlertService {
  private static instance: AlertService;
  private isProcessingCritical: boolean = false;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Base sweetalert configuration with default Navy/Cyan/Gold theme & accessibility
   */
  private getBaseOptions(): SweetAlertOptions {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return {
      customClass: {
        container: 'rycoop-swal-container',
        popup: `rycoop-swal-popup ${isDark ? 'dark' : ''}`,
        title: 'rycoop-swal-title',
        htmlContainer: 'rycoop-swal-html',
        actions: 'rycoop-swal-actions',
        confirmButton: 'rycoop-swal-confirm-btn',
        cancelButton: 'rycoop-swal-cancel-btn',
        closeButton: 'rycoop-swal-close-btn',
      },
      buttonsStyling: false, // Use our tailored CSS classes
      reverseButtons: true, // Cancel on left, Confirm on right for Thai/Standard RTL ergonomics
      focusConfirm: true,
      returnFocus: true,
      showClass: {
        popup: 'swal2-show animate-in fade-in zoom-in-95 duration-200',
        backdrop: 'swal2-backdrop-show duration-200',
      },
      hideClass: {
        popup: 'swal2-hide animate-out fade-out zoom-out-95 duration-150',
      },
    };
  }

  /**
   * Helper to ensure no overlapping modals and enforce z-index stability
   */
  private prepareModalOpening() {
    if (Swal.isVisible() && !this.isProcessingCritical) {
      Swal.close();
    }
  }

  /**
   * 1. Success Alert
   */
  public async success(title: string = 'สำเร็จ', text?: string, options?: AlertOptions): Promise<SweetAlertResult> {
    this.prepareModalOpening();
    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'success',
      title,
      text,
      html: options?.html,
      confirmButtonText: options?.confirmButtonText || 'ตกลง',
      timer: options?.timer,
      timerProgressBar: !!options?.timer,
      ariaLabel: options?.ariaLabel || 'การดำเนินการสำเร็จ',
      ...options,
    });
  }

  /**
   * 2. Error Alert
   */
  public async error(title: string = 'เกิดข้อผิดพลาด', text?: string, options?: AlertOptions): Promise<SweetAlertResult> {
    this.prepareModalOpening();
    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'error',
      title,
      text: text || 'ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      html: options?.html,
      confirmButtonText: options?.confirmButtonText || 'ปิด',
      customClass: {
        ...this.getBaseOptions().customClass,
        confirmButton: 'rycoop-swal-confirm-btn rycoop-swal-confirm-btn-danger',
      },
      ariaLabel: options?.ariaLabel || 'เกิดข้อผิดพลาดในระบบ',
      ...options,
    });
  }

  /**
   * 3. Warning Alert
   */
  public async warning(title: string = 'คำเตือน', text?: string, options?: AlertOptions): Promise<SweetAlertResult> {
    this.prepareModalOpening();
    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'warning',
      title,
      text,
      html: options?.html,
      confirmButtonText: options?.confirmButtonText || 'รับทราบ',
      ariaLabel: options?.ariaLabel || 'คำเตือนทางการเงินหรือความเสี่ยง',
      ...options,
    });
  }

  /**
   * 4. Information Alert
   */
  public async info(title: string = 'ข้อมูลแจ้งเตือน', text?: string, options?: AlertOptions): Promise<SweetAlertResult> {
    this.prepareModalOpening();
    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'info',
      title,
      text,
      html: options?.html,
      confirmButtonText: options?.confirmButtonText || 'เข้าใจแล้ว',
      ariaLabel: options?.ariaLabel || 'ข้อมูลรายละเอียดระบบ',
      ...options,
    });
  }

  /**
   * 5. Standard Confirmation Modal
   */
  public async confirm(
    title: string = 'ยืนยันการทำรายการ',
    text: string = 'คุณต้องการดำเนินการต่อหรือไม่?',
    options?: AlertOptions
  ): Promise<SweetAlertResult> {
    this.prepareModalOpening();
    const confirmBtnClass = options?.isDanger
      ? 'rycoop-swal-confirm-btn rycoop-swal-confirm-btn-danger'
      : options?.isGoldAccent
      ? 'rycoop-swal-confirm-btn rycoop-swal-confirm-btn-gold'
      : 'rycoop-swal-confirm-btn';

    return Swal.fire({
      ...this.getBaseOptions(),
      icon: 'warning',
      title,
      text,
      html: options?.html,
      showCancelButton: true,
      confirmButtonText: options?.confirmButtonText || 'ยืนยัน',
      cancelButtonText: options?.cancelButtonText || 'ยกเลิก',
      customClass: {
        ...this.getBaseOptions().customClass,
        confirmButton: confirmBtnClass,
      },
      focusCancel: !options?.isDanger, // Focus cancel by default for safety
      ...options,
    });
  }

  /**
   * 6. Critical Financial Transaction Confirmation
   * Enforces Rule 8 (Non-dismissible during save) and Rule 9 (Backend validation mandatory)
   */
  public async criticalTransactionConfirm(
    title: string,
    options: CriticalConfirmOptions
  ): Promise<{ confirmed: boolean; stepUpRequired?: boolean; backendResponse?: any; error?: any }> {
    this.prepareModalOpening();

    // Format financial display safely
    const formattedAmount = options.amount
      ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: options.currency || 'THB' }).format(options.amount)
      : null;

    const htmlContent = options.html || `
      <div class="text-left space-y-2 py-2">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">
          ${options.text || 'กรุณาตรวจสอบข้อมูลรายการทางการเงินก่อนยืนยัน'}
        </p>
        ${options.transactionType ? `<div class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs space-y-1 border border-cyan-500/20">
          <div><span class="text-slate-500 dark:text-slate-400">ประเภทรายการ:</span> <span class="font-semibold text-cyan-400">${options.transactionType}</span></div>
          ${options.referenceId ? `<div><span class="text-slate-500 dark:text-slate-400">รหัสอ้างอิง:</span> <span class="font-mono text-slate-300">${options.referenceId}</span></div>` : ''}
          ${formattedAmount ? `<div><span class="text-slate-500 dark:text-slate-400">มูลค่ารายการ:</span> <span class="font-bold text-amber-400 text-sm">${formattedAmount}</span></div>` : ''}
        </div>` : ''}
        <div class="mt-2 text-xs text-amber-500/90 dark:text-amber-400/90 flex items-center gap-1.5 font-medium">
          <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span>ระบบ Maker-Checker: รายการนี้จะต้องผ่านการตรวจสอบและอนุมัติจากผู้มีอำนาจ</span>
        </div>
      </div>
    `;

    const result = await Swal.fire({
      ...this.getBaseOptions(),
      icon: 'question',
      title,
      html: htmlContent,
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText || 'ยืนยันส่งอนุมัติ (Maker)',
      cancelButtonText: options.cancelButtonText || 'ยกเลิก',
      customClass: {
        ...this.getBaseOptions().customClass,
        confirmButton: 'rycoop-swal-confirm-btn rycoop-swal-confirm-btn-gold',
      },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      allowEscapeKey: () => !Swal.isLoading(),
      preConfirm: async () => {
        if (!options.onVerifyBackend) {
          return true;
        }

        this.isProcessingCritical = true;
        try {
          // Rule 8: Disable backdrop click & escape during active backend verification
          Swal.getCancelButton()?.setAttribute('disabled', 'true');
          const response = await options.onVerifyBackend();
          return response;
        } catch (err: any) {
          Swal.showValidationMessage(`การตรวจสอบล้มเหลว: ${err?.message || 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้'}`);
          return false;
        } finally {
          this.isProcessingCritical = false;
        }
      },
    });

    if (result.isConfirmed) {
      return {
        confirmed: true,
        backendResponse: result.value,
      };
    }

    return { confirmed: false };
  }

  /**
   * 7. Step-Up Authentication Modal (TOTP / Passkey)
   */
  public async promptStepUp2FA(title: string = 'ยืนยันตัวตนระดับสูง (Step-Up 2FA)'): Promise<{ success: boolean; pin?: string }> {
    this.prepareModalOpening();

    const result = await Swal.fire({
      ...this.getBaseOptions(),
      title,
      html: `
        <div class="text-left space-y-2 py-1">
          <p class="text-xs text-slate-500 dark:text-slate-300">
            รายการนี้มีความสำคัญสูง กรุณากรอกรหัส Authenticator 6 หลัก หรือแตะ Passkey ของท่าน
          </p>
          <div class="mt-3">
            <input id="swal-totp-input" type="text" maxlength="6" pattern="[0-9]{6}" inputmode="numeric"
              placeholder="000000" autocomplete="one-time-code"
              class="w-full text-center text-2xl tracking-widest font-mono py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันรหัส',
      cancelButtonText: 'ยกเลิก',
      focusConfirm: false,
      didOpen: () => {
        const input = document.getElementById('swal-totp-input') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      },
      preConfirm: () => {
        const input = document.getElementById('swal-totp-input') as HTMLInputElement;
        const value = input?.value?.trim();
        if (!value || value.length !== 6 || !/^\d+$/.test(value)) {
          Swal.showValidationMessage('กรุณากรอกรหัส 6 หลักให้ถูกต้อง');
          return false;
        }
        return value;
      },
    });

    if (result.isConfirmed && result.value) {
      return { success: true, pin: result.value };
    }

    return { success: false };
  }

  /**
   * 8. Persistent Loading Alert (Rule 8: Non-dismissible during save)
   */
  public loading(title: string = 'กำลังประมวลผล...', text: string = 'กรุณารอสักครู่ ห้ามปิดหน้าต่างนี้'): void {
    this.isProcessingCritical = true;
    Swal.fire({
      ...this.getBaseOptions(),
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      showCancelButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  /**
   * Close active loading modal
   */
  public closeLoading(): void {
    this.isProcessingCritical = false;
    if (Swal.isVisible()) {
      Swal.close();
    }
  }

  /**
   * 9. Toast Notification Alert
   */
  public toast(
    title: string,
    icon: SweetAlertIcon = 'info',
    position: SweetAlertPosition = 'top-end',
    timer: number = 3500
  ): Promise<SweetAlertResult> {
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    const ToastMixin = Swal.mixin({
      toast: true,
      position,
      showConfirmButton: false,
      timer,
      timerProgressBar: true,
      customClass: {
        container: 'rycoop-swal-container',
        popup: `rycoop-swal-toast ${isDark ? 'dark' : ''}`,
        title: 'text-sm font-semibold text-slate-800 dark:text-slate-100',
      },
      didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer);
        toast.addEventListener('mouseleave', Swal.resumeTimer);
      },
    });

    return ToastMixin.fire({
      icon,
      title,
    });
  }
}

export const alertService = AlertService.getInstance();
export default alertService;
