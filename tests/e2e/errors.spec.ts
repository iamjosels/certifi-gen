import { expect, test } from './fixtures';
import { fixture, next, uploadTemplate } from './helpers';

const TEMPLATE_INPUT = 'Elegir plantilla (PDF, PNG o JPG)';

test.describe('expected errors', () => {
  for (const [file, message] of [
    ['formato-no-soportado.gif', /no es una plantilla válida/],
    ['plantilla-danada.pdf', /parece estar dañado/],
    ['plantilla-protegida.pdf', /protegido con contraseña/],
  ] as const) {
    test(`template ${file}`, async ({ page }) => {
      await page.goto('/');
      await page.getByLabel(TEMPLATE_INPUT).setInputFiles(fixture(file));
      await expect(page.getByRole('alert')).toContainText(message);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    });
  }

  for (const [file, message] of [
    ['lista-vacia.txt', /no tiene ningún nombre/],
    ['lista-no-soportada.json', /Formato de lista no soportado/],
  ] as const) {
    test(`list ${file}`, async ({ page }) => {
      await page.goto('/');
      await uploadTemplate(page, 'plantilla-horizontal.pdf');
      await next(page);
      await page.getByLabel('Elegir lista de participantes').setInputFiles(fixture(file));
      await expect(page.getByRole('alert')).toContainText(message);
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    });
  }

  test('a template error can be fixed by uploading a valid file', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(TEMPLATE_INPUT).setInputFiles(fixture('plantilla-danada.pdf'));
    await expect(page.getByRole('alert')).toBeVisible();
    await uploadTemplate(page, 'plantilla-2-paginas.pdf');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText(/tiene 2 páginas: se usará solo la primera/)).toBeVisible();
  });
});
