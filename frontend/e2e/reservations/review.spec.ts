import { test, expect } from '../fixtures';

// Covers ReviewPage / US24 (leave a rating and review after RETURNED).
//
// Fixture reference (src/data/mockData.ts):
// - reservation-4 is RETURNED (role=owner, Yafei reviews Ivan Wu) -> review allowed.
// - reservation-1 is REQUESTED -> review blocked.
test.describe('ReviewPage', () => {
  test('shows a not-found message for an unknown reservation id', async ({ page }) => {
    await page.goto('/reservations/does-not-exist/review');

    await expect(
      page.getByRole('heading', { name: 'Reservation not found' }),
    ).toBeVisible();
  });

  test('blocks review submission for a reservation that is not RETURNED', async ({
    page,
  }) => {
    await page.goto('/reservations/reservation-1/review');

    await expect(page.getByText('Review blocked:')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Submit Mock Review' })).toBeDisabled();
  });

  test('requires a rating before submission', async ({ page }) => {
    await page.goto('/reservations/reservation-4/review');

    await page.getByRole('button', { name: 'Submit Mock Review' }).click();

    await expect(page.locator('.error-message')).toHaveText(
      'Please select a rating from 1 to 5 stars.',
    );
  });

  test('submits a valid rating and optional comment successfully', async ({ page }) => {
    await page.goto('/reservations/reservation-4/review');

    await page.getByRole('combobox').selectOption('5');
    await page.getByPlaceholder('Optional comment about the borrowing experience').fill(
      'Great borrowing experience.',
    );
    await page.getByRole('button', { name: 'Submit Mock Review' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Mock review submitted for Ivan Wu: 5/5 stars.',
    );
  });

  test('submits successfully with a rating and no comment', async ({ page }) => {
    await page.goto('/reservations/reservation-4/review');

    await page.getByRole('combobox').selectOption('3');
    await page.getByRole('button', { name: 'Submit Mock Review' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Mock review submitted for Ivan Wu: 3/5 stars.',
    );
  });
});
