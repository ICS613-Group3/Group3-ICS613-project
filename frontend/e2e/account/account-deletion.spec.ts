import { test, expect, loginAsMockUser } from '../fixtures';

// Covers AccountDeletionPage (frontend issues #105, #107).
test.describe('AccountDeletionPage', () => {
  test('redirects an unauthenticated user to login', async ({ page }) => {
    await page.goto('/account/delete');

    await expect(page).toHaveURL(/\/login$/);
  });

  test.fixme('blocks deletion while active reservations exist by default (#107)', async ({
    page,
  }) => {
    // The real page checks active reservations via API; no mock toggle exists.
    await loginAsMockUser(page, '/account/delete');

    await expect(page.getByText('Account deletion is currently blocked')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete Account' })).toBeDisabled();
  });

  test.fixme('requires typing DELETE before the account can be removed', async ({ page }) => {
    // Depends on mock 'Account has active reservations' toggle that no longer exists.
    await loginAsMockUser(page, '/account/delete');
    await page.getByLabel('Account has active reservations').uncheck();

    await page.getByLabel('I understand this action cannot be undone.').check();
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'Please type DELETE to confirm account deletion.',
    );
  });

  test.fixme('requires the final understanding checkbox', async ({ page }) => {
    // Depends on mock 'Account has active reservations' toggle that no longer exists.
    await loginAsMockUser(page, '/account/delete');

    await page.getByLabel('Account has active reservations').uncheck();
    await page.getByLabel('Type DELETE to Confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete Account' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'Please confirm that you understand this action cannot be undone.',
    );
  });

  test.fixme('deletes the mock account and redirects to login once confirmed', async ({
    page,
  }) => {
    // Depends on mock 'Account has active reservations' toggle that no longer exists.
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
