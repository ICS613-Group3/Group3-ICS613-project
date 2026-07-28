import { test, expect, loginAsMockUser } from '../fixtures';
import { findReservationByToolName, clearOwnReview } from '../api-helpers';

// Covers ReviewPage / US24 (leave a rating and review after RETURNED).
//
// Fixture (scripts/seed_dev.py), member02 as borrower:
// - Cordless Drill: REQUESTED -> review blocked.
// - Wrench: RETURNED, not yet reviewed -> used for the rating-required
//   check (doesn't submit) and the "with comment" submission.
// - Circular Saw: RETURNED, not yet reviewed -> used for the "no comment"
//   submission (kept separate from Wrench since each reservation can only
//   be reviewed once per reviewer).
test.describe('ReviewPage', () => {
  test('shows a not-found message for an unknown reservation id', async ({ page }) => {
    await loginAsMockUser(page, '/reservations/00000000-0000-0000-0000-000000000000/review');

    await expect(page.getByRole('heading', { name: 'Unable to Load Review' })).toBeVisible();
    await expect(page.getByText('Reservation not found')).toBeVisible();
  });

  test('blocks review submission for a reservation that is not RETURNED', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Cordless Drill');

    await page.goto(`/reservations/${reservation.id}/review`);

    await expect(page.getByText('Review blocked:')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Submit Review' })).toBeDisabled();
  });

  test('requires a rating before submission', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Wrench');

    await page.goto(`/reservations/${reservation.id}/review`);
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'Please select a rating from 1 to 5 stars.',
    );
  });

  test('submits a valid rating and optional comment successfully', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Wrench');
    // Retry-safe: a prior attempt of this same test may have already
    // submitted this review against the shared backend.
    await clearOwnReview(page, reservation.id);

    await page.goto(`/reservations/${reservation.id}/review`);
    await page.getByRole('combobox').selectOption('5');
    await page
      .getByPlaceholder('Optional comment about the borrowing experience')
      .fill('Great borrowing experience.');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect(page.locator('.success-message')).toContainText('Review submitted successfully.');
  });

  test('submits successfully with a rating and no comment', async ({ page }) => {
    await loginAsMockUser(page);
    const reservation = await findReservationByToolName(page, 'Circular Saw');
    // Retry-safe: a prior attempt of this same test may have already
    // submitted this review against the shared backend.
    await clearOwnReview(page, reservation.id);

    await page.goto(`/reservations/${reservation.id}/review`);
    await page.getByRole('combobox').selectOption('3');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect(page.locator('.success-message')).toContainText('Review submitted successfully.');
  });
});
