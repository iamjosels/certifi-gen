import { expect, test } from './fixtures';
import { download, generate, next, pageCount, prepare, selectMode } from './helpers';

test('cancel halfway through the generation and generate again', async ({ page }) => {
  await prepare(page, 'plantilla-horizontal.png', 'participantes-360.txt');
  await next(page);
  await selectMode(page, 'both');
  await page.getByRole('button', { name: 'Generar 360 certificados' }).click();
  const count = page.getByTestId('progress-count');
  await expect(count).toHaveText(/^([1-9]\d*)\/360/);
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Generación cancelada. Puedes volver a generar.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Descargar/ })).toHaveCount(0);

  await generate(page, 360);
  const pdf = await download(page, /Descargar PDF único/);
  expect(await pageCount(pdf)).toBe(360);
});
