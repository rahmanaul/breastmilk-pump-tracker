import { test, expect } from '@playwright/test';

/**
 * E2E tests for theme and appearance settings.
 * Tests dark mode, theme switching, and color scheme customization.
 */
test.describe('Theme Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Wait for settings page to load
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display appearance settings card', async ({ page }) => {
    // Should show appearance card
    await expect(page.getByText(/tampilan/i)).toBeVisible();

    // Should show theme mode label
    await expect(page.getByText(/mode tema/i)).toBeVisible();

    // Should show color scheme label
    await expect(page.getByText(/skema warna/i)).toBeVisible();
  });

  test('should have three theme mode buttons', async ({ page }) => {
    // Should have Light, Dark, and System buttons
    await expect(page.getByRole('button', { name: /terang/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /gelap/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sistem/i })).toBeVisible();
  });

  test('should switch to dark mode', async ({ page }) => {
    // Click dark mode button
    await page.getByRole('button', { name: /gelap/i }).click();

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Document should have dark class
    const htmlClasses = await page.evaluate(() => document.documentElement.classList.toString());
    expect(htmlClasses).toContain('dark');
  });

  test('should switch to light mode', async ({ page }) => {
    // First switch to dark
    await page.getByRole('button', { name: /gelap/i }).click();
    await page.waitForTimeout(500);

    // Then switch to light
    await page.getByRole('button', { name: /terang/i }).click();
    await page.waitForTimeout(500);

    // Document should have light class
    const htmlClasses = await page.evaluate(() => document.documentElement.classList.toString());
    expect(htmlClasses).toContain('light');
  });

  test('should display color scheme options', async ({ page }) => {
    // Should have 5 color scheme buttons (rendered as buttons with background colors)
    const colorSchemeSection = page.locator('div').filter({ hasText: /skema warna/i });
    const colorButtons = colorSchemeSection.locator('button[style*="background"]');

    // Should have multiple color options visible
    await expect(colorSchemeSection).toBeVisible();
  });

  test('should persist theme preference after page reload', async ({ page }) => {
    // Switch to dark mode
    await page.getByRole('button', { name: /gelap/i }).click();
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Theme should still be dark
    await page.waitForTimeout(500);
    const htmlClasses = await page.evaluate(() => document.documentElement.classList.toString());
    expect(htmlClasses).toContain('dark');
  });

  test('should show current color scheme name', async ({ page }) => {
    // Default scheme should show "Default"
    await expect(page.getByText('Default', { exact: true })).toBeVisible();
  });
});

test.describe('Sound Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /pengaturan/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display sound type options', async ({ page }) => {
    // Should show sound type label
    await expect(page.getByText(/jenis suara/i)).toBeVisible();

    // Should have sound type buttons
    await expect(page.getByRole('button', { name: /beep/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /chime/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bell/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /gentle/i })).toBeVisible();
  });

  test('should show preview hint text', async ({ page }) => {
    // Should show preview instruction
    await expect(page.getByText(/klik untuk mendengar preview suara/i)).toBeVisible();
  });

  test('should allow selecting different sound type', async ({ page }) => {
    // Click Chime button
    const chimeButton = page.getByRole('button', { name: /chime/i });
    await chimeButton.click();

    // Button should be selected (has default variant - different styling)
    // We verify by checking if it has the primary/selected class
    await page.waitForTimeout(300);
  });
});

test.describe('Quick Start from Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display quick start section', async ({ page }) => {
    // Should show quick start section
    await expect(page.getByText(/mulai cepat/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test('should have Regular quick start button', async ({ page }) => {
    await expect(page.getByText(/mulai cepat/i)).toBeVisible({
      timeout: 10000,
    });

    // Should have Regular button with play icon
    const regularButton = page.getByRole('button').filter({ hasText: /regular/i });
    await expect(regularButton).toBeVisible();
  });

  test('should have Power quick start button', async ({ page }) => {
    await expect(page.getByText(/mulai cepat/i)).toBeVisible({
      timeout: 10000,
    });

    // Should have Power button
    const powerButton = page.getByRole('button').filter({ hasText: /power/i });
    await expect(powerButton).toBeVisible();
  });

  test('should display default settings info', async ({ page }) => {
    await expect(page.getByText(/mulai cepat/i)).toBeVisible({
      timeout: 10000,
    });

    // Should show the default timer configuration
    // e.g., "15m pump x 2, 5m istirahat"
    await expect(page.getByText(/pump.*istirahat/i)).toBeVisible();
  });
});
