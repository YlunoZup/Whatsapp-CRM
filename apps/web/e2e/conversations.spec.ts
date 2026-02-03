import { test, expect } from '@playwright/test';

test.describe('Conversations', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@example.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('should display conversations page', async ({ page }) => {
    await page.goto('/conversations');

    await expect(page.getByText(/conversations/i).first()).toBeVisible();
  });

  test('should filter conversations by status', async ({ page }) => {
    await page.goto('/conversations');

    // Click on status filter tabs
    await page.getByRole('button', { name: /open/i }).click();
    await expect(page.getByRole('button', { name: /open/i })).toHaveClass(/text-whatsapp-primary/);

    await page.getByRole('button', { name: /closed/i }).click();
    await expect(page.getByRole('button', { name: /closed/i })).toHaveClass(/text-whatsapp-primary/);
  });

  test('should search conversations', async ({ page }) => {
    await page.goto('/conversations');

    const searchInput = page.getByPlaceholder(/search conversations/i);
    await searchInput.fill('test');

    // Wait for search results
    await page.waitForTimeout(500);
  });

  test('should open conversation when clicked', async ({ page }) => {
    await page.goto('/conversations');

    // Click on first conversation if any
    const conversationItem = page.locator('[data-testid="conversation-item"]').first();
    if (await conversationItem.isVisible()) {
      await conversationItem.click();
      await expect(page.getByTestId('chat-window')).toBeVisible();
    }
  });

  test('should show advanced filters', async ({ page }) => {
    await page.goto('/conversations');

    // Click filter button
    await page.getByTitle(/advanced filters/i).click();

    // Should show filter bar
    await expect(page.getByText(/session/i)).toBeVisible();
    await expect(page.getByText(/assigned/i)).toBeVisible();
  });
});
