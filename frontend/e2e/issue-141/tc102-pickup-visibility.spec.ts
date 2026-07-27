import fs from 'node:fs';
import path from 'node:path';

import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from '@playwright/test';

import type {
  ReservationResponse,
  ToolResponse,
  UserProfile,
} from '../../src/types/api';

/**
 * Issue #141 / Issue #197 / TC-102
 *
 * Automated verification:
 *
 * 1. REQUESTED as borrower:
 *    - Cancel Request visible
 *    - Confirm Pickup hidden
 *
 * 2. APPROVED as borrower:
 *    - Confirm Pickup visible
 *
 * 3. APPROVED as owner:
 *    - Confirm Pickup hidden
 *
 * All API responses are intercepted by Playwright.
 * No running backend or database seed data is required.
 */

const screenshotDirectory = path.resolve(
  process.env.TC102_SCREENSHOT_DIR ??
    path.join(
      'test-results',
      'issue-141-tc102-screenshots',
    ),
);

const yafeiUser: UserProfile = {
  id: 'user-1',
  email: 'yafei@example.com',
  full_name: 'Yafei Wang',
  bio: null,
  neighborhood: 'Honolulu',
  photo_url: null,
  status: 'ACTIVE',
  trust_score: 4.9,
  damage_reported: 0,
  violation_count: 0,
  created_at: '2026-06-01T00:00:00Z',
  is_admin: false,
};

const rionUser: UserProfile = {
  id: 'user-2',
  email: 'rion@example.com',
  full_name: 'Rion Sawabe',
  bio: null,
  neighborhood: 'Manoa',
  photo_url: null,
  status: 'ACTIVE',
  trust_score: 4.8,
  damage_reported: 0,
  violation_count: 0,
  created_at: '2026-06-01T00:00:00Z',
  is_admin: false,
};

const cordlessDrill: ToolResponse = {
  id: 'tool-1',
  owner_id: 'user-2',
  owner: {
    id: 'user-2',
    full_name: 'Rion Sawabe',
    photo_url: null,
  },
  name: 'Cordless Drill',
  description:
    '18V cordless drill with charger and extra battery.',
  category: 'POWER_TOOLS',
  condition: 'GOOD',
  is_active: true,
  deactivated_by: null,
  deactivated_at: null,
  deactivation_reason: null,
  avg_rating: 4.8,
  rating_count: 12,
  photos: [],
  created_at: '2026-06-15T00:00:00Z',
  updated_at: '2026-06-15T00:00:00Z',
};

const gardenShovel: ToolResponse = {
  id: 'tool-2',
  owner_id: 'user-1',
  owner: {
    id: 'user-1',
    full_name: 'Yafei Wang',
    photo_url: null,
  },
  name: 'Garden Shovel',
  description:
    'Durable garden shovel for planting and digging.',
  category: 'GARDEN_TOOLS',
  condition: 'GOOD',
  is_active: true,
  deactivated_by: null,
  deactivated_at: null,
  deactivation_reason: null,
  avg_rating: 4.6,
  rating_count: 8,
  photos: [],
  created_at: '2026-06-15T00:00:00Z',
  updated_at: '2026-06-15T00:00:00Z',
};

const requestedReservation: ReservationResponse = {
  id: 'res-1',
  tool_id: 'tool-1',
  borrower_id: 'user-1',
  state: 'REQUESTED',
  start_date: '2026-07-01',
  end_date: '2026-07-03',
  cancelled_by_type: null,
  cancelled_reason: null,
  denied_reason: null,
  picked_up_at: null,
  returned_at: null,
  damage_reported: false,
  damage_description: null,
  damage_reported_at: null,
  force_resolved_by: null,
  force_resolved_at: null,
  force_resolution_reason: null,
  created_at: '2026-06-30T00:00:00Z',
  updated_at: '2026-06-30T00:00:00Z',
};

