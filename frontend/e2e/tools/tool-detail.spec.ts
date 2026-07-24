import { test, expect } from '../fixtures';
// All tests in this file depend on hardcoded tool IDs (e.g. 'tool-1')
// and mock reservation data.

// Covers ToolDetailPage (US12 detail view, US13 mock reservation request
// with frontend-only conflict detection).
//
// Fixture reference (src/data/mockData.ts):
// - tool-1 "Cordless Drill": available 2026-07-01 to 2026-07-10, with an
//   active REQUESTED reservation for 2026-07-01 to 2026-07-03 (reservation-1).
test.describe('ToolDetailPage', () => {
  test.fixme('shows a not-found message for an unknown tool id', async ({ page }) => {
    await page.goto('/tools/does-not-exist');

    await expect(page.getByRole('heading', { name: 'We could not find this tool.' })).toBeVisible();
  });

  test.fixme('shows full tool details', async ({ page }) => {
    await page.goto('/tools/tool-1');

    await expect(
      page.getByRole('heading', { name: 'Cordless Drill', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Rion Sawabe')).toBeVisible();
    await expect(page.getByText('Please return with the battery charged.')).toBeVisible();
  });

  test.fixme('submits a mock reservation request for available dates', async ({ page }) => {
    await page.goto('/tools/tool-1');

    await page.getByLabel('Start Date (HST)').fill('2026-07-05');
    await page.getByLabel('End Date (HST)').fill('2026-07-06');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Mock request submitted for Cordless Drill',
    );
  });

  test.fixme('rejects an end date before the start date', async ({ page }) => {
    await page.goto('/tools/tool-1');

    await page.getByLabel('Start Date (HST)').fill('2026-07-06');
    await page.getByLabel('End Date (HST)').fill('2026-07-05');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'End date cannot be before start date.',
    );
  });

  test.fixme('rejects dates outside the tool availability window', async ({ page }) => {
    await page.goto('/tools/tool-1');

    await page.getByLabel('Start Date (HST)').fill('2026-06-01');
    await page.getByLabel('End Date (HST)').fill('2026-06-05');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'must be within the tool availability window',
    );
  });

  test.fixme('rejects a date range that conflicts with an active reservation and mentions 409 Conflict', async ({
    page,
  }) => {
    await page.goto('/tools/tool-1');

    // reservation-1 already covers 2026-07-01 to 2026-07-03 for tool-1.
    await page.getByLabel('Start Date (HST)').fill('2026-07-02');
    await page.getByLabel('End Date (HST)').fill('2026-07-04');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'Tool is not available for those dates',
    );
    await expect(page.locator('.form-error')).toContainText('409 Conflict');
  });

  test.fixme('links to the edit tool listing page', async ({ page }) => {
    await page.goto('/tools/tool-1');

    await page.getByRole('link', { name: 'Edit Tool Listing' }).click();

    await expect(page).toHaveURL(/\/tools\/tool-1\/edit$/);
  });
});
