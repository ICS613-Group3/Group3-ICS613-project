import { test, expect, loginAsMockUser } from '../fixtures';
import { apiGet } from '../api-helpers';

// Covers AvailableToolsPage / BrowseToolsPage (US12 browse & search).
//
// /tools requires login and excludes the current user's own listings (you
// can't reserve your own tool), so as member02 it shows only member01's
// seeded tools (Cordless Drill, Wrench, Ladder, Circular Saw, Tape Measure,
// Rake). Totals are fetched from the API rather than hardcoded since other
// spec files could add more tools later.
test.describe('AvailableToolsPage', () => {
  test('shows all available tools by default', async ({ page }) => {
    await loginAsMockUser(page);
    const data = await apiGet<{ total: number }>(page, '/api/v1/tools?page_size=1');

    await page.goto('/tools');

    await expect(page.getByText(`Showing ${data.total} of ${data.total} matching tools.`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cordless Drill' })).toBeVisible();
  });

  test('filters by search keyword', async ({ page }) => {
    await loginAsMockUser(page, '/tools');
    // Let the initial unfiltered load settle before filtering -- see the
    // BUG test below for what happens when requests race instead.
    await expect(page.getByText(/Showing \d+ of \d+ matching tools\./)).toBeVisible();

    await page.getByPlaceholder('Search by tool name or keyword').fill('Ladder');

    await expect(page.getByText('Showing 1 of 1 matching tools.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ladder' })).toBeVisible();
  });

  test('filters by category', async ({ page }) => {
    await loginAsMockUser(page, '/tools');
    await expect(page.getByText(/Showing \d+ of \d+ matching tools\./)).toBeVisible();

    await page.getByRole('combobox').first().selectOption('GARDEN_TOOLS');

    await expect(page.getByText('Showing 1 of 1 matching tools.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rake' })).toBeVisible();
  });

  test('shows an empty state and clears filters when nothing matches', async ({ page }) => {
    await loginAsMockUser(page);
    const data = await apiGet<{ total: number }>(page, '/api/v1/tools?page_size=1');

    await page.goto('/tools');
    await expect(page.getByText(/Showing \d+ of \d+ matching tools\./)).toBeVisible();
    // React.StrictMode double-invokes the mount effect in dev, firing a second
    // unfiltered fetchTools() alongside the first. Combined with the same
    // missing request-cancellation/sequencing guard the "BUG" test below
    // documents, that duplicate call can still be in flight when we filter
    // next and land afterward, overwriting the correct empty result with a
    // stale unfiltered one. Waiting for the network to settle here lets that
    // duplicate resolve before we introduce the filter change, so this test
    // isn't itself racing the same bug.
    await page.waitForLoadState('networkidle');

    await page.getByPlaceholder('Search by tool name or keyword').fill('no such tool exists');

    await expect(page.getByText('No tools match the current filters.')).toBeVisible();

    // Two "Clear Filters" buttons exist once the empty state renders: one in
    // the filter panel and one in the empty-state card itself.
    await page.getByRole('button', { name: 'Clear Filters' }).first().click();

    await expect(page.getByText(`Showing ${data.total} of ${data.total} matching tools.`)).toBeVisible();
  });

  test('links to the tool detail page', async ({ page }) => {
    await loginAsMockUser(page, '/tools');

    await page
      .locator('.tool-card', { hasText: 'Cordless Drill' })
      .getByRole('link', { name: 'View Details' })
      .click();

    await expect(page).toHaveURL(/\/tools\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Cordless Drill', level: 1 })).toBeVisible();
  });

  test('BUG: a slow, stale filter response can overwrite a faster, correct one', async ({
    page,
  }) => {
    // AvailableToolsPage.fetchTools (src/pages/AvailableToolsPage.tsx) has no
    // request-cancellation guard (no AbortController, no response sequence
    // check) -- whichever fetch resolves last wins, even if it was fired
    // first and answers an older filter state. Real-world impact: a member
    // typing quickly in the search box (or a slow network on one request)
    // can be left looking at results for a search term they've already
    // changed away from, with no visual indication anything is wrong.
    //
    // This test makes the race deterministic instead of relying on real
    // timing: it delays the response to the FIRST search so it resolves
    // after the SECOND, then asserts the page should show the second
    // search's (correct) result. Today it shows the first (stale) one
    // instead.
    //
    // Suggested fix: cancel the in-flight request (AbortController) before
    // starting a new one, or tag each request with a sequence number and
    // ignore responses older than the latest one issued.
    test.fail(true, 'known bug: fetchTools has no request-cancellation/sequencing guard');

    await loginAsMockUser(page, '/tools');
    await expect(page.getByText(/Showing \d+ of \d+ matching tools\./)).toBeVisible();

    let delayedFirstMatch = false;
    await page.route('**/api/v1/tools?search=*', async (route) => {
      if (!delayedFirstMatch) {
        delayedFirstMatch = true;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      await route.continue();
    });

    const searchBox = page.getByPlaceholder('Search by tool name or keyword');
    await searchBox.fill('no such tool exists'); // fires first, delayed 500ms
    await searchBox.fill('Ladder'); // fires second, resolves immediately

    // Give the delayed first response time to land -- without this wait,
    // the assertion below can catch the brief correct state before the
    // stale response arrives and overwrites it.
    await page.waitForTimeout(700);

    // Correct behavior: the box says "Ladder" and the result should match
    // that. The delayed "no such tool exists" response arrives later and
    // overwrites it with an empty result instead.
    await expect(page.getByText('Showing 1 of 1 matching tools.')).toBeVisible();
  });
});

// Covers ReturnedToolsPage (US25 entry point via /tools?view=returned).
test.describe('ReturnedToolsPage', () => {
  test('shows returned tools with a review link', async ({ page }) => {
    await loginAsMockUser(page, '/tools?view=returned');

    await expect(page.getByRole('heading', { name: 'Returned Tools' })).toBeVisible();
    await expect(page.getByText(/Showing \d+ of \d+ returned tools\./)).toBeVisible();

    const firstReviewLink = page.getByRole('link', { name: 'Review This Tool' }).first();
    await expect(firstReviewLink).toHaveAttribute(
      'href',
      /^\/reservations\/[0-9a-f-]{36}\/review$/,
    );
  });
});
