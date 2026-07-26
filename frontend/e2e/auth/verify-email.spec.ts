import { test, expect } from '../fixtures';

// Covers VerifyEmailPage (frontend issues #77, #79).
test.describe('VerifyEmailPage', () => {
  test.fixme('verifies successfully with any non-special token', async ({ page }) => {
    // Needs a real verification token; mock token is rejected by backend.
    await page.goto('/verify-email');

    await page.getByLabel('Verification Token').fill('any-real-looking-token');
    await page.getByRole('button', { name: 'Verify Email' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Email verified successfully',
    );
  });

  test('pre-fills the token from the URL query string', async ({ page }) => {
    await page.goto('/verify-email?token=from-the-url');

    await expect(page.getByLabel('Verification Token')).toHaveValue('from-the-url');
  });

  test('shows an invalid/expired message for the "expired" demo token (#77)', async ({
    page,
  }) => {
    await page.goto('/verify-email');

    await page.getByLabel('Verification Token').fill('expired');
    await page.getByRole('button', { name: 'Verify Email' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'Invalid verification token',
    );
  });

  test('resend form shows a generic success message for a valid email (#79)', async ({
    page,
  }) => {
    await page.goto('/verify-email');

    await page.getByLabel('Email Address').fill('member@example.com');
    await page.getByRole('button', { name: 'Resend Verification Email' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'a new verification email has been sent',
    );
  });
});
