import { test, expect, loginAsMockUser } from '../fixtures';

// Covers NotificationsPage (Task 4 notification center) and its sync with
// AppLayout's nav badge / DashboardPage's unread summary card.
// Fixture: 3 mock notifications, 2 unread (notification-1, notification-2)
// and 1 read (notification-3).
test.describe('NotificationsPage', () => {
  test('shows initial total/unread/read summary counts', async ({ page }) => {
    await page.goto('/notifications');

    const summaryCards = page.locator('.notification-summary-grid .summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText('3');
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText('2');
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText('1');
  });

  test('filters to unread and read notifications', async ({ page }) => {
    await page.goto('/notifications');

    await page.getByRole('button', { name: 'Unread (2)' }).click();
    await expect(page.locator('.notification-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'Read (1)' }).click();
    await expect(page.locator('.notification-card')).toHaveCount(1);
  });

  test('marks a single notification as read and updates counts', async ({ page }) => {
    await page.goto('/notifications');

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

  test('marks all notifications as read', async ({ page }) => {
    await page.goto('/notifications');

    await page.getByRole('button', { name: 'Mark All as Read' }).click();

    await expect(page.getByText('All notifications marked as read.')).toBeVisible();
    await expect(page.locator('.notification-card-unread')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark All as Read' })).toBeDisabled();
  });

  test('resetting the demo restores the original unread state', async ({ page }) => {
    await page.goto('/notifications');

    await page.getByRole('button', { name: 'Mark All as Read' }).click();
    await page.getByRole('button', { name: 'Reset Demo' }).click();

    await expect(page.getByText('Notification demo state was reset.')).toBeVisible();
    await expect(
      page.locator('.notification-summary-grid .summary-card').nth(1).locator('.summary-number'),
    ).toHaveText('2');
  });

  test('the nav badge and dashboard unread count reflect read/unread changes', async ({
    page,
  }) => {
    await loginAsMockUser(page, '/notifications');

    await expect(page.locator('.nav-notification-badge')).toHaveText('2');

    await page.getByRole('button', { name: 'Mark All as Read' }).click();

    await expect(page.locator('.nav-notification-badge')).toHaveCount(0);

    await page.goto('/dashboard');
    await expect(
      page.locator('.notification-unread-summary .summary-number'),
    ).toHaveText('0');
  });
});
