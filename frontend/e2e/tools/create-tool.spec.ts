import { test, expect } from '../fixtures';
// All tests in this file depend on mock-specific UI elements
// (e.g. 'Create Mock Tool Listing' button, mock success messages).

// Covers CreateToolPage / US8 (frontend issues #114, #115, #117, #118, #120).
// The form uses noValidate, so all JS validation branches are reachable
// through a normal submit click.
test.describe('CreateToolPage', () => {
  async function fillRequiredFields(page: import('@playwright/test').Page, name: string) {
    await page.getByLabel('Tool Name *').fill(name);
    await page.getByLabel('Category *').selectOption('POWER_TOOLS');
    await page.getByLabel('Condition *').selectOption('Good');
    await page.getByLabel('Latest Return Time (HST) *').fill('17:30');
    await page.getByLabel('Available From Date (HST) *').fill('2026-08-01');
    await page.getByLabel('Available To Date (HST) *').fill('2026-08-10');
    await page.getByLabel('Description *').fill('A tool used for the E2E demo.');
  }

  test.fixme('rejects submission with all required fields missing (#114)', async ({ page }) => {
    await page.goto('/tools/new');

    await page.getByRole('button', { name: 'Create Mock Tool Listing' }).click();

    await expect(page.locator('.form-error')).toHaveText('Tool name is required.');
  });

  test.fixme('rejects a listing with zero photos (#117)', async ({ page }) => {
    await page.goto('/tools/new');

    await fillRequiredFields(page, 'E2E Test Tool');
    await page.getByRole('button', { name: 'Create Mock Tool Listing' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'At least one tool photo is required',
    );
  });

  // Note: #118's "HH:MM 24-hour HST format" message is validated by a regex
  // that a native <input type="time"> can never actually violate (the
  // browser only ever commits a well-formed zero-padded HH:MM or empty), so
  // that branch isn't reachable through genuine UI interaction and isn't
  // exercised here.

  test.fixme('rejects a duplicate listing name (#120)', async ({ page }) => {
    await page.goto('/tools/new');

    await fillRequiredFields(page, 'Cordless Drill');
    await page.getByLabel('Tool Photos *').setInputFiles({
      name: 'drill.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });
    await page.getByRole('button', { name: 'Create Mock Tool Listing' }).click();

    await expect(page.locator('.form-error')).toContainText(
      'A tool listing with this name already exists',
    );
  });

  test.fixme('rejects an unsupported photo file type (#115)', async ({ page }) => {
    await page.goto('/tools/new');

    await page.getByLabel('Tool Photos *').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expect(page.locator('.form-error')).toContainText(
      'must be JPG, PNG, or WebP images',
    );
  });

  test.fixme('creates a mock listing successfully with a valid photo', async ({ page }) => {
    await page.goto('/tools/new');

    await fillRequiredFields(page, 'E2E Brand New Tool');
    await page.getByLabel('Tool Photos *').setInputFiles({
      name: 'new-tool.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-bytes'),
    });
    await page.getByRole('button', { name: 'Create Mock Tool Listing' }).click();

    await expect(page.locator('.success-message')).toContainText(
      'Mock tool listing created: E2E Brand New Tool',
    );
  });
});
