import { test, expect } from '../fixtures';
// All tests in this file depend on specific seed review data
// (4 reviews with specific tools/reviewers) that the current seed_dev.py does not create.

// Covers ReviewHistoryPage / US25 (view a member's review history).
// Fixture: 4 mock reviews, 2 "Given" and 2 "Received".
test.describe('ReviewHistoryPage', () => {
  test.fixme('shows all reviews by default', async ({ page }) => {
    await page.goto('/reviews/history');

    await expect(page.getByText('Showing 4 of 4 reviews.')).toBeVisible();
  });

  test.fixme('filters to reviews given', async ({ page }) => {
    await page.goto('/reviews/history');

    await page.getByRole('combobox').selectOption('Given');

    await expect(page.getByText('Showing 2 of 4 reviews.')).toBeVisible();
  });

  test.fixme('filters by search keyword', async ({ page }) => {
    await page.goto('/reviews/history');

    await page.getByPlaceholder('Search by tool, reviewer, target, or comment').fill(
      'Pressure Washer',
    );

    await expect(page.getByText('Showing 1 of 4 reviews.')).toBeVisible();
  });

  test.fixme('shows an empty state when nothing matches, and Clear Filters resets it', async ({
    page,
  }) => {
    await page.goto('/reviews/history');

    await page
      .getByPlaceholder('Search by tool, reviewer, target, or comment')
      .fill('nonexistent tool xyz');

    await expect(page.getByText('No reviews match the current filters.')).toBeVisible();

    // Two "Clear Filters" buttons exist once the empty state renders: one in
    // the filter panel and one in the empty-state card itself.
    await page.getByRole('button', { name: 'Clear Filters' }).first().click();

    await expect(page.getByText('Showing 4 of 4 reviews.')).toBeVisible();
  });

  test.fixme('links back to a review\'s reservation detail page', async ({ page }) => {
    await page.goto('/reviews/history');

    await page
      .locator('.review-history-card', { hasText: 'Pressure Washer' })
      .getByRole('link', { name: 'View Reservation' })
      .click();

    await expect(page).toHaveURL(/\/reservations\/reservation-4$/);
  });
});
