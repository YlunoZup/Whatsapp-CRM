import { test, expect } from '@playwright/test';

test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('should display contacts page', async ({ page }) => {
    await page.goto('/contacts');

    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible();
  });

  test('should have add contact button', async ({ page }) => {
    await page.goto('/contacts');

    await expect(page.getByRole('button', { name: /add contact/i })).toBeVisible();
  });

  test('should open add contact modal', async ({ page }) => {
    await page.goto('/contacts');

    await page.getByRole('button', { name: /add contact/i }).click();

    await expect(page.getByText(/new contact/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/phone/i)).toBeVisible();
  });

  test('should search contacts', async ({ page }) => {
    await page.goto('/contacts');

    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);
  });

  test('should have import button', async ({ page }) => {
    await page.goto('/contacts');

    await expect(page.getByRole('button', { name: /import/i })).toBeVisible();
  });

  test('should have export button', async ({ page }) => {
    await page.goto('/contacts');

    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
  });
});
