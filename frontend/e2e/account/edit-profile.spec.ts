import { test, expect, loginAsMockUser } from '../fixtures';

// Covers EditProfilePage (frontend issue #102).
test.describe('EditProfilePage', () => {
  test('redirects an unauthenticated user to login', async ({ page }) => {
    await page.goto('/profile/edit');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('saves profile changes successfully', async ({ page }) => {
    await loginAsMockUser(page, '/profile/edit');

    await page.getByLabel('Display Name').fill('Nick Fairhart');
    await page.getByLabel('Short Bio').fill('QA lead for the tool-sharing app.');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('.form-success')).toHaveText(
      'Profile changes saved successfully.',
    );
  });

  test('rejects clearing the display name', async ({ page }) => {
    await loginAsMockUser(page, '/profile/edit');

    await page.getByLabel('Display Name').fill('');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('.form-error')).toHaveText('Display name is required.');
  });

  test('rejects a display name over the 40-character limit', async ({ page }) => {
    await loginAsMockUser(page, '/profile/edit');

    await page.getByLabel('Display Name').fill('B'.repeat(41));
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'must be 40 characters or fewer',
    );
  });

  test.fixme('rejects an unsupported profile photo type', async ({ page }) => {
    // Real EditProfilePage has no profile photo upload field.
    await loginAsMockUser(page, '/profile/edit');

    await page.getByLabel('Profile Photo').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.locator('.form-error')).toContainText(
      'must be a JPG, PNG, or WebP image',
    );
  });
});
