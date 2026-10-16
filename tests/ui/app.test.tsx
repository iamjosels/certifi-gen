import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/ui/App';
import { useAppStore } from '../../src/ui/store/app-store';
import { createFakeServices, renderWithServices, seedStore } from './test-utils';

describe('App shell', () => {
  it('renders the Spanish title, the 4 steps and the privacy note', () => {
    renderWithServices(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Generador masivo de certificados' }),
    ).toBeInTheDocument();
    const steps = screen.getByRole('navigation', { name: 'Pasos' });
    for (const label of ['Plantilla', 'Participantes', 'Diseño', 'Generar']) {
      expect(steps).toHaveTextContent(label);
    }
    expect(screen.getByText('Tus archivos nunca salen de tu navegador')).toBeInTheDocument();
  });

  it('only lets the user continue once the step has what it needs', async () => {
    const user = userEvent.setup();
    renderWithServices(<App />);
    expect(screen.getByRole('button', { name: /Continuar/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Participantes/ })).toBeDisabled();

    await seedStore(['Ana Ruiz', 'Luis Pérez']);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continuar/ })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: /Continuar/ }));
    expect(useAppStore.getState().step).toBe(1);
    await user.click(screen.getByRole('button', { name: /Diseño/ }));
    expect(useAppStore.getState().step).toBe(2);
    await user.click(screen.getByRole('button', { name: /Atrás/ }));
    expect(useAppStore.getState().step).toBe(1);
  });

  it('restores the last saved configuration on start', async () => {
    const saved = JSON.stringify({
      app: 'certifi-gen',
      schemaVersion: 1,
      savedAt: '2026-10-15T00:00:00.000Z',
      output: { mode: 'zip' },
      template: null,
      nameColumn: null,
      customFonts: [],
      fields: [
        {
          id: 'name',
          label: 'Nombre',
          source: { kind: 'name' },
          box: { x: 0.2, y: 0.4, width: 0.6 },
          fontId: 'poppins',
          maxSize: 30,
          minSize: 12,
          color: '#112233',
          align: 'left',
          transform: 'upper',
        },
      ],
    });
    const { services } = createFakeServices({
      configStorage: { load: () => saved, save: () => true },
    });
    renderWithServices(<App />, services);
    await waitFor(() => {
      expect(useAppStore.getState().fields[0]).toMatchObject({ fontId: 'poppins', align: 'left' });
    });
    expect(useAppStore.getState().mode).toBe('zip');
    expect(screen.getByRole('status')).toHaveTextContent('Restauramos el diseño');
  });

  it('switches the theme and remembers it', async () => {
    const user = userEvent.setup();
    renderWithServices(<App />);
    await user.click(screen.getByRole('radio', { name: 'Tema oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('certifica:theme')).toBe('dark');
    await user.click(screen.getByRole('radio', { name: 'Tema claro' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
