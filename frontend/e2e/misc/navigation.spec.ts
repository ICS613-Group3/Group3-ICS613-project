import { test, expect, loginAsMockUser } from '../fixtures';

// Covers AppLayout's mock-auth-driven navigation: logged-out users only see
// Login/Register, logged-in users see the full member nav plus Logout, and
// logging out clears the mock session and redirects to Login.
test.describe('AppLayout navigation', () => {
  test('logged-out users only see Login and Register links', async ({ page }) => {
    await page.goto('/dashboard');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Register' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('logged-in users see full member navigation and can log out', async ({
    page,
  }) => {
    await loginAsMockUser(page);

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Reservations' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Admin Invites' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Admin Listings' })).toBeVisible();

    await nav.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(nav.getByRole('link', { name: 'Login' })).toBeVisible();
  });

  test('the Browse Tools dropdown links to available tools, returned tools, and add new tool', async ({
    page,
  }) => {
    await loginAsMockUser(page);

    // The dropdown menu is `display: none` until the toggle is hovered/focused
    // (see .nav-dropdown-menu in App.css), so it's absent from the a11y tree
    // and unreachable via getByRole until we hover it first, same as a real user.
    await page.locator('.nav-dropdown-toggle', { hasText: 'Browse Tools' }).hover();

    const dropdownMenu = page.locator('.nav-dropdown-menu');
    await expect(dropdownMenu.getByRole('link', { name: 'Available Tools' })).toHaveAttribute(
      'href',
      '/tools',
    );
    await expect(dropdownMenu.getByRole('link', { name: 'Returned Tools' })).toHaveAttribute(
      'href',
      '/tools?view=returned',
    );
    await expect(dropdownMenu.getByRole('link', { name: 'Add New Tools' })).toHaveAttribute(
      'href',
      '/tools/new',
    );
  });
});
