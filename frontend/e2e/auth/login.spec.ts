import { test, expect } from '../fixtures';

// Covers LoginPage (frontend issues #81, #85, #89).
//
// #83 (unverified account) and #110 (account not found) are deliberately
// NOT asserted as distinct messages here: AuthService.login always returns
// the same generic 401 "Invalid email or password" for every failure
// reason, to avoid revealing account existence/status to an
// unauthenticated caller. See LoginPage.tsx's docblock. Both are covered
// by the same generic-message assertions below rather than separate cases.
//
// Note: the email/password inputs are `required` with a `pattern` and the
// <form> has no `noValidate`, so native HTML5 constraint validation blocks
// submission of an empty/malformed value before the React handler ever
// runs — these tests only exercise values that pass that validation.
test.describe('LoginPage', () => {
  test('logs in successfully with valid credentials and redirects to dashboard', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('member02@example.com');
    await page.getByLabel('Password').fill('devpass123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('shows a generic invalid-login message for a wrong password and does not reveal which field is wrong (#85)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('member02@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.locator('.form-error')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows the same generic message for an unregistered email (covers #83, #110)', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nobody-registered@example.com');
    await page.getByLabel('Password').fill('whatever123');
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
