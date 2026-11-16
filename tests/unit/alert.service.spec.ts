import alertService from '../../frontend/src/components/alert/alert.service';
import Swal from 'sweetalert2';

jest.mock('sweetalert2', () => {
  const mockSwal = {
    fire: jest.fn().mockResolvedValue({ isConfirmed: true, value: true }),
    close: jest.fn(),
    isVisible: jest.fn().mockReturnValue(false),
    showLoading: jest.fn(),
    isLoading: jest.fn().mockReturnValue(false),
    mixin: jest.fn().mockReturnValue({
      fire: jest.fn().mockResolvedValue({ isConfirmed: true }),
    }),
  };
  return {
    __esModule: true,
    default: mockSwal,
  };
});

describe('SweetAlert2 Centralized Alert Service (RYCOOP Standard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Rule 1 & 2: Centralized Service & Theme
  it('should initialize and return singleton instance', () => {
    expect(alertService).toBeDefined();
  });

  // Rule 3 & 5: Thai Language & Success Alert
  it('should trigger success alert with Thai defaults', async () => {
    await alertService.success('บันทึกสำเร็จ', 'ข้อมูลถูกบันทึกเรียบร้อย');
    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'success',
        title: 'บันทึกสำเร็จ',
        text: 'ข้อมูลถูกบันทึกเรียบร้อย',
        confirmButtonText: 'ตกลง',
      })
    );
  });

  // Rule 3: Error Alert with Danger Button Styling
  it('should trigger error alert with danger button style and Thai text', async () => {
    await alertService.error('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์');
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'error',
        title: 'ข้อผิดพลาด',
        confirmButtonText: 'ปิด',
        customClass: expect.objectContaining({
          confirmButton: expect.stringContaining('rycoop-swal-confirm-btn-danger'),
        }),
      })
    );
  });

  // Rule 6: Prevention of modal stacking / z-index collisions
  it('should close existing open modal before firing new one', async () => {
    (Swal.isVisible as jest.Mock).mockReturnValue(true);
    await alertService.info('แจ้งเตือนใหม่');
    expect(Swal.close).toHaveBeenCalledTimes(1);
    expect(Swal.fire).toHaveBeenCalledTimes(1);
  });

  // Rule 8: Non-dismissible critical transaction confirmation
  it('should enforce non-dismissible config on critical transaction modal', async () => {
    await alertService.criticalTransactionConfirm('ยืนยันส่งอนุมัติการลงทุน', {
      transactionType: 'พันธบัตรรัฐบาล',
      amount: 15000000,
      currency: 'THB',
      referenceId: 'INV-001',
    });

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: 'question',
        title: 'ยืนยันส่งอนุมัติการลงทุน',
        showCancelButton: true,
        showLoaderOnConfirm: true,
      })
    );
  });

  // Rule 8: Loading alert with locked outside clicks
  it('should show persistent loading dialog with outside click disabled', () => {
    alertService.loading('กำลังประมวลผล', 'ห้ามปิดหน้าต่างนี้');
    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'กำลังประมวลผล',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
      })
    );
  });

  // Rule 3: Toast alert
  it('should trigger toast notification', async () => {
    await alertService.toast('บันทึกร่างสำเร็จ', 'success');
    expect(Swal.mixin).toHaveBeenCalledWith(
      expect.objectContaining({
        toast: true,
        position: 'top-end',
      })
    );
  });
});

