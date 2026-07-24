import { test, expect } from '../fixtures';
// All tests in this file depend on mock tool data (5 specific tools,
// hardcoded IDs like 'tool-1') that the current seed_dev.py does not create
// in the same format.

// Covers AvailableToolsPage / BrowseToolsPage (US12 browse & search).
// This page reads mock tool data and does not gate on auth in R1.
test.describe('AvailableToolsPage', () => {
  test.fixme('shows all 5 mock tools by default', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.getByText('Showing 5 of 5 tools.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cordless Drill' })).toBeVisible();
  });

  test.fixme('filters by search keyword', async ({ page }) => {
    await page.goto('/tools');

    await page.getByPlaceholder('Search by tool, owner, or keyword').fill('Ladder');

    await expect(page.getByText('Showing 1 of 5 tools.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Step Ladder' })).toBeVisible();
  });

  test.fixme('filters by category', async ({ page }) => {
    await page.goto('/tools');

    await page.getByRole('combobox').first().selectOption('GARDEN_TOOLS');

    await expect(page.getByText('Showing 1 of 5 tools.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Garden Shovel' })).toBeVisible();
  });

  test.fixme('shows an empty state and clears filters when nothing matches', async ({
    page,
  }) => {
    await page.goto('/tools');

    await page
      .getByPlaceholder('Search by tool, owner, or keyword')
      .fill('no such tool exists');

    await expect(page.getByText('No tools match the current filters.')).toBeVisible();

    await page.getByRole('button', { name: 'Clear Filters' }).first().click();

    await expect(page.getByText('Showing 5 of 5 tools.')).toBeVisible();
  });

  test.fixme('links to the tool detail page', async ({ page }) => {
    await page.goto('/tools');

    await page
      .locator('.tool-card', { hasText: 'Cordless Drill' })
      .getByRole('link', { name: 'View Details' })
      .click();

    await expect(page).toHaveURL(/\/tools\/tool-1$/);
  });
});

// Covers ReturnedToolsPage (US24 entry point via /tools?view=returned).
test.describe('ReturnedToolsPage', () => {
  test.fixme('shows returned tools with a review link', async ({ page }) => {
    await page.goto('/tools?view=returned');

    await expect(page.getByRole('heading', { name: 'Returned Tools' })).toBeVisible();
    await expect(page.getByText(/Showing \d+ of \d+ returned tools\./)).toBeVisible();

    const firstReviewLink = page
      .getByRole('link', { name: 'Review This Tool' })
      .first();
    await expect(firstReviewLink).toHaveAttribute(
      'href',
      '/reservations/reservation-4/review',
    );
  });
});
