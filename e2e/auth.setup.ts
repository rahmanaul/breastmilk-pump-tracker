import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'user.json');

/**
 * Auth setup for E2E tests.
 * Creates a test user and saves the authenticated state for reuse.
 */
setup('authenticate', async ({ page }) => {
  // Test user credentials - use unique email for test isolation
  const testEmail = 'e2e-test@example.com';
  const testPassword = 'TestPassword123!';

  // Navigate to the app
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for the login form to be visible
  await expect(page.getByRole('heading', { name: /pump tracker/i })).toBeVisible({
    timeout: 15000,
  });

  // Try to sign in first (user might already exist)
  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/password/i).fill(testPassword);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait a moment for the response
  await page.waitForTimeout(2000);

  // Check if login failed (user doesn't exist) - then sign up
  const errorVisible = await page.getByText(/invalid|error|failed/i).isVisible().catch(() => false);

  if (errorVisible) {
    // Switch to sign up mode
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.waitForTimeout(500);

    // Fill sign up form
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();

    // Wait for redirect after successful sign up
    await page.waitForTimeout(3000);
  }

  // Wait until we're authenticated - should see either onboarding or dashboard
  await expect(
    page.getByText(/pengaturan|selamat datang|onboarding|dashboard/i)
  ).toBeVisible({ timeout: 15000 });

  // If we're on onboarding, complete it
  const isOnboarding = await page.url().then(url => url.includes('onboarding'));
  if (isOnboarding) {
    await completeOnboarding(page);
  }

  // Save the storage state
  await page.context().storageState({ path: authFile });
});

/**
 * Complete the onboarding flow for new users
 */
async function completeOnboarding(page: import('@playwright/test').Page) {
  // Wait for onboarding page to load
  await page.waitForLoadState('networkidle');

  // The onboarding has multiple steps - complete each one
  // Step 1: Welcome - click next/continue
  const nextButton = page.getByRole('button', { name: /lanjut|next|continue/i });
  if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextButton.click();
    await page.waitForTimeout(500);
  }

  // Step 2: Schedule setup - use defaults and continue
  const continueButton = page.getByRole('button', { name: /lanjut|simpan|save|continue/i });
  if (await continueButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await continueButton.click();
    await page.waitForTimeout(500);
  }

  // Step 3: Timer settings - use defaults
  const finishButton = page.getByRole('button', { name: /selesai|finish|mulai|start/i });
  if (await finishButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await finishButton.click();
    await page.waitForTimeout(1000);
  }

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 }).catch(() => {
    // Might already be on dashboard
  });
}
