import { test, expect } from '../fixtures';

// Covers ReservationsPage (US21 view reservation history, US18 auto-cancel
// overdue pickup indicator).
//
// Fixture reference (src/data/mockData.ts + mockTodayHst = 2026-07-08):
// - 5 total reservations: 4 active (REQUESTED/APPROVED/PICKED_UP), 1 RETURNED.
// - reservation-2 is APPROVED with startDate 2026-07-04, so its 3-day grace
//   deadline (2026-07-07) has already passed -> it's the one overdue reservation.
test.describe('ReservationsPage', () => {
  test('shows summary counts for total, active, completed, and overdue reservations', async ({
    page,
  }) => {
    await page.goto('/reservations');

    await expect(page.getByText('Total Reservations')).toBeVisible();

    const summaryCards = page.locator('.summary-card');
    await expect(summaryCards.nth(0).locator('.summary-number')).toHaveText('5');
    await expect(summaryCards.nth(1).locator('.summary-number')).toHaveText('4');
    await expect(summaryCards.nth(2).locator('.summary-number')).toHaveText('1');
    await expect(summaryCards.nth(3).locator('.summary-number')).toHaveText('1');
  });

  test('shows an overdue pickup notice on the affected reservation card', async ({
    page,
  }) => {
    await page.goto('/reservations');

    const gardenShovelCard = page.locator('.reservation-card', {
      hasText: 'Garden Shovel',
    });

    await expect(
      gardenShovelCard.getByText('Overdue pickup - auto-cancel notice'),
    ).toBeVisible();
  });

  test('links each card to its reservation detail page', async ({ page }) => {
    await page.goto('/reservations');

    await page
      .locator('.reservation-card', { hasText: 'Cordless Drill' })
      .getByRole('link', { name: 'View Reservation' })
      .click();

    await expect(page).toHaveURL(/\/reservations\/reservation-1$/);
  });
});
