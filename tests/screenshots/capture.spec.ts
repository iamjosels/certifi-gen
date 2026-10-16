import { join } from 'node:path';
import { expect, test } from '../e2e/fixtures';
import { ROOT, generate, next, prepare, selectMode, uploadTemplate } from '../e2e/helpers';

const OUT = join(ROOT, 'docs', 'screenshots');

for (const theme of ['light', 'dark'] as const) {
  test(`capture the four steps (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.screenshot({ path: join(OUT, `${theme}-1-plantilla-vacia.png`) });
    await uploadTemplate(page, 'plantilla-horizontal.pdf');
    await page.screenshot({ path: join(OUT, `${theme}-1-plantilla.png`) });
    await prepare(page, 'plantilla-horizontal.pdf', 'participantes-360-windows1252.csv');
    await page.getByRole('button', { name: 'Ver los más largos' }).click();
    await page.screenshot({ path: join(OUT, `${theme}-3-diseno.png`) });
    await page.getByRole('button', { name: 'Atrás' }).click();
    await expect(page.getByText('Participantes válidos')).toBeVisible();
    await page.screenshot({ path: join(OUT, `${theme}-2-participantes.png`) });
    await next(page);
    await next(page);
    await selectMode(page, 'both');
    await generate(page, 360);
    await page.screenshot({ path: join(OUT, `${theme}-4-generar.png`) });
  });
}

test('capture an empty template step on a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-vertical.pdf');
  await page.screenshot({ path: join(OUT, 'tablet-plantilla-vertical.png') });
});
