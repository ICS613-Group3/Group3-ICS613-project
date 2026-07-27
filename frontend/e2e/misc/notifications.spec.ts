import { test, expect, loginAsMockUser } from '../fixtures';

// Covers NotificationsPage (Task 4 notification center) and its sync with
// AppLayout's nav badge / DashboardPage's unread summary card.
//
// Fixture (scripts/seed_dev.py): member02 has 3 notifications, 2 unread and
// 1 read. Tests in this file run in order and share that seeded state
// (there's no per-test database reset in e2e), so later tests build on the
// mutations of earlier ones rather than re-asserting the original counts.
test.describe.serial('NotificationsPage', () => {
  test('shows initial total/unread/read summary counts', async ({ page }) => {
    await loginAsMockUser(page, '/notifications');

    const summaryCards = page.locator('.notification-summary-grid .summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText('3');
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText('2');
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText('1');
  });

  test('filters to unread and read notifications', async ({ page }) => {
    await loginAsMockUser(page, '/notifications');

    await page.getByRole('button', { name: 'Unread (2)' }).click();
    await expect(page.locator('.notification-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'Read (1)' }).click();
    await expect(page.locator('.notification-card')).toHaveCount(1);
  });

  test('marks a single notification as read and updates counts', async ({ page }) => {
    await loginAsMockUser(page, '/notifications');

    await page
      .locator('.notification-card-unread')
      .first()
      .getByRole('button', { name: 'Mark as Read' })
      .click();

    await expect(page.getByText('Notification marked as read.')).toBeVisible();
    await expect(
      page.locator('.notification-summary-grid .summary-card').nth(1).locator('.summary-number'),
    ).toHaveText('1');
  });

  test('marks all remaining notifications as read and syncs the nav badge and dashboard', async ({
    page,
  }) => {
    // One unread notification remains from the previous test.
    await loginAsMockUser(page, '/notifications');
    await expect(page.locator('.nav-notification-badge')).toHaveText('1');

    await page.getByRole('button', { name: 'Mark All as Read' }).click();

    await expect(page.getByText('All notifications marked as read.')).toBeVisible();
    await expect(page.locator('.notification-card-unread')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark All as Read' })).toBeDisabled();
    await expect(page.locator('.nav-notification-badge')).toHaveCount(0);

    await page.goto('/dashboard');
    await expect(page.locator('.notification-unread-summary .summary-number')).toHaveText('0');
  });

  test.fixme(
    'resetting the demo restores the original unread state',
    async () => {
      // Not implemented: NotificationsPage has no "Reset Demo" concept in the
      // real app -- that was an R1 mock-only affordance for replaying the
      // demo. Notifications are now real backend rows with no reset action.
    },
  );
});
