import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('should navigate to all main pages', async ({ page }) => {
    // Dashboard
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL('/');

    // Conversations
    await page.getByRole('link', { name: /conversations/i }).click();
    await expect(page).toHaveURL('/conversations');

    // Contacts
    await page.getByRole('link', { name: /contacts/i }).click();
    await expect(page).toHaveURL('/contacts');

    // Broadcasts
    await page.getByRole('link', { name: /broadcasts/i }).click();
    await expect(page).toHaveURL('/broadcasts');

    // Scheduled
    await page.getByRole('link', { name: /scheduled/i }).click();
    await expect(page).toHaveURL('/scheduled');

    // Templates
    await page.getByRole('link', { name: /templates/i }).click();
    await expect(page).toHaveURL('/templates');

    // Analytics
    await page.getByRole('link', { name: /analytics/i }).click();
    await expect(page).toHaveURL('/analytics');

    // Sessions
    await page.getByRole('link', { name: /sessions/i }).click();
    await expect(page).toHaveURL('/sessions');

    // Integrations
    await page.getByRole('link', { name: /integrations/i }).click();
    await expect(page).toHaveURL('/integrations');

    // Settings
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
  });

  test('should show user info in sidebar', async ({ page }) => {
    await expect(page.getByText(/admin/i)).toBeVisible();
  });

  test('should logout when clicking logout button', async ({ page }) => {
    await page.getByRole('button', { name: /logout/i }).click();

    await expect(page).toHaveURL('/login');
  });

  test('should open global search with keyboard shortcut', async ({ page }) => {
    // Press Cmd/Ctrl+K
    await page.keyboard.press('Control+k');

    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test('should toggle theme', async ({ page }) => {
    // Find theme toggle
    const themeToggle = page.getByTitle(/theme/i);
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      // Theme dropdown should appear
      await expect(page.getByText(/dark/i)).toBeVisible();
    }
  });

  test('should show notifications bell', async ({ page }) => {
    await expect(page.getByTitle(/notifications/i)).toBeVisible();
  });
});