const approvedReservation: ReservationResponse = {
  id: 'res-2',
  tool_id: 'tool-2',
  borrower_id: 'user-2',
  state: 'APPROVED',
  start_date: '2026-07-04',
  end_date: '2026-07-05',
  cancelled_by_type: null,
  cancelled_reason: null,
  denied_reason: null,
  picked_up_at: null,
  returned_at: null,
  damage_reported: false,
  damage_description: null,
  damage_reported_at: null,
  force_resolved_by: null,
  force_resolved_at: null,
  force_resolution_reason: null,
  created_at: '2026-06-30T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

interface Scenario {
  title: string;
  token: string;
  user: UserProfile;
  reservation: ReservationResponse;
  tool: ToolResponse;
  expectedView: 'Borrower View' | 'Owner View';
  expectCancelRequest: boolean;
  expectConfirmPickup: boolean;
  expectOwnerCancel: boolean;
  screenshot: string;
}

const scenarios: Scenario[] = [
  {
    title:
      'REQUESTED as borrower shows Cancel Request and hides Confirm Pickup',
    token: 'tc102-user-1-token',
    user: yafeiUser,
    reservation: requestedReservation,
    tool: cordlessDrill,
    expectedView: 'Borrower View',
    expectCancelRequest: true,
    expectConfirmPickup: false,
    expectOwnerCancel: false,
    screenshot:
      '01-requested-borrower-cancel-visible-pickup-hidden.png',
  },
  {
    title:
      'APPROVED as borrower shows Confirm Pickup',
    token: 'tc102-user-2-token',
    user: rionUser,
    reservation: approvedReservation,
    tool: gardenShovel,
    expectedView: 'Borrower View',
    expectCancelRequest: false,
    expectConfirmPickup: true,
    expectOwnerCancel: false,
    screenshot:
      '02-approved-borrower-pickup-visible.png',
  },
  {
    title:
      'APPROVED as owner hides Confirm Pickup',
    token: 'tc102-user-1-token',
    user: yafeiUser,
    reservation: approvedReservation,
    tool: gardenShovel,
    expectedView: 'Owner View',
    expectCancelRequest: false,
    expectConfirmPickup: false,
    expectOwnerCancel: true,
    screenshot:
      '03-approved-owner-pickup-hidden.png',
  },
];

async function fulfillJson(
  route: Route,
  body: unknown,
  status = 200,
): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function installApiStubs(
  page: Page,
  scenario: Scenario,
): Promise<void> {
  await page.route(
    '**/api/v1/**',
    async (route) => {
      const request = route.request();
      const method = request.method();
      const url = new URL(request.url());
      const pathname = url.pathname;

      if (
        method === 'GET' &&
        pathname === '/api/v1/auth/me'
      ) {
        await fulfillJson(
          route,
          scenario.user,
        );

        return;
      }

      if (
        method === 'GET' &&
        pathname ===
          `/api/v1/reservations/${scenario.reservation.id}`
      ) {
        await fulfillJson(
          route,
          scenario.reservation,
        );

        return;
      }

      if (
        method === 'GET' &&
        pathname ===
          `/api/v1/tools/${scenario.tool.id}`
      ) {
        await fulfillJson(
          route,
          scenario.tool,
        );

        return;
      }

      if (
        method === 'GET' &&
        pathname ===
          `/api/v1/reservations/${scenario.reservation.id}/messages`
      ) {
        await fulfillJson(
          route,
          {
            items: [],
            total: 0,
            page: 1,
            page_size: 20,
            pages: 0,
          },
        );

        return;
      }

      if (
        method === 'GET' &&
        pathname === '/api/v1/notifications'
      ) {
        await fulfillJson(
          route,
          {
            items: [],
            total: 0,
            unread_count: 0,
            page: 1,
            page_size: 1,
            pages: 0,
          },
        );

        return;
      }

      await fulfillJson(
        route,
        {
          detail:
            `Unhandled TC-102 API request: ${method} ${pathname}`,
          error_code: 'UnhandledTestRequest',
        },
        404,
      );
    },
  );
}

async function authenticate(
  page: Page,
  token: string,
): Promise<void> {
  await page.addInitScript(
    ({ accessToken }) => {
      window.localStorage.setItem(
        'access_token',
        accessToken,
      );

      window.localStorage.setItem(
        'refresh_token',
        'tc102-refresh-token',
      );
    },
    {
      accessToken: token,
    },
  );
}

async function saveScreenshot(
  page: Page,
  testInfo: TestInfo,
  filename: string,
): Promise<void> {
  fs.mkdirSync(
    screenshotDirectory,
    {
      recursive: true,
    },
  );

  const screenshotPath = path.join(
    screenshotDirectory,
    filename,
  );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    animations: 'disabled',
  });

  await testInfo.attach(
    filename,
    {
      path: screenshotPath,
      contentType: 'image/png',
    },
  );
}

test.describe(
  'Issue #141 TC-102 pickup action visibility',
  () => {
    for (const scenario of scenarios) {
      test(
        scenario.title,
        async ({
          page,
        }, testInfo) => {
          await installApiStubs(
            page,
            scenario,
          );

          await authenticate(
            page,
            scenario.token,
          );

          await page.goto(
            `/reservations/${scenario.reservation.id}`,
          );

          await expect(
            page.locator('.workflow-status'),
          ).toBeVisible();

          await expect(
            page.locator('.workflow-status'),
          ).toHaveText(
            scenario.reservation.state,
          );

          await expect(
            page.locator('.nav-user-greeting'),
          ).toContainText(
            scenario.user.full_name ??
              scenario.user.email,
          );

          await expect(
            page.getByText(
              scenario.expectedView,
              {
                exact: true,
              },
            ),
          ).toBeVisible();

          await expect(
            page.getByText(
              scenario.tool.name,
              {
                exact: true,
              },
            ).first(),
          ).toBeVisible();

          await expect(
            page.getByText(
              'No messages yet.',
              {
                exact: true,
              },
            ),
          ).toBeVisible();

          const cancelRequest =
            page.getByRole(
              'button',
              {
                name: 'Cancel Request',
                exact: true,
              },
            );

          const confirmPickup =
            page.getByRole(
              'button',
              {
                name: 'Confirm Pickup',
                exact: true,
              },
            );

          const ownerCancel =
            page.getByRole(
              'button',
              {
                name: 'Cancel Reservation',
                exact: true,
              },
            );

          if (
            scenario.expectCancelRequest
          ) {
            await expect(
              cancelRequest,
            ).toBeVisible();
          } else {
            await expect(
              cancelRequest,
            ).toHaveCount(0);
          }

          if (
            scenario.expectConfirmPickup
          ) {
            await expect(
              confirmPickup,
            ).toBeVisible();
          } else {
            await expect(
              confirmPickup,
            ).toHaveCount(0);
          }

          if (
            scenario.expectOwnerCancel
          ) {
            await expect(
              ownerCancel,
            ).toBeVisible();
          }

          await page.evaluate(
            async () => {
              await document.fonts.ready;
            },
          );

          await saveScreenshot(
            page,
            testInfo,
            scenario.screenshot,
          );
        },
      );
    }
  },
);
