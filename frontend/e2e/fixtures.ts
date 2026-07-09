import type { Page } from '@playwright/test';

export { test, expect } from '@playwright/test';

/**
 * The R1 frontend has no real backend yet: LoginPage/RegisterPage set
 * `mockAuthStatus=logged-in` in localStorage after a mock submit, and
 * AppLayout / the protected pages (ProfileSetupPage, EditProfilePage,
 * AccountDeletionPage) read that flag on mount to decide what to show.
 *
 * These helpers reproduce that mock-login state directly so tests that
 * are not specifically exercising the login form itself don't have to
 * re-fill it every time.
 */
export async function loginAsMockUser(page: Page, path = '/dashboard') {
  await page.goto('/login');
  await page.evaluate(() => {
    window.localStorage.setItem('mockAuthStatus', 'logged-in');
  });
  await page.goto(path);
}

export async function logoutMockUser(page: Page) {
  await page.evaluate(() => {
    window.localStorage.removeItem('mockAuthStatus');
  });
}
