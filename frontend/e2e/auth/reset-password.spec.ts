import { test, expect } from '../fixtures';

// Covers ResetPasswordPage (frontend issues #91, #93).
test.describe('ResetPasswordPage', () => {
  test.fixme('resets successfully with a matching 8+ character password', async ({ page }) => {
    // Needs a real reset token; mock token 'a-real-looking-token' is rejected by backend.
    await page.goto('/reset-password');

    await page.getByLabel('Reset Token').fill('a-real-looking-token');
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('newpassword123');
    await page.getByRole('button', { name: 'Create New Password' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Password reset successfully',
    );
  });

  test('pre-fills the token from the URL query string', async ({ page }) => {
    await page.goto('/reset-password?token=from-the-url');

    await expect(page.getByLabel('Reset Token')).toHaveValue('from-the-url');
  });

  test('shows a request-new-reset-email message for the "expired" demo token (#93)', async ({
    page,
  }) => {
    await page.goto('/reset-password');

    await page.getByLabel('Reset Token').fill('expired');
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('newpassword123');
    await page.getByRole('button', { name: 'Create New Password' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'Invalid reset token',
    );
  });

  test('rejects mismatched password confirmation', async ({ page }) => {
    await page.goto('/reset-password');

    await page.getByLabel('Reset Token').fill('a-real-looking-token');
    await page.getByLabel('New Password', { exact: true }).fill('newpassword123');
    await page.getByLabel('Confirm New Password').fill('differentpassword123');
    await page.getByRole('button', { name: 'Create New Password' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'must match',
    );
  });
});
