import { readFileSync } from 'node:fs';

import { test, expect, loginAsAdmin, loginAsMockUser } from '../fixtures';

// Covers AdminModerationAnalyticsPage (User Story 33 / GitHub issue #60).
//
// This page is frontend-only, backed by hardcoded mock data (the story's
// backend "Report query endpoints" task is unchecked/out of scope), so no
// api-helpers.ts calls are needed beyond the real /login call inside
// loginAsAdmin/loginAsMockUser.
//
// The original acceptance criteria (issue #60) describe a date *range* and
// an explicit "Generate Report" button; the shipped page instead filters
// reactively off a single exact-match date field with no submit step. These
// tests exercise the actual shipped UX rather than the AC's literal wording
// -- the date-range/Generate-button gap is a documented follow-up, not a bug
// covered here.
test.describe('AdminModerationAnalyticsPage', () => {
  test('shows the Listings report by default with totals and matching records', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await expect(page.getByRole('heading', { name: 'Listings', level: 2 })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Listing 1' })).toBeVisible();
    await expect(page.getByText('Total: 4')).toBeVisible();
  });

  test('switches to Violations and shows its own columns and totals', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await page.getByRole('combobox').selectOption('violations');

    await expect(page.getByRole('heading', { name: 'Violations', level: 2 })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: "Owner's Violation Count" })).toBeVisible();
    await expect(page.getByText('Total: 4')).toBeVisible();
  });

  test('switches to Suspensions and shows headers that match the rendered columns (#301 regression)', async ({ page }) => {
    // Regression guard for a bug found in PR #301: the Suspensions table's
    // headers (Member ID / Member Name / Status / Suspension Count / ...)
    // did not match what the row cells actually rendered (listing name,
    // owner id, owner name, status), so e.g. the "Suspension Count" column
    // showed "Active"/"Deactivated" text instead of a count. Headers and
    // cells were reconciled to Listing ID / Listing Name / Owner ID / Owner
    // Name / Status / Recent Suspended Date, matching the mock data's actual
    // fields (there is no suspension-count field in the mock data).
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await page.getByRole('combobox').selectOption('suspensions');

    await expect(page.getByRole('heading', { name: 'Suspensions', level: 2 })).toBeVisible();
    await expect(page.locator('.invite-table thead th')).toHaveText([
      'Listing ID',
      'Listing Name',
      'Owner ID',
      'Owner Name',
      'Status',
      'Recent Suspended Date',
    ]);
    const firstRow = page.locator('.invite-table tbody tr').first();
    await expect(firstRow.locator('td').nth(0)).toHaveText('1');
    await expect(firstRow.locator('td').nth(1)).toHaveText('Listing 1');
    await expect(firstRow.locator('td').nth(4)).toHaveText('Active');
    await expect(page.getByText('Total: 4')).toBeVisible();
  });

  test('switches to Borrowing Activity and shows totals', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await page.getByRole('combobox').selectOption('borrowingActivities');

    await expect(page.getByRole('heading', { name: 'Borrowing Activity', level: 2 })).toBeVisible();
    await expect(page.getByText('Total: 4')).toBeVisible();
  });

  test('filters the active report by the exact date field', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    // Listing 1 is the only mock listing with reported_date 2026-07-12.
    await page.getByLabel('Date').fill('2026-07-12');

    await expect(page.getByText('Total: 1')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Listing 1' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Listing 2' })).not.toBeVisible();
  });

  test('shows a no-matches message with headers still visible when the date filter matches nothing', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await page.getByLabel('Date').fill('2099-01-01');

    await expect(page.getByText('There are no matches.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Listing ID' })).toBeVisible();
    await expect(page.getByText('Total: 0')).toBeVisible();
    // Regression guard: the no-matches row previously had no colSpan,
    // producing a malformed single-<td> row in a 6-column table.
    await expect(page.locator('.invite-table tbody tr td[colspan="6"]')).toBeVisible();

    await page.getByRole('button', { name: 'Clear Filters' }).click();

    await expect(page.getByText('There are no matches.')).not.toBeVisible();
    await expect(page.getByText('Total: 4')).toBeVisible();
  });

  test('exports the currently filtered report as a CSV file matching the on-screen data', async ({ page }) => {
    await loginAsAdmin(page, '/admin/moderation/analytics');

    await page.getByLabel('Date').fill('2026-07-12');
    await expect(page.getByText('Total: 1')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe('ModerationAnalytics.csv');

    const path = await download.path();
    expect(path).not.toBeNull();
    const csv = readFileSync(path as string, 'utf-8').trim();
    // Papa.unparse defaults to CRLF line endings.
    const lines = csv.split(/\r?\n/);

    expect(lines[0]).toBe('listing_id,listingName,owner_id,ownerName,status,reported_by,reported_date');
    expect(lines).toHaveLength(2); // header + the single filtered row
    expect(lines[1]).toContain('Listing 1');
  });

  test('blocks a non-admin from viewing the moderation analytics report', async ({ page }) => {
    // The story's AC calls for a 403 Forbidden response, but there is no
    // backend endpoint for this mock-data page yet, so the closest real
    // behavior to verify is the client-side RequireAdmin route guard.
    await loginAsMockUser(page, '/admin/moderation/analytics');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Moderation Analytics')).toHaveCount(0);
    await expect(page.getByText(/Total:/)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Moderation Analytics' })).toHaveCount(0);
  });
});
