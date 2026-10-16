import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moveBox, resizeBox, SNAP } from '../../src/ui/steps/design/box-math';
import { useAppStore } from '../../src/ui/store/app-store';
import { App } from '../../src/ui/App';
import { createFakeServices, renderWithServices, seedStore } from './test-utils';

const NAMES = [
  'Ana Ruiz',
  'María de los Ángeles Fernández-Villaverde y Santisteban',
  'Luis Pérez',
  'José Ignacio Rodríguez de la Fuente Echeverría Aranguren',
  'Begoña Núñez Ibáñez',
];

async function openDesign(services = createFakeServices().services) {
  await seedStore(NAMES);
  useAppStore.getState().setStep(2);
  const user = userEvent.setup();
  renderWithServices(<App />, services);
  await screen.findByRole('heading', { name: 'Ubica los campos sobre la plantilla' });
  await waitFor(() => {
    expect(useAppStore.getState().measurements).not.toBeNull();
  });
  return user;
}

function nameBox() {
  const box = document.querySelector('[data-field-id="name"]');
  if (!box) throw new Error('name box not rendered');
  return box as SVGGElement;
}

describe('box math', () => {
  it('snaps the box center to the page center', () => {
    const near = moveBox({ x: 0.1, y: 0.3, width: 0.6 }, 0.1 + SNAP / 2, 0.2 - SNAP / 2);
    expect(near.box.x).toBeCloseTo(0.2);
    expect(near.box.y).toBe(0.5);
    expect(near.guides).toEqual({ vertical: true, horizontal: true });
    const far = moveBox({ x: 0.1, y: 0.3, width: 0.6 }, 0.05, 0);
    expect(far.guides).toEqual({ vertical: false, horizontal: false });
    expect(moveBox({ x: 0.1, y: 0.3, width: 0.6 }, 2, -2).box).toEqual({
      x: 0.4,
      y: 0,
      width: 0.6,
    });
  });

  it('resizes from either edge within the page', () => {
    expect(resizeBox({ x: 0.2, y: 0.5, width: 0.4 }, 'right', 0.1).width).toBeCloseTo(0.5);
    expect(resizeBox({ x: 0.2, y: 0.5, width: 0.4 }, 'right', 2).width).toBeCloseTo(0.8);
    const left = resizeBox({ x: 0.2, y: 0.5, width: 0.4 }, 'left', -0.1);
    expect(left.x).toBeCloseTo(0.1);
    expect(left.width).toBeCloseTo(0.5);
    expect(resizeBox({ x: 0.2, y: 0.5, width: 0.4 }, 'left', 1).width).toBeCloseTo(0.02);
  });
});

