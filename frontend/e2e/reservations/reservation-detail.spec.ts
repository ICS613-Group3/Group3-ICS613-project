import { test, expect, loginAsMockUser } from '../fixtures';
import { findReservationByToolName } from '../api-helpers';

// Covers ReservationDetailPage (US14 approve/deny, US15/US16 cancel,
// US17 confirm pickup, US20 confirm return).
//
// Fixture (scripts/seed_dev.py), all with member02 as the seeded e2e login
// (e2e/fixtures.ts loginAsMockUser):
// - Cordless Drill: REQUESTED, member02 is borrower -> "Cancel Request".
// - Hammer: REQUESTED, member02 is owner -> "Approve Request" / "Deny Request".
// - Ladder: PICKED_UP, member02 is borrower -> "Confirm Return".
// - Circular Saw: RETURNED, member02 is borrower, not yet reviewed -> "Leave Review".
test.describe('ReservationDetailPage', () => {
  test('shows a not-found message for an unknown reservation id', async ({ page }) => {
    await loginAsMockUser(page, '/reservations/00000000-0000-0000-0000-000000000000');

    await expect(
      page.getByRole('heading', { name: 'We could not find this reservation.' }),
    ).toBeVisible();
  });

  test('borrower can cancel a REQUESTED reservation', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Cordless Drill');

    await page.goto(`/reservations/${reservation.id}`);
    await page.getByLabel('Cancellation reason:').fill('Change of plans');
    await page.getByRole('button', { name: 'Cancel Request' }).click();

    await expect(page.getByText('Request cancelled.')).toBeVisible();
    await expect(page.locator('.workflow-status')).toHaveText('CANCELLED');
  });

  test('owner can approve or deny a REQUESTED reservation', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Hammer');

    await page.goto(`/reservations/${reservation.id}`);
    await expect(page.getByRole('button', { name: 'Approve Request' })).toBeVisible();
    await page.getByRole('button', { name: 'Deny Request' }).click();

    await expect(page.getByText('Reservation denied.')).toBeVisible();
    await expect(
      page.getByText('This reservation is closed. No further action is available.'),
    ).toBeVisible();
  });

  test('borrower can confirm return on a PICKED_UP reservation', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Ladder');

    await page.goto(`/reservations/${reservation.id}`);
    await page.getByRole('button', { name: 'Confirm Return' }).click();

    await expect(page.locator('.workflow-status')).toHaveText('RETURNED');
    await expect(page.getByRole('link', { name: 'Leave Review' })).toBeVisible();
  });

  test('a RETURNED reservation links to the review page', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Circular Saw');

    await page.goto(`/reservations/${reservation.id}`);
    await page.getByRole('link', { name: 'Leave Review' }).click();

    await expect(page).toHaveURL(new RegExp(`/reservations/${reservation.id}/review$`));
  });

  test.fixme(
    'shows the US18 overdue notice and lets the owner mock-apply the auto-cancel',
    async () => {
      // Not implemented: ReservationDetailPage has no overdue-specific UI at
      // all (no "Pickup is overdue" notice, no manual auto-cancel trigger).
      // The real auto-cancel is a backend scheduler job with no client-side
      // equivalent -- see US18's backend acceptance tests instead.
    },
  );
});
