import { expect, test } from '@playwright/test';

test('root route redirects to the sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});
