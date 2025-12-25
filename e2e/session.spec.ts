import { test, expect } from '@playwright/test';

/**
 * E2E tests for session creation and timer functionality.
 * These tests run with authenticated state from the setup.
 */
test.describe('Session', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/session');
    await page.waitForLoadState('networkidle');
  });

  test('should display session configuration', async ({ page }) => {
    // Should show session config page
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });

    // Should have session type buttons
    await expect(page.getByRole('button', { name: /regular/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /power/i })).toBeVisible();

    // Should have start button
    await expect(page.getByRole('button', { name: /mulai timer/i })).toBeVisible();
  });

  test('should toggle between regular and power session types', async ({ page }) => {
    // Wait for page to load
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });

    // Regular should be selected by default
    const regularButton = page.getByRole('button', { name: /regular/i });
    const powerButton = page.getByRole('button', { name: /power/i });

    // Click power
    await powerButton.click();
    // Power should now be selected (check visual state)
    await expect(powerButton).toHaveClass(/bg-amber-600/);

    // Click regular
    await regularButton.click();
    // Regular should be selected
  });

  test('should allow changing timer duration', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });

    // Find and change pump duration
    const durationSelects = page.getByRole('combobox');

    // Change pump duration
    await durationSelects.first().click();
    await page.getByRole('option', { name: '20 menit' }).click();

    // Verify the selection
    await expect(durationSelects.first()).toContainText('20');
  });

  test('should show estimated total time', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show estimated time
    await expect(page.getByText(/estimasi total/i)).toBeVisible();
    await expect(page.getByText(/menit$/i)).toBeVisible();
  });

  test('should start timer when clicking start button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });

    // Click start button
    await page.getByRole('button', { name: /mulai timer/i }).click();

    // Should transition to timer view
    await expect(page.getByText(/pumping/i)).toBeVisible({ timeout: 5000 });

    // Should show timer controls
    await expect(page.getByRole('button', { name: /stop/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /istirahat|pump/i })).toBeVisible();
  });

  test('should show stop confirmation dialog', async ({ page }) => {
    // Start a session first
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /mulai timer/i }).click();
    await expect(page.getByText(/pumping/i)).toBeVisible({ timeout: 5000 });

    // Click stop button
    await page.getByRole('button', { name: /stop/i }).click();

    // Should show confirmation dialog
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByText(/yakin ingin menghentikan/i)).toBeVisible();

    // Should have cancel and confirm buttons
    await expect(page.getByRole('button', { name: /lanjut pumping/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /stop sesi/i })).toBeVisible();
  });

  test('should cancel stop and continue session', async ({ page }) => {
    // Start a session
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /mulai timer/i }).click();
    await expect(page.getByText(/pumping/i)).toBeVisible({ timeout: 5000 });

    // Try to stop
    await page.getByRole('button', { name: /stop/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();

    // Cancel
    await page.getByRole('button', { name: /lanjut pumping/i }).click();

    // Should still be in timer view
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page.getByText(/pumping/i)).toBeVisible();
  });

  test('should complete session and show results', async ({ page }) => {
    // Start a session
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /mulai timer/i }).click();
    await expect(page.getByText(/pumping/i)).toBeVisible({ timeout: 5000 });

    // Stop the session
    await page.getByRole('button', { name: /stop/i }).click();
    await page.getByRole('button', { name: /stop sesi/i }).click();

    // Should show completion form
    await expect(page.getByRole('heading', { name: /sesi selesai/i })).toBeVisible({
      timeout: 5000,
    });

    // Should have volume input
    await expect(page.getByLabel(/volume/i)).toBeVisible();

    // Should have completion toggle
    await expect(page.getByText(/sesi tuntas/i)).toBeVisible();

    // Should have save button (disabled until volume is entered)
    await expect(page.getByRole('button', { name: /simpan sesi/i })).toBeDisabled();
  });

  test('should enable save button when volume is entered', async ({ page }) => {
    // Start and stop a session
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /mulai timer/i }).click();
    await expect(page.getByText(/pumping/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /stop/i }).click();
    await page.getByRole('button', { name: /stop sesi/i }).click();

    // Wait for completion form
    await expect(page.getByRole('heading', { name: /sesi selesai/i })).toBeVisible({
      timeout: 5000,
    });

    // Enter volume
    await page.getByLabel(/volume/i).fill('100');

    // Save button should be enabled
    await expect(page.getByRole('button', { name: /simpan sesi/i })).toBeEnabled();
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard with schedule', async ({ page }) => {
    // Should show today header
    await expect(page.getByRole('heading', { name: /hari ini/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show new session button
    await expect(page.getByRole('link', { name: /sesi baru/i })).toBeVisible();

    // Should show schedule section
    await expect(page.getByRole('heading', { name: /jadwal hari ini/i })).toBeVisible();
  });

  test('should display quick stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /hari ini/i })).toBeVisible({
      timeout: 10000,
    });

    // Should show volume stat
    await expect(page.getByText(/total volume/i)).toBeVisible();
    await expect(page.getByText(/ml$/)).toBeVisible();

    // Should show time stat
    await expect(page.getByText(/waktu pump/i)).toBeVisible();
  });

  test('should navigate to session page from new session button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /hari ini/i })).toBeVisible({
      timeout: 10000,
    });

    // Click new session
    await page.getByRole('link', { name: /sesi baru/i }).click();

    // Should navigate to session page
    await expect(page).toHaveURL(/\/session/);
    await expect(page.getByRole('heading', { name: /pengaturan sesi/i })).toBeVisible();
  });
});
