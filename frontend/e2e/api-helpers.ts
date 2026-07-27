import type { Page } from '@playwright/test';

/**
 * Test-only helpers for talking to the real backend API directly from a
 * Playwright test, kept separate from fixtures.ts (login helpers) so this
 * file's only dependency is @playwright/test -- nothing here touches
 * frontend/src.
 *
 * Tests run against a live, shared backend with no per-test database reset,
 * so other spec files can add to (or mutate) the same seeded rows a given
 * test cares about. Rather than hardcoding an expected count that could
 * drift depending on run order, these helpers fetch the real current value
 * so a test can assert the UI matches it.
 */

/** Shape shared by every list endpoint (PaginatedResponse on the backend). */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ToolSummary {
  id: string;
  name: string;
}

export interface ReservationSummary {
  id: string;
  tool_id: string;
  state: string;
}

/** Authenticated GET against the real backend, using the current page's logged-in access token. */
export async function apiGet<T = unknown>(page: Page, path: string): Promise<T> {
  const token = await page.evaluate(() => window.localStorage.getItem('access_token'));
  const response = await page.request.get(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok()) {
    throw new Error(`GET ${path} failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Look up a seeded reservation by its tool's name.
 *
 * Reservation IDs are real UUIDs assigned at seed time (scripts/seed_dev.py),
 * not the old mock's hardcoded 'reservation-1' style, so tests navigate by
 * looking the ID up via the API first. /tools only lists listings the
 * current user doesn't own (it's the browse/reserve view), so a tool the
 * logged-in user owns (e.g. seeded Hammer, owned by member02) is looked up
 * via /tools/me instead.
 */
export async function findReservationByToolName(
  page: Page,
  toolName: string,
): Promise<ReservationSummary> {
  const browse = await apiGet<PaginatedResult<ToolSummary>>(
    page,
    `/api/v1/tools?search=${encodeURIComponent(toolName)}&page_size=5`,
  );
  let tool = browse.items.find((t) => t.name === toolName);
  if (!tool) {
    const mine = await apiGet<PaginatedResult<ToolSummary>>(page, '/api/v1/tools/me?page_size=100');
    tool = mine.items.find((t) => t.name === toolName);
  }
  if (!tool) throw new Error(`Seeded tool "${toolName}" not found`);

  const reservations = await apiGet<PaginatedResult<ReservationSummary>>(
    page,
    '/api/v1/reservations?page_size=100',
  );
  const reservation = reservations.items.find((r) => r.tool_id === tool.id);
  if (!reservation) throw new Error(`No reservation found for tool "${toolName}"`);
  return reservation;
}

/** Look up a seeded tool's id by name (browse list, falling back to /tools/me). */
export async function getToolId(page: Page, toolName: string): Promise<string> {
  const browse = await apiGet<PaginatedResult<ToolSummary>>(
    page,
    `/api/v1/tools?search=${encodeURIComponent(toolName)}&page_size=5`,
  );
  const tool = browse.items.find((t) => t.name === toolName);
  if (tool) return tool.id;
  const mine = await apiGet<PaginatedResult<ToolSummary>>(page, '/api/v1/tools/me?page_size=100');
  const own = mine.items.find((t) => t.name === toolName);
  if (!own) throw new Error(`Seeded tool "${toolName}" not found`);
  return own.id;
}
