import { expect, test } from './fixtures';
import {
  download,
  fixture,
  generate,
  next,
  prepare,
  readExpected,
  readZip,
  selectMode,
  uploadTemplate,
} from './helpers';

test('names that do not fit are flagged before generating and reported', async ({ page }) => {
  const expected = await readExpected();
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360.txt');
  await page.getByRole('spinbutton', { name: 'Ancho' }).fill('25');
  await expect(page.getByRole('alert')).toContainText(
    /textos no entran en «Nombre» ni al tamaño mínimo/,
  );

  await page.getByRole('button', { name: 'Ver los más largos' }).click();
  const longest = page.getByRole('list', { name: 'Los 3 nombres más anchos' }).getByRole('button');
  await expect(longest).toHaveCount(3);
  await expect(longest.first()).toContainText(expected.samples.longest);
  await expect(page.locator('[data-field-id="name"]')).toHaveAttribute('data-overflow', 'true');

  await next(page);
  await expect(page.getByText(/certificados tienen texto que no entra en su caja/)).toBeVisible();
  await selectMode(page, 'zip');
  await generate(page, 360);
  await expect(page.getByText(/con texto al tamaño mínimo/)).toBeVisible();
  const zip = await readZip(await download(page, /Descargar ZIP/));
  const report = new TextDecoder().decode(zip.get('reporte.csv'));
  expect(report).toContain('sí (Nombre)');
});

test('the default design fits every fixture name', async ({ page }) => {
  await prepare(page, 'plantilla-vertical.pdf', 'participantes-360.txt');
  await expect(
    page.getByText(/Todos los textos entran en sus cajas .*360 participantes/),
  ).toBeVisible();
});

test('heavy PNG: optimize to JPG, and warn first when it has transparency', async ({ page }) => {
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-pesada.png');
  await expect(page.getByText('Imagen pesada')).toBeVisible();
  await page.getByRole('button', { name: 'Optimizar' }).click();
  await expect(page.getByText(/Plantilla optimizada: 6\.\d MB → \d+(\.\d)? KB/)).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('JPG', { exact: true })).toBeVisible();
  await expect(page.getByText('Imagen pesada')).toHaveCount(0);

  await page
    .getByLabel('Reemplazar plantilla')
    .setInputFiles(fixture('plantilla-transparente.png'));
  await expect(page.getByText('plantilla-transparente.png')).toBeVisible();
  await page.getByRole('button', { name: 'Optimizar' }).click();
  await expect(page.getByText('La imagen tiene transparencia')).toBeVisible();
  await page.getByRole('button', { name: 'Optimizar igual' }).click();
  await expect(page.getByText(/Plantilla optimizada/)).toBeVisible({ timeout: 30_000 });
});

test('add a correlative code field from the panel', async ({ page }) => {
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360.txt');
  await page.getByRole('button', { name: 'Agregar campo' }).click();
  await page.getByRole('button', { name: /Código correlativo/ }).click();
  await expect(page.getByText('Ejemplo: CERT-2026-001')).toBeVisible();
  await expect(page.locator('[data-field-id="field-1"]')).toContainText('CERT-2026-001');
});
