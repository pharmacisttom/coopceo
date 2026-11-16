import { test, expect } from '@playwright/test';

test.describe('RYCOOP Smart Finance — UI Alert, Notification & Maker-Checker E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to local or preview dashboard
    await page.goto('http://localhost:3000');
  });

  test('TC01: Verify SweetAlert2 Theme, Thai Language & Accessibility', async ({ page }) => {
    // Click on Success Alert button
    const successBtn = page.getByRole('button', { name: /Success Alert/i });
    await expect(successBtn).toBeVisible();
    await successBtn.click();

    // Verify SweetAlert2 Popup appeared with Navy/Cyan styling
    const swalModal = page.locator('.rycoop-swal-popup');
    await expect(swalModal).toBeVisible();

    // Check Thai Confirm Button
    const confirmBtn = page.locator('.rycoop-swal-confirm-btn');
    await expect(confirmBtn).toHaveText('ตกลง');
    await expect(confirmBtn).toBeFocused(); // Focus Trap verification

    // Close modal
    await confirmBtn.click();
    await expect(swalModal).not.toBeVisible();
  });

  test('TC02: Notification Center SSE stream and Acknowledgment', async ({ page }) => {
    // Open Notification Center Bell dropdown
    const bellBtn = page.locator('button[aria-label*="ศูนย์การแจ้งเตือน"]');
    await expect(bellBtn).toBeVisible();
    await bellBtn.click();

    // Verify dropdown menu opens
    const dropdown = page.locator('text=ศูนย์แจ้งเตือนธุรกรรม (RYCOOP)');
    await expect(dropdown).toBeVisible();

    // Acknowledge a notification
    const ackBtn = page.locator('button:has-text("รับทราบ")').first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await expect(page.locator('text=รับทราบแล้ว').first()).toBeVisible();
    }
  });

  test('TC03: Maker Submission and Non-Dismissible Critical SweetAlert2 Modal', async ({ page }) => {
    // Scroll to Maker-Checker section
    const makerSubmitBtn = page.getByRole('button', { name: /ส่งขออนุมัติรายการ \(Maker Submit\)/i });
    await expect(makerSubmitBtn).toBeVisible();
    await makerSubmitBtn.click();

    // Critical Confirmation SweetAlert2 dialog should show
    const criticalPopup = page.locator('.rycoop-swal-popup');
    await expect(criticalPopup).toBeVisible();
    await expect(criticalPopup).toContainText('ยืนยันส่งคำขอลงทุน (Maker Submission)');

    // Verify Dual Control warning message
    await expect(criticalPopup).toContainText('ระบบ Maker-Checker: รายการนี้จะต้องผ่านการตรวจสอบ');

    // Confirm submission
    const confirmBtn = criticalPopup.locator('.rycoop-swal-confirm-btn-gold');
    await confirmBtn.click();

    // Success dialog
    await expect(page.locator('text=ส่งรายการขออนุมัติสำเร็จ')).toBeVisible({ timeout: 5000 });
  });

  test('TC04: Checker Review and Step-Up 2FA Flow', async ({ page }) => {
    // Locate Checker Table
    const approveBtn = page.locator('button:has-text("อนุมัติ (Step-Up)")').first();
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // Confirm Review dialog
    const confirmReviewBtn = page.locator('.rycoop-swal-confirm-btn-gold');
    await confirmReviewBtn.click();

    // Step-up 2FA Prompt
    const totpInput = page.locator('#swal-totp-input');
    await expect(totpInput).toBeVisible();

    // Fill 6-digit TOTP
    await totpInput.fill('123456');
    const submitPinBtn = page.locator('.rycoop-swal-confirm-btn');
    await submitPinBtn.click();

    // Verify final approval success
    await expect(page.locator('text=อนุมัติการลงทุนเรียบร้อย')).toBeVisible({ timeout: 5000 });
  });
});
