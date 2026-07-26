import { test, expect } from '../fixtures';
// All tests in this file depend on specific seed reservation data
// (5 reservations with hardcoded IDs like 'reservation-1') that the
// current seed_dev.py does not create.

// Covers ReservationDetailPage (US14 approve/deny, US15/US16 cancel,
// US17 confirm pickup, US18 auto-cancel, US20 confirm return).
//
// Fixture reference (src/data/mockData.ts), each reservation's mock "role"
// determines which action buttons this frontend-only demo shows:
// - reservation-1 tool-1, REQUESTED, role=borrower -> "Cancel Request".
// - reservation-2 tool-2, APPROVED, role=owner, overdue -> "Cancel
//   Reservation" + "Mock Auto-Cancel Overdue Pickup".
// - reservation-3 tool-3, PICKED_UP, role=borrower -> "Confirm Return".
// - reservation-4 tool-4, RETURNED, role=owner -> "Leave Review" link.
// - reservation-5 tool-5, REQUESTED, role=owner -> "Approve Request" / "Deny Request".
test.describe('ReservationDetailPage', () => {
  test.fixme('shows a not-found message for an unknown reservation id', async ({ page }) => {
    await page.goto('/reservations/does-not-exist');

    await expect(
      page.getByRole('heading', { name: 'We could not find this reservation.' }),
    ).toBeVisible();
  });

  test.fixme('borrower can cancel a REQUESTED reservation', async ({ page }) => {
    await page.goto('/reservations/reservation-1');

    await page.getByRole('button', { name: 'Cancel Request' }).click();

    await expect(page.getByText('Request cancelled. Status changed to CANCELLED.')).toBeVisible();
    await expect(page.locator('.workflow-status')).toHaveText('CANCELLED');
  });

  test.fixme('owner can approve or deny a REQUESTED reservation', async ({ page }) => {
    await page.goto('/reservations/reservation-5');

    await expect(page.getByRole('button', { name: 'Approve Request' })).toBeVisible();
    await page.getByRole('button', { name: 'Deny Request' }).click();

    await expect(page.getByText('Reservation denied. Status changed to DENIED.')).toBeVisible();
    await expect(
      page.getByText('This reservation is closed. No further action is available.'),
    ).toBeVisible();
  });

  test.fixme('shows the US18 overdue notice and lets the owner mock-apply the auto-cancel', async ({
    page,
  }) => {
    await page.goto('/reservations/reservation-2');

    await expect(page.getByRole('heading', { name: 'Pickup is overdue' })).toBeVisible();

    await page
      .getByRole('button', { name: 'Mock Auto-Cancel Overdue Pickup' })
      .click();

    await expect(page.locator('.workflow-status')).toHaveText('CANCELLED');
  });

  test.fixme('borrower can confirm return on a PICKED_UP reservation', async ({ page }) => {
    await page.goto('/reservations/reservation-3');

    await page.getByRole('button', { name: 'Confirm Return' }).click();

    await expect(page.locator('.workflow-status')).toHaveText('RETURNED');
    await expect(page.getByRole('link', { name: 'Leave Review' })).toBeVisible();
  });

  test.fixme('a RETURNED reservation links to the review page', async ({ page }) => {
    await page.goto('/reservations/reservation-4');

    await page.getByRole('link', { name: 'Leave Review' }).click();

    await expect(page).toHaveURL(/\/reservations\/reservation-4\/review$/);
  });
});
