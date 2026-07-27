import { test, expect, loginAsAdmin } from '../fixtures';
import { apiGet } from '../api-helpers';

// Covers AdminInvitesPage (frontend issues #62, #63, #64).
//
// Fixture (scripts/seed_dev.py): 1 SENT invite (newmember@example.com) and
// 1 USED invite (used.member@example.com). Counts are fetched from the API
// since other tests in this file add more invites to the same live backend.
test.describe('AdminInvitesPage', () => {
  test('shows initial invite counts by status', async ({ page }) => {
    await loginAsAdmin(page);
    const invites = await apiGet<{ status: string }[]>(page, '/api/v1/auth/invites');
    const sentCount = invites.filter((i) => i.status === 'sent').length;
    const usedCount = invites.filter((i) => i.status === 'used').length;

    await page.goto('/admin/invites');

    const summaryCards = page.locator('.invite-summary-grid .summary-card');
    await expect(summaryCards.nth(0)).toContainText(String(sentCount));
    await expect(summaryCards.nth(0)).toContainText('Sent');
    await expect(summaryCards.nth(1)).toContainText(String(usedCount));
    await expect(summaryCards.nth(1)).toContainText('Used');
  });

  test('sends a new invite and adds it to the table (#62, #63)', async ({ page }) => {
    await loginAsAdmin(page, '/admin/invites');
    const email = `new.person.${Date.now()}@example.com`;

    await page.getByLabel('Member Email').fill(email);
    await page.getByRole('button', { name: 'Send Invite' }).click();

    await expect(page.locator('.form-success')).toContainText(`Invite created for ${email}.`);
    await expect(page.locator('.invite-table tbody tr').first()).toContainText(email);
  });

  test('rejects inviting an email that already belongs to a member (#64)', async ({ page }) => {
    await loginAsAdmin(page, '/admin/invites');

    await page.getByLabel('Member Email').fill('member01@example.com');
    await page.getByRole('button', { name: 'Send Invite' }).click();

    await expect(page.locator('.form-error')).toHaveText(
      'An account with this email already exists',
    );
  });

  test.fixme('revokes an unused (sent) invite', async () => {
    // Not implemented: AdminInvitesPage's invite table has no Actions
    // column or Revoke button at all -- the backend endpoint
    // (POST /auth/invites/{id}/revoke) exists and is covered by the
    // backend acceptance suite, but no frontend UI calls it yet.
  });

  test.fixme('only sent invites show a Revoke action', async () => {
    // Not implemented: same gap as above -- there is no per-row action
    // column in the invites table at all.
  });
});
