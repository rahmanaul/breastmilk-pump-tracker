import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show login page for unauthenticated users', async ({ page }) => {
    // Should redirect to login or show login form
    await expect(page.getByRole('heading', { name: /masuk|login|sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('should have register link', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Should have a way to navigate to registration
    const registerLink = page.getByRole('link', { name: /daftar|register|sign up/i });
    await expect(registerLink).toBeVisible({ timeout: 10000 });
  });

  test('should show password input field', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should have password input
    const passwordInput = page.getByLabel(/password|kata sandi/i);
    await expect(passwordInput).toBeVisible({ timeout: 10000 });
  });

  test('should show email input field', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Should have email input
    const emailInput = page.getByLabel(/email/i);
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Fill in invalid credentials
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/password|kata sandi/i).fill('wrongpassword');

    // Submit the form
    await page.getByRole('button', { name: /masuk|login|sign in/i }).click();

    // Should show error message
    await expect(page.getByText(/invalid|salah|gagal|error/i)).toBeVisible({ timeout: 5000 });
  });
});
