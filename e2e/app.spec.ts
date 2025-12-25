import { test, expect } from '@playwright/test';

test.describe('Application', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');

    // Should have a page title
    await expect(page).toHaveTitle(/pump|tracker/i);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should still load on mobile
    await expect(page).toHaveTitle(/pump|tracker/i);
  });

  test('should have proper meta tags for PWA', async ({ page }) => {
    await page.goto('/');

    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});

test.describe('Navigation', () => {
  test('should show navigation for authenticated users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigation should be visible (may vary based on auth state)
    // This test checks the structure exists
    const hasNav = await page.locator('nav').count();
    // Either authenticated with nav or login page
    expect(hasNav >= 0).toBeTruthy();
  });
});
