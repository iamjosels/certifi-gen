import { expect, test } from './fixtures';
import {
  download,
  generate,
  longTasks,
  next,
  pageCount,
  prepare,
  readZip,
  recordMetric,
  watchLongTasks,
} from './helpers';

test('1000 participants in both modes without freezing the interface', async ({ page }) => {
  await prepare(page, 'plantilla-horizontal.pdf', 'participantes-1000.txt');
  await next(page);
  await watchLongTasks(page);
  const ms = await generate(page, 1000);
  const tasks = await longTasks(page);
  const zip = await readZip(await download(page, /Descargar ZIP/));
  expect([...zip.keys()].filter((name) => name.endsWith('.pdf'))).toHaveLength(1000);
  const merged = await download(page, /Descargar PDF único/);
  expect(await pageCount(merged)).toBe(1000);
  expect(Math.max(0, ...tasks)).toBeLessThan(200);
  await recordMetric('pdf+txt-1000-both', {
    browserMs: ms,
    mergedBytes: merged.length,
    longTasks: tasks.length,
    longestTaskMs: Math.round(Math.max(0, ...tasks)),
  });
});
