import { test, expect } from '../fixtures';
// All tests in this file depend on specific seed data (listing counts,
// tool names, PICKED_UP reservations) that the current seed_dev.py does not create.

// Covers AdminListingsPage / US11 (admin deactivate/reactivate controls).
//
// Fixture reference (src/data/mockData.ts):
// - tool-4 "Pressure Washer" starts DEACTIVATED in this mock page's initial state.
// - tool-3 "Step Ladder" has an active PICKED_UP reservation, blocking deactivation.
// - tool-1 "Cordless Drill" is active with a REQUESTED reservation (auto-cancel candidate).
test.describe('AdminListingsPage', () => {
  test.fixme('shows summary counts for total, active, deactivated, and PICKED_UP-blocked listings', async ({
    page,
  }) => {
    await page.goto('/admin/listings');

    const summaryCards = page.locator('.admin-listing-summary-grid .summary-card');
    await expect(summaryCards.nth(0)).toContainText('5');
    await expect(summaryCards.nth(1)).toContainText('4');
    await expect(summaryCards.nth(2)).toContainText('1');
    await expect(summaryCards.nth(3)).toContainText('1');
  });

  test.fixme('a listing with a PICKED_UP reservation cannot be deactivated', async ({
    page,
  }) => {
    await page.goto('/admin/listings');

    const stepLadderCard = page.locator('.admin-listing-card', {
      hasText: 'Step Ladder',
    });

    await expect(
      stepLadderCard.getByText('This listing cannot be deactivated while a reservation is'),
    ).toBeVisible();
    await expect(stepLadderCard.getByRole('button', { name: 'Deactivate' })).toBeDisabled();
  });

  test.fixme('requires a reason before deactivating a listing', async ({ page }) => {
    await page.goto('/admin/listings');

    const drillCard = page.locator('.admin-listing-card', {
      hasText: 'Cordless Drill',
    });

    await drillCard.getByRole('button', { name: 'Deactivate' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'A deactivation reason is required.',
    );
  });

  test.fixme('deactivates a listing with a reason and notes auto-cancel candidates', async ({
    page,
  }) => {
    await page.goto('/admin/listings');

    const drillCard = page.locator('.admin-listing-card', {
      hasText: 'Cordless Drill',
    });

    await drillCard
      .getByLabel('Deactivation Reason')
      .fill('Reported as unsafe by a member.');
    await drillCard.getByRole('button', { name: 'Deactivate' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Mock admin deactivated Cordless Drill.',
    );
    await expect(page.locator('.form-success')).toContainText(
      'REQUESTED/APPROVED reservation(s) would be auto-cancelled',
    );
    await expect(drillCard.locator('.admin-listing-status')).toHaveText('deactivated');

    // A frontend-only audit log entry should be recorded for this action.
    await expect(
      page.locator('.admin-audit-log-card tbody tr').first(),
    ).toContainText('DEACTIVATED');
  });

  test.fixme('reactivates an already-deactivated listing', async ({ page }) => {
    await page.goto('/admin/listings');

    const pressureWasherCard = page.locator('.admin-listing-card', {
      hasText: 'Pressure Washer',
    });

    await expect(pressureWasherCard.locator('.admin-listing-status')).toHaveText(
      'deactivated',
    );

    await pressureWasherCard.getByRole('button', { name: 'Reactivate' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Mock admin reactivated Pressure Washer.',
    );
    await expect(pressureWasherCard.locator('.admin-listing-status')).toHaveText('active');
  });

  test.fixme('filters listings by search text', async ({ page }) => {
    await page.goto('/admin/listings');

    await page.getByLabel('Search Listings').fill('Garden Shovel');

    await expect(page.locator('.admin-listing-card')).toHaveCount(1);
    await expect(page.locator('.admin-listing-card')).toContainText('Garden Shovel');
  });

  test.fixme('filters listings by status', async ({ page }) => {
    await page.goto('/admin/listings');

    await page.getByLabel('Status Filter').selectOption('deactivated');

    await expect(page.locator('.admin-listing-card')).toHaveCount(1);
    await expect(page.locator('.admin-listing-card')).toContainText('Pressure Washer');
  });
});
