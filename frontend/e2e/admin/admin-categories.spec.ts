import { test, expect, loginAsAdmin, logoutMockUser } from '../fixtures';

test.describe('AdminCategoriesPage', () => {
  test('admin can list, create, edit, and remove categories', async ({ page }) => {
    await loginAsAdmin(page, '/admin/categories');

    // Page loads
    await expect(page.locator('.page-section h1')).toContainText('Tool Categories');

    // Create a new category
    const catName = `Test Category ${Date.now()}`;
    await page.fill('input[id="cat-name"]', catName);
    await page.fill('input[id="cat-desc"]', 'A test category description');
    await page.click('button:has-text("Add Category")');
    await page.waitForTimeout(1000);

    // Success message
    await expect(page.locator('.form-success')).toContainText('created');

    // Category appears in table
    await expect(page.locator('td').filter({ hasText: catName })).toBeVisible();

    // Edit the category
    const row = page.locator('tr').filter({ hasText: catName });
    await row.locator('button:has-text("Edit")').click();
    await page.waitForTimeout(500);

    // Edit form appears
    await expect(page.locator('h2:has-text("Edit Category")')).toBeVisible();

    // Change the name
    const newName = `${catName} Updated`;
    await page.fill('input[id="edit-name"]', newName);
    await page.click('button:has-text("Save Changes")');
    await page.waitForTimeout(1000);

    // Success message
    await expect(page.locator('.form-success')).toContainText('updated');

    // Updated name appears in table
    await expect(page.locator('td').filter({ hasText: newName })).toBeVisible();

    // Remove the category
    page.on('dialog', (dialog) => dialog.accept());
    const updatedRow = page.locator('tr').filter({ hasText: newName });
    await updatedRow.locator('button:has-text("Remove")').click();
    await page.waitForTimeout(1000);

    // Success message
    await expect(page.locator('.form-success')).toContainText('removed');

    // Category no longer in table
    await expect(page.locator('td').filter({ hasText: newName })).not.toBeVisible();
  });

  test('non-admin cannot access categories page', async ({ page }) => {
    // Login as non-admin and try to access admin page
    await page.goto('/login');
    await page.getByLabel('Email').fill('member01@example.com');
    await page.getByLabel('Password').fill('devpass123');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL(/\/dashboard$/);

    // Navigate to admin page — RequireAdmin redirects non-admins to /dashboard
    await page.goto('/admin/categories');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
