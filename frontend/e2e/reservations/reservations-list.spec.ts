import { test, expect, loginAsMockUser } from '../fixtures';
import { apiGet, type PaginatedResult, type ReservationSummary } from '../api-helpers';

const ACTIVE_STATES = new Set(['REQUESTED', 'APPROVED', 'PICKED_UP']);

// Covers ReservationsPage (US21 view reservation history).
//
// The real page has 3 summary cards (Total, Active, Completed or Closed) --
// there is no overdue-specific summary card or per-card overdue notice in
// the current UI (see the fixme below). Other spec files mutate reservation
// states on this same live backend, so counts are fetched from the API
// rather than hardcoded.
test.describe('ReservationsPage', () => {
  test('shows summary counts for total, active, and completed reservations', async ({ page }) => {
    await loginAsMockUser(page);
    const data = await apiGet<PaginatedResult<ReservationSummary>>(
      page,
      '/api/v1/reservations?page_size=100',
    );
    const activeCount = data.items.filter((r) => ACTIVE_STATES.has(r.state)).length;
    const completedCount = data.items.length - activeCount;

    await page.goto('/reservations');

    await expect(page.getByText('Total Reservations')).toBeVisible();

    const summaryCards = page.locator('.summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText(
      String(data.total),
    );
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText(
      String(activeCount),
    );
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText(
      String(completedCount),
    );
  });

  test('links each card to its reservation detail page', async ({ page }) => {
    await loginAsMockUser(page, '/reservations');

    await page
      .locator('.reservation-card', { hasText: 'Cordless Drill' })
      .getByRole('link', { name: 'View Reservation' })
      .click();

    await expect(page).toHaveURL(/\/reservations\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Cordless Drill', level: 1 })).toBeVisible();
  });

  test.fixme(
    'shows an overdue pickup notice on the affected reservation card',
    async () => {
      // Not implemented: ReservationsPage has no overdue-specific summary
      // card or per-card notice at all -- it only renders Total/Active/
      // Completed counts and each card's own status badge. See US18/US19
      // for the broader HST/overdue-handling gaps this depends on.
    },
  );
});
