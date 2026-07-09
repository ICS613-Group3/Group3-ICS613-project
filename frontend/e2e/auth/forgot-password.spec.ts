import { test, expect } from '../fixtures';

// Covers ForgotPasswordPage (frontend issue #89 / US4 scenario 1: the
// generic "if an account exists" success message that avoids revealing
// whether an email is registered).
test.describe('ForgotPasswordPage', () => {
  test('shows a generic success message that does not reveal whether the email exists', async ({
    page,
  }) => {
    await page.goto('/forgot-password');

    await page.getByLabel('Email Address').fill('anyone@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'If an account exists for that email',
    );
  });

  test('clears the email field after a successful submission', async ({ page }) => {
    await page.goto('/forgot-password');

    const emailInput = page.getByLabel('Email Address');
    await emailInput.fill('anyone@example.com');
    await page.getByRole('button', { name: 'Send Reset Link' }).click();

    await expect(emailInput).toHaveValue('');
  });
});
