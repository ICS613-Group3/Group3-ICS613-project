import { test, expect, loginAsMockUser } from '../fixtures';
import { apiGet } from '../api-helpers';

// Covers ReviewHistoryPage / US25 (view a member's review history).
//
// Fixture (scripts/seed_dev.py): member02 has reviews from two dual-reviewed
// returned reservations (Tape Measure, Rake) -- 2 "given" (member02 reviewed
// the owner) and 2 "received" (the owner reviewed member02). Other spec
// files (e.g. reservations/review.spec.ts) submit further reviews for
// member02 against this same live backend, so totals are fetched from the
// API rather than hardcoded.
test.describe('ReviewHistoryPage', () => {
  test('shows all reviews by default', async ({ page }) => {
    await loginAsMockUser(page);
    const [given, received] = await Promise.all([
      apiGet<{ total: number }>(page, '/api/v1/users/me/reviews?role=given&page_size=1'),
      apiGet<{ total: number }>(page, '/api/v1/users/me/reviews?role=received&page_size=1'),
    ]);
    const total = given.total + received.total;

    await page.goto('/reviews/history');

    await expect(page.getByText(`Showing ${total} of ${total} reviews.`)).toBeVisible();
  });

  test('filters to reviews given', async ({ page }) => {
    await loginAsMockUser(page);
    const given = await apiGet<{ total: number }>(
      page,
      '/api/v1/users/me/reviews?role=given&page_size=1',
    );

    await page.goto('/reviews/history');

    await page.getByRole('combobox').selectOption('given');

    // Filtering by role re-fetches just that role's reviews, so both the
    // shown and total counts reflect the "given" bucket alone.
    await expect(
      page.getByText(`Showing ${given.total} of ${given.total} reviews.`),
    ).toBeVisible();
  });

  test('filters by search keyword', async ({ page }) => {
    await loginAsMockUser(page, '/reviews/history');

    // "loose" appears only in the seeded Rake review's comment.
    await page.getByPlaceholder('Search by comment text').fill('loose');

    await expect(page.getByText(/^Showing 1 of \d+ reviews\.$/)).toBeVisible();
    await expect(page.locator('.review-history-card')).toHaveCount(1);
  });

  test('shows an empty state when nothing matches, and Clear Filters resets it', async ({
    page,
  }) => {
    await loginAsMockUser(page);
    const [given, received] = await Promise.all([
      apiGet<{ total: number }>(page, '/api/v1/users/me/reviews?role=given&page_size=1'),
      apiGet<{ total: number }>(page, '/api/v1/users/me/reviews?role=received&page_size=1'),
    ]);
    const total = given.total + received.total;

    await page.goto('/reviews/history');

    await page.getByPlaceholder('Search by comment text').fill('nonexistent review xyz');

    await expect(page.getByText('No reviews match the current filters.')).toBeVisible();

    // Two "Clear Filters" buttons exist once the empty state renders: one in
    // the filter panel and one in the empty-state card itself.
    await page.getByRole('button', { name: 'Clear Filters' }).first().click();

    await expect(page.getByText(`Showing ${total} of ${total} reviews.`)).toBeVisible();
  });

  test("links back to a review's reservation detail page", async ({ page }) => {
    await loginAsMockUser(page, '/reviews/history');

    await page.getByPlaceholder('Search by comment text').fill('loose');
    await page
      .locator('.review-history-card')
      .getByRole('link', { name: 'View Reservation' })
      .click();

    await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Rake', level: 1 })).toBeVisible();
  });
});
