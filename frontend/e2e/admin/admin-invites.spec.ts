import { test, expect } from '../fixtures';
// All tests in this file depend on specific seed data (invite counts,
// seeded invite emails) that the current seed_dev.py does not create.

// Covers AdminInvitesPage (frontend issues #62, #63, #64).
test.describe('AdminInvitesPage', () => {
  test.fixme('shows initial invite counts by status', async ({ page }) => {
    await page.goto('/admin/invites');

    const summaryCards = page.locator('.invite-summary-grid .summary-card');
    await expect(summaryCards.nth(0)).toContainText('1');
    await expect(summaryCards.nth(0)).toContainText('Sent');
    await expect(summaryCards.nth(1)).toContainText('1');
    await expect(summaryCards.nth(1)).toContainText('Used');
  });

  test.fixme('sends a new invite and adds it to the table (#62, #63)', async ({ page }) => {
    await page.goto('/admin/invites');

    await page.getByLabel('Member Email').fill('new.person@example.com');
    await page.getByRole('button', { name: 'Send Invite' }).click();

    await expect(page.locator('.form-success')).toContainText(
      'Invite sent to new.person@example.com.',
    );
    await expect(
      page.locator('.invite-table tbody tr').first(),
    ).toContainText('new.person@example.com');
  });

  test.fixme('rejects inviting an email that already belongs to a member (#64)', async ({
    page,
  }) => {
    await page.goto('/admin/invites');

    await page.getByLabel('Member Email').fill('rion@example.com');
    await page.getByRole('button', { name: 'Send Invite' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'An account with that email already exists.',
    );
  });

  test.fixme('revokes an unused (sent) invite', async ({ page }) => {
    await page.goto('/admin/invites');

    await page
      .locator('tr', { hasText: 'new.member@example.com' })
      .getByRole('button', { name: 'Revoke' })
      .click();

    await expect(page.locator('.form-success')).toHaveText(
      'Invite was revoked successfully.',
    );
    await expect(
      page.locator('tr', { hasText: 'new.member@example.com' }),
    ).toContainText('revoked');
  });

  test.fixme('only sent invites show a Revoke action', async ({ page }) => {
    await page.goto('/admin/invites');

    await expect(
      page.locator('tr', { hasText: 'used.member@example.com' }).getByText('No action'),
    ).toBeVisible();
  });
});
