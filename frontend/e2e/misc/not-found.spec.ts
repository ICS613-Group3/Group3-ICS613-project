import { test, expect } from '../fixtures';

test.describe('NotFoundPage', () => {
  test('shows a 404 page for an unknown route and links back to the dashboard', async ({
    page,
  }) => {
    await page.goto('/this-route-does-not-exist');

    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to Dashboard' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