describe('DesignStep', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('draws the name box over the template with the selected participant', async () => {
    await openDesign();
    expect(document.querySelector('img[src="blob:preview"]')).not.toBeNull();
    expect(nameBox()).toHaveTextContent('Ana Ruiz');
    expect(nameBox()).toHaveAttribute('data-overflow', 'false');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Participante para la vista previa' }),
      '2',
    );
    expect(nameBox()).toHaveTextContent('Luis Pérez');
  });

  it('moves the box with the keyboard and resizes it with Alt + arrows', async () => {
    const user = await openDesign();
    const before = useAppStore.getState().fields[0]?.box;
    nameBox().focus();
    await user.keyboard('{ArrowUp}');
    expect(useAppStore.getState().fields[0]?.box.y).toBeCloseTo((before?.y ?? 0) - 0.005);
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(useAppStore.getState().fields[0]?.box.x).toBeCloseTo((before?.x ?? 0) + 0.05);
    await user.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(useAppStore.getState().fields[0]?.box.width).toBeCloseTo((before?.width ?? 0) - 0.005);
  });

  it('edits the field properties from the side panel', async () => {
    const user = await openDesign();
    const panel = screen.getByRole('complementary', { name: 'Propiedades del campo' });
    const max = within(panel).getByRole('spinbutton', { name: 'Tamaño máximo' });
    fireEvent.change(max, { target: { value: '32' } });
    expect(useAppStore.getState().fields[0]?.maxSize).toBe(32);
    fireEvent.change(within(panel).getByRole('spinbutton', { name: 'Tamaño mínimo' }), {
      target: { value: '40' },
    });
    expect(useAppStore.getState().fields[0]).toMatchObject({ minSize: 40, maxSize: 40 });
    await user.click(within(panel).getByRole('radio', { name: 'Alinear a la izquierda' }));
    await user.click(within(panel).getByRole('radio', { name: 'MAYÚS' }));
    expect(useAppStore.getState().fields[0]).toMatchObject({ align: 'left', transform: 'upper' });
    expect(nameBox()).toHaveTextContent('ANA RUIZ');
    await user.selectOptions(within(panel).getByRole('combobox', { name: 'Fuente' }), 'poppins');
    expect(useAppStore.getState().fields[0]?.fontId).toBe('poppins');
    fireEvent.change(within(panel).getByRole('spinbutton', { name: 'Ancho' }), {
      target: { value: '50' },
    });
    await user.click(within(panel).getByRole('button', { name: 'Centrar en la página' }));
    expect(useAppStore.getState().fields[0]?.box).toMatchObject({ x: 0.25, width: 0.5 });
  });

  it('adds a correlative code field and removes it', async () => {
    const user = await openDesign();
    await user.click(screen.getByRole('button', { name: 'Agregar campo' }));
    await user.click(screen.getByRole('button', { name: /Código correlativo/ }));
    expect(screen.getByRole('tab', { name: 'Código', selected: true })).toBeVisible();
    expect(screen.getByText('Ejemplo: CERT-2026-001')).toBeVisible();
    const pattern = screen.getByRole('textbox', { name: 'Patrón del código' });
    await user.clear(pattern);
    await user.type(pattern, 'CERT');
    expect(screen.getByText(/Incluye \{n\}/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Eliminar campo' }));
    expect(useAppStore.getState().fields).toHaveLength(1);
  });

  it('shows the 3 widest names and flags the ones that overflow before generating', async () => {
    const user = await openDesign();
    await user.click(screen.getByRole('button', { name: 'Ver los más largos' }));
    const longest = screen.getByRole('list', { name: 'Los 3 nombres más anchos' });
    expect(
      within(longest)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([
      '1. José Ignacio Rodríguez de la Fuente Echeverría Aranguren',
      '2. María de los Ángeles Fernández-Villaverde y Santisteban',
      '3. Begoña Núñez Ibáñez',
    ]);
    expect(nameBox()).toHaveTextContent('José Ignacio');

    expect(screen.getByText(/Todos los textos entran en sus cajas/)).toBeVisible();
    const panel = screen.getByRole('complementary', { name: 'Propiedades del campo' });
    fireEvent.change(within(panel).getByRole('spinbutton', { name: 'Ancho' }), {
      target: { value: '20' },
    });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('textos no entran en «Nombre» ni al tamaño mínimo');
    expect(nameBox()).toHaveAttribute('data-overflow', 'true');
  });

  it('opens the real preview generated by the engine', async () => {
    const { services, engine } = createFakeServices();
    const user = await openDesign(services);
    await user.click(screen.getByRole('button', { name: 'Vista previa real' }));
    expect(
      await screen.findByAltText('Certificado generado para el participante seleccionado'),
    ).toHaveAttribute('src', 'blob:preview');
    expect(engine.preview).toHaveBeenCalledWith(
      expect.objectContaining({
        participant: expect.objectContaining({ name: 'Ana Ruiz' }) as unknown,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('uploads a custom font and selects it', async () => {
    const { services, engine } = createFakeServices();
    const user = await openDesign(services);
    await user.upload(
      screen.getByLabelText('Subir fuente TTF u OTF'),
      new File([new Uint8Array([0, 1, 0, 0])], 'mia.ttf', { type: 'font/ttf' }),
    );
    await waitFor(() => {
      expect(useAppStore.getState().fields[0]?.fontId).toBe('user-mia.ttf');
    });
    expect(engine.inspectFont).toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: 'Fuente' })).toHaveDisplayValue(
      'Mi Fuente · subida por ti',
    );
  });
});
