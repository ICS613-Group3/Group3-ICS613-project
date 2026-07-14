import { test, expect } from '../fixtures';

// Covers EditToolPage / US9 + US10 (frontend issues #114, #115, #118, #120,
// #122 and the US10 delete/deactivate/reactivate flows).
//
// Fixture reference (src/data/mockData.ts):
// - tool-1 "Cordless Drill": owner user-2, has an active REQUESTED reservation.
// - tool-3 "Step Ladder": hardcoded as the "currently PICKED_UP" edit-blocked demo tool.
// - tool-5 "Hammer Set": owned by the current mock user (user-1), has an
//   active REQUESTED reservation (reservation-5) that blocks delete/deactivate
//   until the "pretend resolved" demo checkbox is checked.
test.describe('EditToolPage', () => {
  test('shows a not-found message for an unknown tool id', async ({ page }) => {
    await page.goto('/tools/does-not-exist/edit');

    await expect(page.getByRole('heading', { name: 'Tool not found' })).toBeVisible();
  });

  test('saves an edit successfully for an unblocked listing', async ({ page }) => {
    await page.goto('/tools/tool-1/edit');

    await page.getByLabel('Tool Name *').fill('Cordless Drill Updated');
    await page.getByRole('button', { name: 'Save Mock Changes' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Mock update saved for Cordless Drill Updated',
    );
  });

  test('rejects a blank tool name', async ({ page }) => {
    await page.goto('/tools/tool-1/edit');

    await page.getByLabel('Tool Name *').fill('');
    await page.getByRole('button', { name: 'Save Mock Changes' }).click();

    await expect(page.locator('.form-error')).toHaveText('Tool name is required.');
  });

  test('rejects renaming to a name already used by another listing (#120)', async ({
    page,
  }) => {
    await page.goto('/tools/tool-1/edit');

    await page.getByLabel('Tool Name *').fill('Garden Shovel');
    await page.getByRole('button', { name: 'Save Mock Changes' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'A tool listing with this name already exists',
    );
  });

  test('blocks all edits while the tool is PICKED_UP', async ({ page }) => {
    await page.goto('/tools/tool-3/edit');

    await expect(page.getByText('Edit blocked for demo:')).toBeVisible();
    await expect(page.getByLabel('Tool Name *')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save Mock Changes' })).toBeDisabled();
  });

  test('cannot remove the last remaining photo', async ({ page }) => {
    await page.goto('/tools/tool-1/edit');

    await page.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'At least one photo is required for the listing.',
    );
  });

  test('rejects an invalid photo URL', async ({ page }) => {
    await page.goto('/tools/tool-1/edit');

    await page.getByPlaceholder('Paste photo URL').fill('not-a-url');
    await page.getByRole('button', { name: 'Add Photo URL' }).click();

    await expect(page.locator('.form-error')).toContainText('valid photo URL');
  });

  test('shows an owner-only warning for a listing owned by someone else', async ({
    page,
  }) => {
    await page.goto('/tools/tool-1/edit');

    await expect(page.getByText('Owner-only action:')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Deactivate Listing' }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Delete Listing' })).toBeDisabled();
  });

  test('blocks deactivate/delete for the owner while active reservations exist, then allows it once resolved', async ({
    page,
  }) => {
    await page.goto('/tools/tool-5/edit');

    // Owner-only warning should not show for the owner's own listing.
    await expect(page.getByText('Owner-only action:')).toHaveCount(0);

    await expect(
      page.getByRole('button', { name: 'Deactivate Listing' }),
    ).toBeEnabled();

    await page.getByLabel('Deactivation Reason *').fill('Testing deactivation.');
    await page.getByRole('button', { name: 'Deactivate Listing' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'cannot be deactivated because it has active reservations',
    );

    // Resolve the demo-only active reservation block, then retry.
    await page
      .getByLabel('Demo only: pretend active reservations are resolved')
      .check();

    await page.getByLabel('Deactivation Reason *').fill('Testing deactivation.');
    await page.getByRole('button', { name: 'Deactivate Listing' }).click();

    await expect(page.locator('.success-message')).toContainText('deactivated');
    await expect(page.getByText('Mock Listing Status: DEACTIVATED')).toBeVisible();

    // Reactivate flips the banner back.
    await page.getByRole('button', { name: 'Reactivate Mock Listing' }).click();
    await expect(page.getByText('Mock Listing Status: ACTIVE')).toBeVisible();
  });

  test('owner can delete the listing after typing DELETE', async ({ page }) => {
    await page.goto('/tools/tool-5/edit');

    await page
      .getByLabel('Demo only: pretend active reservations are resolved')
      .check();

    await page.getByLabel('Type DELETE to confirm deletion').fill('DELETE');
    await page.getByRole('button', { name: 'Delete Listing' }).click();

    await expect(page.locator('.success-message')).toContainText('Mock listing deleted');
    await expect(page.getByText('Mock Listing Status: DELETED')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Mock Changes' })).toBeDisabled();
  });
});
