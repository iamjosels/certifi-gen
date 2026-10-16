import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseConfig } from '../../src/domain/config';
import { ConfigMenu } from '../../src/ui/components/ConfigMenu';
import { useAppStore } from '../../src/ui/store/app-store';
import { createFakeServices, renderWithServices, seedStore } from './test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

function captureDownloads() {
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return 'blob:download';
  });
  const clicks = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return { blobs, clicks };
}

describe('ConfigMenu', () => {
  it('exports fields, positions, fonts and mode as JSON (never the files)', async () => {
    await seedStore(['Ana', 'Luis']);
    const state = useAppStore.getState();
    state.addField('sequence');
    state.updateField('name', { fontId: 'poppins', box: { x: 0.1, y: 0.42, width: 0.8 } });
    state.setMode('zip');
    const { blobs, clicks } = captureDownloads();
    renderWithServices(<ConfigMenu />);
    await userEvent.click(screen.getByRole('button', { name: /Exportar/ }));
    expect(clicks).toHaveBeenCalled();
    const json = await blobs[0]?.text();
    const { config } = parseConfig(json ?? '', {
      availableFontIds: ['dm-serif-display', 'poppins'],
      templateAspectRatio: null,
    });
    expect(config.fields.map((field) => field.id)).toEqual(['name', 'field-1']);
    expect(config.fields[0]).toMatchObject({
      fontId: 'poppins',
      box: { x: 0.1, y: 0.42, width: 0.8 },
    });
    expect(config.output.mode).toBe('zip');
    expect(config.template).toMatchObject({ kind: 'pdf' });
    expect(json).not.toContain('Ana');
  });

  it('imports a configuration and reports missing fonts', async () => {
    await seedStore(['Ana']);
    const config = {
      app: 'certifi-gen',
      schemaVersion: 1,
      savedAt: '2026-10-15T00:00:00.000Z',
      output: { mode: 'merged' },
      template: { kind: 'pdf', aspectRatio: 841.89 / 595.28 },
      nameColumn: null,
      customFonts: [{ id: 'user-x', name: 'Mi Letra' }],
      fields: [
        {
          id: 'name',
          label: 'Nombre',
          source: { kind: 'name' },
          box: { x: 0.2, y: 0.55, width: 0.6 },
          fontId: 'user-x',
          maxSize: 36,
          minSize: 12,
          color: '#000000',
          align: 'center',
          transform: 'title',
        },
      ],
    };
    renderWithServices(<ConfigMenu />, createFakeServices().services);
    await userEvent.upload(
      screen.getByLabelText(/Importar/),
      new File([JSON.stringify(config)], 'config.json', { type: 'application/json' }),
    );
    await waitFor(() => {
      expect(useAppStore.getState().fields[0]).toMatchObject({
        box: { x: 0.2, y: 0.55, width: 0.6 },
        transform: 'title',
        fontId: 'dm-serif-display',
      });
    });
    expect(useAppStore.getState().mode).toBe('merged');
    expect(useAppStore.getState().notice?.text).toMatch(/«Mi Letra» no está disponible/);
  });

  it('rejects files that are not a configuration', async () => {
    renderWithServices(<ConfigMenu />);
    await userEvent.upload(
      screen.getByLabelText(/Importar/),
      new File(['{"hola":1}'], 'otro.json', { type: 'application/json' }),
    );
    await waitFor(() => {
      expect(useAppStore.getState().notice?.text).toMatch(/no es una configuración válida/);
    });
  });
});
