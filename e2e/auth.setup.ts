import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

  // Wait for the login form to be visible (Pump Tracker text is in a generic element, not heading)
  await expect(page.getByText(/pump tracker/i)).toBeVisible({
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

  // Wait until we're authenticated - check for dashboard heading or onboarding welcome
  // Wait for network to settle first
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Check what page we're on
  const dashboardHeading = page.getByRole('heading', { name: /hari ini/i });
  const onboardingWelcome = page.getByText('Selamat Datang!');

  const isDashboard = await dashboardHeading.isVisible().catch(() => false);
  const isOnboardingVisible = await onboardingWelcome.isVisible().catch(() => false);

  if (!isDashboard && !isOnboardingVisible) {
    // Try waiting a bit more
    await page.waitForTimeout(3000);
  }

  // If we're on onboarding, complete it
  const isOnboarding = isOnboardingVisible || page.url().includes('onboarding');
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
  // Keep clicking the primary action button until we're done or redirected
  for (let step = 0; step < 5; step++) {
    // Look for any primary action button (Mulai, Lanjut, Simpan, Selesai, etc.)
    const actionButton = page.getByRole('button', { name: /mulai|lanjut|next|continue|simpan|save|selesai|finish/i });

    if (await actionButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await actionButton.click();
      await page.waitForTimeout(1000);

      // Check if we're redirected to dashboard
      if (!page.url().includes('onboarding')) {
        break;
      }
    } else {
      // No more buttons to click
      break;
    }
  }

  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10000 }).catch(() => {
    // Might already be on dashboard or still completing
  });
}
