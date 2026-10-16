import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { GenerationEngine } from '../../src/application/ports';
import { AppError } from '../../src/domain/errors';
import { useAppStore } from '../../src/ui/store/app-store';
import { GenerateStep } from '../../src/ui/steps/GenerateStep';
import { createFakeServices, fakeOutput, renderWithServices, seedStore } from './test-utils';

const NAMES = Array.from({ length: 10 }, (_, i) => `Participante ${String(i + 1)}`);

async function setup(generate?: GenerationEngine['generate']) {
  await seedStore(NAMES);
  const { services, engine } = createFakeServices();
  if (generate) engine.generate.mockImplementation(generate);
  const user = userEvent.setup();
  renderWithServices(<GenerateStep />, services);
  return { user, engine };
}

describe('GenerateStep', () => {
  it('estimates the output size for the chosen mode', async () => {
    const { user } = await setup();
    expect(await screen.findByText('≈ 191 KB')).toBeVisible();
    expect(screen.getByText('≈ 39.1 KB')).toBeVisible();
    await user.click(screen.getByRole('radio', { name: /Un solo PDF con todos/ }));
    expect(useAppStore.getState().mode).toBe('merged');
    expect(screen.queryByText('ZIP')).not.toBeInTheDocument();
  });

  it('shows progress with the count and remaining time, then the downloads', async () => {
    let finish: (() => void) | undefined;
    const { user, engine } = await setup((request, onProgress) => {
      onProgress({ phase: 'rendering', done: 4, total: 10, elapsedMs: 2000 });
      return new Promise((resolve) => {
        finish = () => {
          resolve(fakeOutput(request.participants.length));
        };
      });
    });
    await user.click(screen.getByRole('button', { name: 'Generar 10 certificados' }));
    expect(await screen.findByTestId('progress-count')).toHaveTextContent('4/10 · quedan ~3 s');
    expect(screen.getByRole('progressbar', { name: 'Progreso de la generación' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    expect(engine.generate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'both', participants: expect.any(Array) as unknown }),
      expect.any(Function),
      expect.any(AbortSignal),
    );
    finish?.();
    expect(await screen.findByText('¡Listo! 10 certificados generados')).toBeVisible();
    const zip = screen.getByRole('link', { name: /Descargar ZIP/ });
    expect(zip).toHaveAttribute(
      'download',
      expect.stringMatching(/^certificados_\d{4}-\d{2}-\d{2}\.zip$/) as string,
    );
    expect(zip).toHaveAttribute('href', expect.stringMatching(/^blob:/) as string);
    expect(screen.getByRole('link', { name: /Descargar PDF único/ })).toHaveAttribute(
      'download',
      expect.stringMatching(/\.pdf$/) as string,
    );
  });

  it('cancels a running generation and lets the user generate again', async () => {
    const { user } = await setup(
      (_request, _onProgress, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new AppError('generation-cancelled'));
          });
        }),
    );
    await user.click(screen.getByRole('button', { name: 'Generar 10 certificados' }));
    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText(/Generación cancelada/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a generar' })).toBeEnabled();
  });

  it('shows a Spanish error when the generation fails', async () => {
    const { user } = await setup(() => Promise.reject(new AppError('worker-unavailable')));
    await user.click(screen.getByRole('button', { name: 'Generar 10 certificados' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/motor de generación no respondió/);
  });

  it('warns before generating when names overflow', async () => {
    await seedStore(NAMES);
    const { services } = createFakeServices();
    const state = useAppStore.getState();
    state.updateField('name', { box: { x: 0.45, y: 0.5, width: 0.05 } });
    state.setMeasurements({
      fields: { name: { unitWidths: NAMES.map(() => 100), missingChars: [], capHeight: 0.7 } },
    });
    renderWithServices(<GenerateStep />, services);
    expect(await screen.findByText(/10 certificados tienen texto que no entra/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Revisar diseño' }));
    await waitFor(() => {
      expect(useAppStore.getState().step).toBe(2);
    });
  });

  it('suggests optimizing when the ZIP would be huge', async () => {
    await seedStore(NAMES);
    const { services, engine } = createFakeServices();
    engine.estimate.mockResolvedValue({
      individualSizes: [80 * 1024 * 1024],
      mergedSmall: { pages: 10, bytes: 7_000_000 },
      mergedLarge: { pages: 20, bytes: 7_100_000 },
    });
    const template = useAppStore.getState().template;
    if (template) {
      useAppStore.getState().setTemplate({
        ...template,
        loaded: { ...template.loaded, info: { ...template.loaded.info, kind: 'png' } },
      });
    }
    renderWithServices(<GenerateStep />, services);
    expect(await screen.findByText('El ZIP será muy pesado')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Optimizar plantilla' }));
    expect(useAppStore.getState().step).toBe(0);
    vi.restoreAllMocks();
  });
});
