import { test, expect, loginAsMockUser } from '../fixtures';

// Covers AccountDeletionPage (frontend issues #105, #107).
test.describe('AccountDeletionPage', () => {
  test('redirects an unauthenticated user to login', async ({ page }) => {
    await page.goto('/account/delete');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('blocks deletion while active reservations exist by default (#107)', async ({
    page,
  }) => {
    await loginAsMockUser(page, '/account/delete');

    await expect(page.getByText('Account deletion is currently blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Account' })).toBeDisabled();
  });

  test('requires typing DELETE before the account can be removed', async ({ page }) => {
    await loginAsMockUser(page, '/account/delete');

    // Clear the demo "has active reservations" toggle so the delete flow unlocks.
    await page.getByLabel('Account has active reservations').uncheck();

    await page.getByLabel('I understand this action cannot be undone.').check();
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'Please type DELETE to confirm account deletion.',
    );
  });

  test('requires the final understanding checkbox', async ({ page }) => {
    await loginAsMockUser(page, '/account/delete');

    await page.getByLabel('Account has active reservations').uncheck();
    await page.getByLabel('Type DELETE to Confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'Please confirm that you understand this action cannot be undone.',
    );
  });

  test('deletes the mock account and redirects to login once confirmed', async ({
    page,
  }) => {
    await loginAsMockUser(page, '/account/delete');

    await page.getByLabel('Account has active reservations').uncheck();
    await page.getByLabel('Type DELETE to Confirm').fill('DELETE');
    await page.getByLabel('I understand this action cannot be undone.').check();
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Your account deletion request was submitted',
    );
    await expect(page).toHaveURL(/\/login$/, { timeout: 3000 });
  });
});
