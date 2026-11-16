import { useCallback } from 'react';
import alertService, { AlertOptions, CriticalConfirmOptions } from '../components/alert/alert.service';
import { SweetAlertIcon, SweetAlertPosition } from 'sweetalert2';

export function useAlert() {
  const success = useCallback((title: string, text?: string, options?: AlertOptions) => {
    return alertService.success(title, text, options);
  }, []);

  const error = useCallback((title: string, text?: string, options?: AlertOptions) => {
    return alertService.error(title, text, options);
  }, []);

  const warning = useCallback((title: string, text?: string, options?: AlertOptions) => {
    return alertService.warning(title, text, options);
  }, []);

  const info = useCallback((title: string, text?: string, options?: AlertOptions) => {
    return alertService.info(title, text, options);
  }, []);

  const confirm = useCallback((title: string, text?: string, options?: AlertOptions) => {
    return alertService.confirm(title, text, options);
  }, []);

  const criticalTransactionConfirm = useCallback((title: string, options: CriticalConfirmOptions) => {
    return alertService.criticalTransactionConfirm(title, options);
  }, []);

  const stepUp2FA = useCallback((title?: string) => {
    return alertService.promptStepUp2FA(title);
  }, []);

  const loading = useCallback((title?: string, text?: string) => {
    alertService.loading(title, text);
  }, []);

  const closeLoading = useCallback(() => {
    alertService.closeLoading();
  }, []);

  const toast = useCallback((title: string, icon?: SweetAlertIcon, position?: SweetAlertPosition, timer?: number) => {
    return alertService.toast(title, icon, position, timer);
  }, []);

  return {
    success,
    error,
    warning,
    info,
    confirm,
    criticalTransactionConfirm,
    stepUp2FA,
    loading,
    closeLoading,
    toast,
  };
}
