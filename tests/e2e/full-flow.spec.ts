import { certificateFileName } from '../../src/domain/filename';
import { expect, test } from './fixtures';
import {
  download,
  generate,
  longTasks,
  pageCount,
  prepare,
  readExpected,
  readZip,
  recordMetric,
  selectMode,
  textInBand,
  watchLongTasks,
} from './helpers';

test('PDF template + TXT list of 360: place the field, generate ZIP and single PDF, validate', async ({
  page,
}) => {
  const expected = await readExpected();
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360.txt');

  // Place the field: drag the name box down, then back near the center where it snaps.
  const box = page.locator('[data-field-id="name"] rect').first();
  const height = page.getByRole('spinbutton', { name: 'Altura' });
  const start = await box.boundingBox();
  if (!start) throw new Error('name box not visible');
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 60, { steps: 6 });
  await page.mouse.up();
  await expect(height).not.toHaveValue('50');
  await page.mouse.move(cx, cy + 60);
  await page.mouse.down();
  await page.mouse.move(cx + 4, cy + 3, { steps: 8 });
  await page.mouse.up();
  await expect(height).toHaveValue('50');
  await expect(page.getByRole('spinbutton', { name: 'Izquierda' })).toHaveValue('12');

  await page.getByRole('button', { name: 'Continuar' }).click();
  await selectMode(page, 'both');
  await expect(page.getByText(/≈ .* MB/)).toBeVisible();

  await watchLongTasks(page);
  const elapsed = await generate(page, 360);
  const tasks = await longTasks(page);

  const zip = await readZip(await download(page, /Descargar ZIP/));
  const pdfs = [...zip.keys()].filter((name) => name.endsWith('.pdf'));
  expect(pdfs).toHaveLength(360);
  expect(zip.has('reporte.csv')).toBe(true);
  const report = new TextDecoder().decode(zip.get('reporte.csv'));
  expect(report.trim().split('\r\n')).toHaveLength(361);

  const merged = await download(page, /Descargar PDF único/);
  expect(await pageCount(merged)).toBe(360);

  for (const name of [
    expected.samples.first,
    expected.samples.last,
    expected.samples.longest,
    expected.samples.withEnye,
  ]) {
    const index = expected.names.indexOf(name);
    expect(await textInBand(merged, index + 1)).toBe(name);
    const individual = zip.get(certificateFileName(index, 360, name));
    expect(individual, `individual PDF for ${name}`).toBeDefined();
    expect(await textInBand(individual ?? new Uint8Array(), 1)).toBe(name);
  }

  expect(elapsed).toBeLessThan(60_000);
  const longest = Math.max(0, ...tasks);
  // The interface never freezes: no main-thread task blocks for more than 200 ms.
  expect(longest).toBeLessThan(200);
  await recordMetric('pdf+txt-360-both', {
    browserMs: elapsed,
    zipBytes: [...zip.values()].reduce((sum, file) => sum + file.length, 0),
    mergedBytes: merged.length,
    longTasks: tasks.length,
    longestTaskMs: Math.round(longest),
  });
});
