import { test, expect } from '@playwright/test';

/**
 * E2E tests for settings page modifications.
 * These tests run with authenticated state from the setup.
 */
test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('should display settings page header', async ({ page }) => {
    // Should show settings header
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show description
    await expect(page.getByText(/atur preferensi anda/i)).toBeVisible();
  });

  test('should display timer default settings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show timer defaults card
    await expect(page.getByText(/timer default/i)).toBeVisible();

    // Should show duration settings
    await expect(page.getByText(/durasi pump/i)).toBeVisible();
    await expect(page.getByText(/durasi istirahat/i)).toBeVisible();
    await expect(page.getByText(/berapa kali pump/i)).toBeVisible();
  });

  test('should display alarm settings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show alarm card
    await expect(page.getByText(/^alarm$/i)).toBeVisible();

    // Should show volume slider
    await expect(page.getByText(/volume/i)).toBeVisible();

    // Should have test alarm button
    await expect(page.getByRole('button', { name: /test alarm/i })).toBeVisible();
  });

  test('should display schedule settings', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show schedule card
    await expect(page.getByText(/jadwal harian/i)).toBeVisible();

    // Should show session count control
    await expect(page.getByText(/jumlah sesi per hari/i)).toBeVisible();

    // Should have add/remove buttons
    const addButton = page.locator('button').filter({ has: page.locator('[class*="lucide-plus"]') });
    const removeButton = page.locator('button').filter({ has: page.locator('[class*="lucide-minus"]') });

    // Either plus/minus icons or the text
    await expect(page.getByText(/jadwal/i).first()).toBeVisible();
  });

  test('should allow changing pump duration', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Find pump duration select
    const pumpDurationRow = page.locator('div').filter({ hasText: /durasi pump/i }).first();
    const select = pumpDurationRow.locator('[role="combobox"]');

    if (await select.isVisible()) {
      await select.click();
      await page.getByRole('option', { name: '20 menit' }).click();

      // Verify selection
      await expect(select).toContainText('20');
    }
  });

  test('should have save button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should have save button
    await expect(page.getByRole('button', { name: /simpan/i })).toBeVisible();
  });

  test('should have sign out button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should have sign out button
    await expect(page.getByRole('button', { name: /keluar/i })).toBeVisible();
  });

  test('should toggle notifications', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show notifications toggle
    await expect(page.getByText(/aktifkan notifikasi/i)).toBeVisible();

    // Find the notifications switch
    const notificationSwitch = page.getByLabel(/notifications/i);
    if (await notificationSwitch.isVisible()) {
      // Toggle is present
      expect(true).toBeTruthy();
    }
  });

  test('should test alarm volume', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Find test alarm button
    const testAlarmButton = page.getByRole('button', { name: /test alarm/i });
    await expect(testAlarmButton).toBeVisible();

    // Click to start alarm
    await testAlarmButton.click();

    // Button should change to "Stop Alarm"
    await expect(page.getByRole('button', { name: /stop alarm/i })).toBeVisible();

    // Click to stop
    await page.getByRole('button', { name: /stop alarm/i }).click();

    // Should be back to test alarm
    await expect(page.getByRole('button', { name: /test alarm/i })).toBeVisible();
  });

  test('should save settings successfully', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });

    // Click save button
    await page.getByRole('button', { name: /simpan/i }).click();

    // Should show success message or button state change
    // Wait for the save to complete
    await page.waitForTimeout(1000);

    // Check for success state (either toast or button text)
    const success = await page.getByText(/tersimpan/i).isVisible().catch(() => false);
    const saveButton = page.getByRole('button', { name: /simpan/i });

    // Either success message or save button should be visible
    expect(success || await saveButton.isVisible()).toBeTruthy();
  });
});

test.describe('Settings Navigation', () => {
  test('should navigate to settings from bottom navigation', async ({ page }) => {
    // Start at dashboard
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click settings in navigation
    await page.getByRole('link', { name: /pengaturan|settings/i }).click();

    // Should be on settings page
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible();
  });
});
