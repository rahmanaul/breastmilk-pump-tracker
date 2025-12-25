import { test, expect } from '@playwright/test';

/**
 * E2E tests for the onboarding flow.
 * These tests run with authenticated state from the setup.
 */
test.describe('Onboarding Flow', () => {
  test('should display welcome step first', async ({ page }) => {
    // Navigate to onboarding
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Should show welcome card
    await expect(page.getByRole('heading', { name: /selamat datang/i })).toBeVisible({
      timeout: 10000,
    });

    // Should have start button
    await expect(page.getByRole('button', { name: /mulai/i })).toBeVisible();
  });

  test('should navigate through all steps', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Step 1: Welcome - click next
    await expect(page.getByRole('heading', { name: /selamat datang/i })).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('button', { name: /mulai/i }).click();

    // Step 2: Timer settings
    await expect(page.getByRole('heading', { name: /timer default/i })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 3: Alarm test
    await expect(page.getByRole('heading', { name: /test alarm/i })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole('button', { name: /lanjut/i }).click();

    // Step 4: Complete
    await expect(page.getByRole('heading', { name: /siap/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByRole('button', { name: /mulai tracking/i })).toBeVisible();
  });

  test('should go back to previous steps', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Go to step 2
    await page.getByRole('button', { name: /mulai/i }).click();
    await expect(page.getByRole('heading', { name: /timer default/i })).toBeVisible();

    // Go back to step 1
    await page.getByRole('button', { name: /kembali/i }).click();
    await expect(page.getByRole('heading', { name: /selamat datang/i })).toBeVisible();
  });

  test('should allow changing timer defaults', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Go to timer step
    await page.getByRole('button', { name: /mulai/i }).click();
    await expect(page.getByRole('heading', { name: /timer default/i })).toBeVisible();

    // Change pump duration to 20 minutes
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: '20 menit' }).click();

    // Verify the selection
    await expect(page.getByRole('combobox').first()).toContainText('20');
  });

  test('should show progress bar', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');

    // Progress bar should be visible
    const progressBar = page.getByRole('progressbar');
    await expect(progressBar).toBeVisible();

    // Navigate and check progress increases
    await page.getByRole('button', { name: /mulai/i }).click();
    await expect(progressBar).toBeVisible();
  });
});
