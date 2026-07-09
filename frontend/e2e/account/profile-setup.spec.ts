import { test, expect, loginAsMockUser } from '../fixtures';

// Covers ProfileSetupPage (frontend issues #95, #97, #98, #99, #100).
test.describe('ProfileSetupPage', () => {
  test('redirects an unauthenticated user to login (#100)', async ({ page }) => {
    await page.goto('/profile/setup');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('saves the profile and redirects to the dashboard (#95)', async ({ page }) => {
    await loginAsMockUser(page, '/profile/setup');

    await page.getByLabel('Display Name').fill('Loreto Coloma');
    await page.getByLabel('Short Bio').fill('Neighborhood tool sharer.');
    await page.getByRole('button', { name: 'Save Profile' }).click();

    await expect(page.locator('.form-success')).toContainText('Profile setup complete');
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 3000 });
  });

  test('rejects a blank display name (#97)', async ({ page }) => {
    await loginAsMockUser(page, '/profile/setup');

    const displayNameInput = page.getByLabel('Display Name');
    await displayNameInput.fill('   ');
    await page.getByRole('button', { name: 'Save Profile' }).click();

    await expect(page.locator('.form-error')).toHaveText('Display name is required.');
  });

  test('rejects a display name over the 40-character limit (#98)', async ({ page }) => {
    await loginAsMockUser(page, '/profile/setup');

    await page.getByLabel('Display Name').fill('A'.repeat(41));
    await page.getByRole('button', { name: 'Save Profile' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'must be 40 characters or fewer',
    );
  });

  test('rejects an unsupported profile photo type (#99)', async ({ page }) => {
    await loginAsMockUser(page, '/profile/setup');

    await page.getByLabel('Profile Photo').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.locator('.form-error')).toContainText(
      'must be a JPG, PNG, or WebP image',
    );
  });

  test('rejects a profile photo larger than 2 MB (#99)', async ({ page }) => {
    await loginAsMockUser(page, '/profile/setup');

    await page.getByLabel('Profile Photo').setInputFiles({
      name: 'huge-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
    });

    await expect(page.locator('.form-error')).toContainText('must be 2 MB or smaller');
  });
});
