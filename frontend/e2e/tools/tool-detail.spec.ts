import { test, expect, loginAsMockUser } from '../fixtures';
import { getToolId } from '../api-helpers';

// Covers ToolDetailPage (US12 detail view, US13 reservation request).
//
// Fixture (scripts/seed_dev.py): Cordless Drill and Hammer are both member01/
// member02-owned seeded tools. There's no tool "availability window" concept
// on the backend (see the fixme below), so date-range tests just exercise
// the client-side start/end validation and the real overlap-conflict error.
test.describe('ToolDetailPage', () => {
  test('shows a not-found message for an unknown tool id', async ({ page }) => {
    await loginAsMockUser(page, '/tools/00000000-0000-0000-0000-000000000000');

    await expect(page.getByRole('heading', { name: 'We could not find this tool.' })).toBeVisible();
  });

  test('shows full tool details', async ({ page }) => {
    await loginAsMockUser(page);
    const toolId = await getToolId(page, 'Cordless Drill');

    await page.goto(`/tools/${toolId}`);

    await expect(page.getByRole('heading', { name: 'Cordless Drill', level: 1 })).toBeVisible();
    await expect(page.getByText('Demo Owner')).toBeVisible();
    await expect(page.getByText('A power_tools available for sharing.')).toBeVisible();
  });

  test('submits a reservation request for available dates', async ({ page }) => {
    await loginAsMockUser(page);
    const toolId = await getToolId(page, 'Circular Saw');

    await page.goto(`/tools/${toolId}`);
    await page.getByLabel('Start Date (HST)').fill('2026-09-01');
    await page.getByLabel('End Date (HST)').fill('2026-09-03');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Reservation request submitted for Circular Saw',
    );
  });

  test('rejects an end date before the start date', async ({ page }) => {
    await loginAsMockUser(page);
    const toolId = await getToolId(page, 'Cordless Drill');

    await page.goto(`/tools/${toolId}`);
    await page.getByLabel('Start Date (HST)').fill('2026-07-06');
    await page.getByLabel('End Date (HST)').fill('2026-07-05');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.form-error')).toHaveText('End date cannot be before start date.');
  });

  test('rejects a date range that conflicts with an active reservation', async ({ page }) => {
    await loginAsMockUser(page);
    const toolId = await getToolId(page, 'Rake');

    await page.goto(`/tools/${toolId}`);
    await page.getByLabel('Start Date (HST)').fill('2026-09-10');
    await page.getByLabel('End Date (HST)').fill('2026-09-15');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();
    await expect(page.locator('.success-message')).toBeVisible();

    // A second, overlapping request for the same tool is rejected.
    await page.getByLabel('Start Date (HST)').fill('2026-09-12');
    await page.getByLabel('End Date (HST)').fill('2026-09-17');
    await page.getByRole('button', { name: 'Submit Reservation Request' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'This tool is already reserved for the requested dates.',
    );
  });

  test('links to the edit tool listing page', async ({ page }) => {
    await loginAsMockUser(page);
    const toolId = await getToolId(page, 'Hammer');

    await page.goto(`/tools/${toolId}`);
    await page.getByRole('link', { name: 'Edit Tool Listing' }).click();

    await expect(page).toHaveURL(new RegExp(`/tools/${toolId}/edit$`));
  });

  test.fixme(
    'rejects dates outside the tool availability window',
    async () => {
      // Not implemented: Tool has no availability-window fields
      // (available_start/available_end) on the backend at all -- the
      // reservation form only validates start <= end and lets the
      // backend's overlap check catch conflicts. See US8's lending-field
      // gaps in the backend acceptance suite for the broader scope of this.
    },
  );
});
