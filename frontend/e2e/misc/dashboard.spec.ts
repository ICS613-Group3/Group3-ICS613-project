import { test, expect, loginAsMockUser } from '../fixtures';
import { apiGet } from '../api-helpers';

// Covers DashboardPage, the member landing page after login.
test.describe('DashboardPage', () => {
  test('redirects the root path to the dashboard', async ({ page }) => {
    await loginAsMockUser(page);
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows summary counts for tools, reservations, and unread notifications', async ({
    page,
  }) => {
    // Other spec files create/mutate tools, reservations, and notifications
    // against this same live backend, so the exact totals aren't fixed --
    // fetch the real current values and assert the dashboard matches them.
    await loginAsMockUser(page);

    const [toolsData, reservationsData, notificationsData] = await Promise.all([
      apiGet<{ total: number }>(page, '/api/v1/tools?page_size=1'),
      apiGet<{ total: number }>(page, '/api/v1/reservations?page_size=1'),
      apiGet<{ unread_count: number }>(page, '/api/v1/notifications?page_size=1'),
    ]);

    await page.goto('/dashboard');

    const summaryCards = page.locator('.dashboard-summary-grid .summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText(
      String(toolsData.total),
    );
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText(
      String(reservationsData.total),
    );
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText(
      String(notificationsData.unread_count),
    );
  });

  test('navigates to tools, reservations, and notifications via the quick-access cards', async ({
    page,
  }) => {
    await loginAsMockUser(page);
    await page.goto('/dashboard');

    await page.locator('.dashboard-card-link', { hasText: 'Browse Tools' }).click();
    await expect(page).toHaveURL(/\/tools$/);

    await page.goto('/dashboard');
    await page.locator('.dashboard-card-link', { hasText: 'My Reservations' }).click();
    await expect(page).toHaveURL(/\/reservations$/);

    await page.goto('/dashboard');
    await page.locator('.dashboard-card-link', { hasText: 'Notifications' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
  });
});
