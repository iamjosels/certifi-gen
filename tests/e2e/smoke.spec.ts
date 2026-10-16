import { expect, test } from './fixtures';

test('the app loads in Spanish without console errors', async ({ page }) => {
  const response = await page.goto('/');
  await expect(page).toHaveTitle(/Generador masivo de certificados/);
  await expect(page.getByRole('heading', { level: 1 })).toBeAttached();
  await expect(page.getByText('Arrastra aquí tu plantilla o haz clic para elegirla')).toBeVisible();
  // Served with the production security headers (see deploy/headers.ts).
  expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
});
