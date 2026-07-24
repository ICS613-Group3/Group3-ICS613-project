import type { Page } from '@playwright/test';

export { test, expect } from '@playwright/test';

/**
 * Login helper for tests that need an authenticated session.
 *
 * Since the app now talks to a real backend API (not a mock/localStorage-only
 * SPA), this helper calls POST /login to get a real access token and stores
 * it in localStorage the same way the real LoginPage does, so all subsequent
 * API calls are properly authenticated.
 *
 * The seeded test account is used:
 *   email: member02@example.com
 *   password: devpass123
 */
export async function loginAsMockUser(page: Page, path = '/dashboard') {
  await page.goto('/login');
  await page.getByLabel('Email').fill('member02@example.com');
  await page.getByLabel('Password').fill('devpass123');
  await page.getByRole('button', { name: 'Login' }).click();
  // Wait for login to complete and redirect
  await page.waitForURL(/\/dashboard$/);
  // Store the token from the real login into localStorage for subsequent API calls
  const token = await page.evaluate(() => window.localStorage.getItem('access_token'));
  if (!token) {
    throw new Error('Login did not produce an access_token in localStorage');
  }
}

export async function logoutMockUser(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.removeItem('access_token');
    window.localStorage.removeItem('refresh_token');
  });
}
