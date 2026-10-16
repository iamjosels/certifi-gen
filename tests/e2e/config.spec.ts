import { writeFile } from 'node:fs/promises';
import { expect, test } from './fixtures';
import {
  download,
  generate,
  pageCount,
  readExpected,
  selectMode,
  textInBand,
  uploadList,
  uploadTemplate,
  next,
} from './helpers';

const CONFIG = {
  app: 'certifi-gen',
  schemaVersion: 1,
  savedAt: '2026-10-15T12:00:00.000Z',
  output: { mode: 'merged' },
  template: { kind: 'pdf', aspectRatio: 841.89 / 595.28 },
  nameColumn: null,
  customFonts: [],
  fields: [
    {
      id: 'name',
      label: 'Nombre',
      source: { kind: 'name' },
      box: { x: 0.1, y: 0.45, width: 0.8 },
      fontId: 'marcellus',
      maxSize: 34,
      minSize: 12,
      color: '#7a1f1f',
      align: 'center',
      transform: 'upper',
    },
    {
      id: 'field-1',
      label: 'Código',
      source: { kind: 'sequence', pattern: 'CERT-2026-{n:000}', start: 1 },
      box: { x: 0.3, y: 0.93, width: 0.4 },
      fontId: 'poppins',
      maxSize: 10,
      minSize: 8,
      color: '#3a3f4b',
      align: 'center',
      transform: 'none',
    },
  ],
};

test('import a JSON configuration and generate without touching the design', async ({
  page,
}, testInfo) => {
  const expected = await readExpected();
  const file = testInfo.outputPath('configuracion.json');
  await writeFile(file, JSON.stringify(CONFIG));

  await page.goto('/');
  await uploadTemplate(page, 'plantilla-horizontal.pdf');
  await next(page);
  await uploadList(page, 'participantes-360.txt');
  await page.getByLabel('Importar configuración').setInputFiles(file);
  await expect(page.getByText(/Configuración importada/)).toBeVisible();

  // Straight to the last step.
  await page.getByRole('button', { name: 'Generar', exact: false }).last().click();
  await expect(page.getByRole('heading', { name: 'Genera los certificados' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Un solo PDF con todos/ })).toBeChecked();
  await generate(page, 360);
  const pdf = await download(page, /Descargar PDF único/);
  expect(await pageCount(pdf)).toBe(360);
  expect(await textInBand(pdf, 1, 0.45, 25)).toBe(
    (expected.names[0] ?? '').toLocaleUpperCase('es'),
  );
  expect(await textInBand(pdf, 2, 0.93, 8)).toBe('CERT-2026-002');
});

test('export the configuration and restore it in a new session', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-horizontal.pdf');
  await next(page);
  await uploadList(page, 'participantes-360.txt');
  await next(page);
  await page.getByRole('radio', { name: 'MAYÚS' }).click();
  await page.getByRole('spinbutton', { name: 'Tamaño máximo' }).fill('30');
  const [exported] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exportar/ }).click(),
  ]);
  expect(exported.suggestedFilename()).toBe('configuracion-certificados.json');
  const path = testInfo.outputPath('exportada.json');
  await exported.saveAs(path);

  const fresh = await browser.newPage();
  await fresh.goto('/');
  await fresh.getByLabel('Importar configuración').setInputFiles(path);
  await expect(fresh.getByText(/Configuración importada/)).toBeVisible();
  await uploadTemplate(fresh, 'plantilla-horizontal.pdf');
  await next(fresh);
  await uploadList(fresh, 'participantes-360.txt');
  await next(fresh);
  await expect(fresh.getByRole('spinbutton', { name: 'Tamaño máximo' })).toHaveValue('30');
  await expect(fresh.getByRole('radio', { name: 'MAYÚS' })).toHaveAttribute('aria-checked', 'true');
  await fresh.close();
});

test('restores the last configuration from localStorage after a reload', async ({ page }) => {
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-horizontal.pdf');
  await next(page);
  await uploadList(page, 'participantes-360.txt');
  await next(page);
  await page.getByRole('radio', { name: 'Alinear a la izquierda' }).click();
  await page.waitForTimeout(700);
  await page.reload();
  await expect(page.getByText(/Restauramos el diseño/)).toBeVisible();
  await uploadTemplate(page, 'plantilla-horizontal.pdf');
  await next(page);
  await uploadList(page, 'participantes-360.txt');
  await next(page);
  await expect(page.getByRole('radio', { name: 'Alinear a la izquierda' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await next(page);
  await selectMode(page, 'zip');
});
