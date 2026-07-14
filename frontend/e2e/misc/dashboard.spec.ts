import { test, expect } from '../fixtures';

// Covers DashboardPage, the member landing page after login.
// Fixture: 5 mock tools, 5 mock reservations, 2 unread notifications.
test.describe('DashboardPage', () => {
  test('redirects the root path to the dashboard', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows summary counts for tools, reservations, and unread notifications', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const summaryCards = page.locator('.dashboard-summary-grid .summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText('5');
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText('5');
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText('2');
  });

  test('navigates to tools, reservations, and notifications via the quick-access cards', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await page.locator('.dashboard-card-link', { hasText: 'My Tools' }).click();
    await expect(page).toHaveURL(/\/tools$/);

    await page.goto('/dashboard');
    await page.locator('.dashboard-card-link', { hasText: 'My Reservations' }).click();
    await expect(page).toHaveURL(/\/reservations$/);

    await page.goto('/dashboard');
    await page.locator('.dashboard-card-link', { hasText: 'Notifications' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
  });
});
