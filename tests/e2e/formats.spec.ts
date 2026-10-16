import { expect, test } from './fixtures';
import {
  download,
  generate,
  next,
  pageCount,
  pageSize,
  prepare,
  readExpected,
  readZip,
  recordMetric,
  selectMode,
  textInBand,
  uploadList,
  uploadTemplate,
} from './helpers';

test('PNG template + XLSX list choosing the "Nombre" column', async ({ page }) => {
  const expected = await readExpected();
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-horizontal.png');
  await next(page);
  await uploadList(page, 'participantes-360.xlsx');
  const column = page.getByRole('combobox', { name: 'Columna con el nombre' });
  await column.selectOption({ label: 'Correo' });
  await expect(page.getByRole('cell', { name: /@ejemplo\.edu\.pe/ }).first()).toBeVisible();
  await column.selectOption({ label: 'Nombre' });
  await expect(page.getByText(expected.names[0] ?? '', { exact: true })).toBeVisible();
  await next(page);
  await expect(page.getByText(/Todos los textos entran/)).toBeVisible();
  await next(page);
  await selectMode(page, 'merged');
  const ms = await generate(page, 360);
  const pdf = await download(page, /Descargar PDF único/);
  expect(await pageCount(pdf)).toBe(360);
  expect(await textInBand(pdf, 1)).toBe(expected.names[0]);
  expect(await textInBand(pdf, 360)).toBe(expected.samples.last);
  await recordMetric('png+xlsx-360-merged', { browserMs: ms, mergedBytes: pdf.length });
});

for (const template of [
  'plantilla-vertical.pdf',
  'plantilla-vertical.png',
  'plantilla-vertical.jpg',
]) {
  test(`vertical template ${template}`, async ({ page }) => {
    const expected = await readExpected();
    await prepare(page, template, 'participantes-360.txt');
    await next(page);
    await selectMode(page, 'merged');
    await generate(page, 360);
    const pdf = await download(page, /Descargar PDF único/);
    expect(await pageCount(pdf)).toBe(360);
    const size = await pageSize(pdf);
    expect(size.height).toBeGreaterThan(size.width);
    const longest = expected.names.indexOf(expected.samples.longest);
    expect(await textInBand(pdf, longest + 1)).toBe(expected.samples.longest);
  });
}

test('CSV Windows-1252 keeps the accents in the result', async ({ page }) => {
  const expected = await readExpected();
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360-windows1252.csv');
  await next(page);
  await selectMode(page, 'zip');
  await generate(page, 360);
  const zip = await readZip(await download(page, /Descargar ZIP/));
  const report = new TextDecoder().decode(zip.get('reporte.csv'));
  const reported = report
    .replace(/^\ufeff/u, '')
    .trim()
    .split('\r\n')
    .slice(1)
    .map((line) => line.split(',')[1]);
  expect(reported).toEqual(expected.names);
  const withEnye = expected.names.indexOf(expected.samples.withEnye);
  const entry = [...zip.entries()].find(([name]) =>
    name.startsWith(`${String(withEnye + 1).padStart(3, '0')}_`),
  );
  expect(await textInBand(entry?.[1] ?? new Uint8Array(), 1)).toBe(expected.samples.withEnye);
});

test('JPG template + DOCX list, with the real PDF preview', async ({ page }) => {
  const expected = await readExpected();
  await prepare(page, 'plantilla-horizontal.jpg', 'participantes-360.docx');
  await page.getByRole('button', { name: 'Vista previa real' }).click();
  await expect(
    page.getByAltText('Certificado generado para el participante seleccionado'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await next(page);
  await selectMode(page, 'merged');
  await generate(page, 360);
  const pdf = await download(page, /Descargar PDF único/);
  expect(await pageCount(pdf)).toBe(360);
  const index = expected.names.indexOf(expected.samples.withApostrophe);
  expect(await textInBand(pdf, index + 1)).toBe(expected.samples.withApostrophe);
});

test('CSV UTF-8 list in both modes', async ({ page }) => {
  const expected = await readExpected();
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360.csv');
  await next(page);
  await generate(page, 360);
  const zip = await readZip(await download(page, /Descargar ZIP/));
  expect([...zip.keys()].filter((name) => name.endsWith('.pdf'))).toHaveLength(360);
  const pdf = await download(page, /Descargar PDF único/);
  expect(await textInBand(pdf, 1)).toBe(expected.names[0]);
});
