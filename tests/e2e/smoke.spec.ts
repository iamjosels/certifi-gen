import { expect, test } from './fixtures';

test('the app loads in Spanish without console errors', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Generador masivo de certificados/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
