import { expect, test } from './fixtures';
import {
  expectNoA11yViolations,
  generate,
  next,
  selectMode,
  uploadList,
  uploadTemplate,
} from './helpers';

for (const theme of ['light', 'dark'] as const) {
  test(`every step passes axe (WCAG 2.1 AA) in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await expectNoA11yViolations(page, `${theme}: template (empty)`);
    await uploadTemplate(page, 'plantilla-horizontal.png');
    await expectNoA11yViolations(page, `${theme}: template (loaded)`);
    await next(page);
    await uploadList(page, 'participantes-360.csv');
    await expectNoA11yViolations(page, `${theme}: participants`);
    await next(page);
    await expect(page.getByText(/Todos los textos entran/)).toBeVisible();
    await expectNoA11yViolations(page, `${theme}: design`);
    await next(page);
    await selectMode(page, 'merged');
    await expectNoA11yViolations(page, `${theme}: generate`);
    await generate(page, 360);
    await expectNoA11yViolations(page, `${theme}: done`);
  });
}

test('the whole flow works with the keyboard only', async ({ page }) => {
  await page.goto('/');
  await uploadTemplate(page, 'plantilla-horizontal.pdf');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  await uploadList(page, 'participantes-360.txt');
  await page.getByRole('button', { name: 'Continuar' }).focus();
  await page.keyboard.press('Enter');
  const box = page.locator('[data-field-id="name"]');
  await box.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByRole('spinbutton', { name: 'Altura' })).toHaveValue('55');
  await page.keyboard.press('Alt+ArrowRight');
  await expect(page.getByRole('spinbutton', { name: 'Ancho' })).toHaveValue('76.5');
});
