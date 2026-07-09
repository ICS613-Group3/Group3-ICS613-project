import { test, expect } from '../fixtures';

// Covers LoginPage (frontend issues #81, #83, #85, #89, #110).
// Note: the email/password inputs are `required` with a `pattern` and the
// <form> has no `noValidate`, so native HTML5 constraint validation blocks
// submission of an empty/malformed value before the React handler ever
// runs. Only the JS-only branches (demo trigger emails/passwords) are
// reachable through a real browser submit, so that's what these tests
// exercise.
test.describe('LoginPage', () => {
  test('logs in successfully with valid credentials and redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('member@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('shows pending-verification message for an unverified account (#83)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('pending@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'pending email verification',
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows account-not-found message for a deleted account (#110)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('deleted@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.form-error')).toContainText('Account not found');
  });

  test('shows a generic invalid-login message and does not reveal which field is wrong (#85)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('someone@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.form-error')).toHaveText('Invalid email or password.');
  });

  test('provides links to forgot password and register', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('link', { name: 'Reset password here' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    await expect(page.getByRole('link', { name: 'Register here' })).toHaveAttribute(
      'href',
      '/register',
    );
  });
});
