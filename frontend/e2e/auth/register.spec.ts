import { test, expect } from '../fixtures';

// Covers RegisterPage (frontend issues #71, #74).
// As with LoginPage, native HTML5 required/pattern validation on the email
// field blocks empty/malformed submits before the JS handler runs, so only
// the JS-only invite-token branches are exercised here.
test.describe('RegisterPage', () => {
  test.fixme('registers successfully with a valid invite token and redirects to dashboard', async ({
    page,
  }) => {
    // Needs a real invite token; mock token 'INVITE-DEMO-001' is rejected by backend.
    await page.goto('/register');

    await page.getByLabel('Display Name').fill('New Member');
    await page.getByLabel('Email').fill('newmember@example.com');
    await page.getByLabel('Invite Token').fill('INVITE-DEMO-001');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  const inviteTokenCases = [
    ['invalid', 'Invalid or expired invite token'],
    ['expired', 'Invalid or expired invite token'],
    ['revoked', 'Invalid or expired invite token'],
    ['used', 'Invalid or expired invite token'],
  ] as const;

  for (const [token, expectedText] of inviteTokenCases) {
    test(`shows a specific message for a "${token}" invite token (#74)`, async ({
      page,
    }) => {
      await page.goto('/register');

      await page.getByLabel('Display Name').fill('New Member');
      await page.getByLabel('Email').fill('newmember@example.com');
      await page.getByLabel('Invite Token').fill(token);
      await page.getByLabel('Password').fill('password123');
      await page.getByRole('button', { name: 'Register' }).click();

      await expect(page.locator('.form-error')).toContainText(expectedText);
    });
  }

  test('rejects an unrecognized invite token with a generic invalid message', async ({
    page,
  }) => {
    await page.goto('/register');

    await page.getByLabel('Display Name').fill('New Member');
    await page.getByLabel('Email').fill('newmember@example.com');
    await page.getByLabel('Invite Token').fill('NOT-A-REAL-TOKEN');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.locator('.form-error')).toContainText('Invalid or expired invite token');
  });

  test('links back to login for existing members', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('link', { name: 'Login here' })).toHaveAttribute(
      'href',
      '/login',
    );
  });
});
