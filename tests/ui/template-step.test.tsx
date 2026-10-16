import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { useAppStore } from '../../src/ui/store/app-store';
import { TemplateStep } from '../../src/ui/steps/TemplateStep';
import { PDF_TEMPLATE, createFakeServices, renderWithServices } from './test-utils';

const pdfFile = () => new File(['%PDF-1.7'], 'plantilla.pdf', { type: 'application/pdf' });

describe('TemplateStep', () => {
  it('shows an empty drop zone with an accessible file input', () => {
    renderWithServices(<TemplateStep />);
    expect(screen.getByText('Arrastra aquí tu plantilla o haz clic para elegirla')).toBeVisible();
    expect(screen.getByLabelText('Elegir plantilla (PDF, PNG o JPG)')).toHaveAttribute(
      'accept',
      expect.stringContaining('.pdf') as string,
    );
  });

  it('loads a PDF and shows its thumbnail, page size and weight', async () => {
    const user = userEvent.setup();
    const { services, engine } = createFakeServices();
    renderWithServices(<TemplateStep />, services);
    await user.upload(screen.getByLabelText('Elegir plantilla (PDF, PNG o JPG)'), pdfFile());
    expect(await screen.findByAltText('Miniatura de la plantilla plantilla.pdf')).toHaveAttribute(
      'src',
      'blob:preview',
    );
    expect(screen.getByText('297 × 210 mm')).toBeInTheDocument();
    expect(screen.getByText('Horizontal')).toBeInTheDocument();
    expect(screen.getByText('11.3 KB')).toBeInTheDocument();
    expect(engine.loadTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'plantilla.pdf' }),
    );
    expect(useAppStore.getState().template?.loaded).toBe(PDF_TEMPLATE);
  });

  it('warns about extra PDF pages', async () => {
    const user = userEvent.setup();
    const { services } = createFakeServices();
    services.engine.loadTemplate = vi.fn(() =>
      Promise.resolve({
        ...PDF_TEMPLATE,
        info: { ...PDF_TEMPLATE.info, warnings: [{ kind: 'extra-pages' as const, pageCount: 3 }] },
      }),
    );
    renderWithServices(<TemplateStep />, services);
    await user.upload(screen.getByLabelText('Elegir plantilla (PDF, PNG o JPG)'), pdfFile());
    expect(await screen.findByText(/tiene 3 páginas: se usará solo la primera/)).toBeVisible();
  });

  it.each([
    ['template-pdf-encrypted', /protegido con contraseña/],
    ['template-pdf-damaged', /parece estar dañado/],
    ['template-unsupported', /no es una plantilla válida/],
  ] as const)('shows a clear Spanish error for %s', async (code, message) => {
    const user = userEvent.setup();
    const { services } = createFakeServices();
    services.engine.loadTemplate = vi.fn(() => Promise.reject(new AppError(code)));
    renderWithServices(<TemplateStep />, services);
    await user.upload(screen.getByLabelText('Elegir plantilla (PDF, PNG o JPG)'), pdfFile());
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(useAppStore.getState().template).toBeNull();
  });

  it('offers to optimize heavy images and warns about transparency first', async () => {
    const user = userEvent.setup();
    const heavyPng = {
      bytes: new Uint8Array(7_000_000),
      info: {
        kind: 'png' as const,
        fileName: 'pesada.png',
        fileSize: 7_000_000,
        page: { width: 841.89, height: 595.33 },
        orientation: 'landscape' as const,
        rotation: 0 as const,
        pixels: { width: 2339, height: 1654 },
        hasTransparency: true,
        warnings: [{ kind: 'heavy-image' as const, bytes: 7_000_000 }],
      },
    };
    const jpg = {
      ...heavyPng,
      bytes: new Uint8Array(1000),
      info: {
        ...heavyPng.info,
        kind: 'jpg' as const,
        fileName: 'pesada.jpg',
        fileSize: 1000,
        warnings: [],
      },
    };
    const toJpeg = vi.fn((file: { name: string }) =>
      Promise.resolve({ name: file.name.replace(/\.png$/u, '.jpg'), bytes: new Uint8Array(1000) }),
    );
    const { services } = createFakeServices({
      imageOptimizer: { hasTransparency: vi.fn(() => Promise.resolve(true)), toJpeg },
    });
    services.engine.loadTemplate = vi
      .fn()
      .mockResolvedValueOnce(heavyPng)
      .mockResolvedValueOnce(jpg);
    renderWithServices(<TemplateStep />, services);
    await user.upload(
      screen.getByLabelText('Elegir plantilla (PDF, PNG o JPG)'),
      new File([new Uint8Array(10)], 'pesada.png', { type: 'image/png' }),
    );
    expect(await screen.findByText('Imagen pesada')).toBeVisible();
    expect(screen.getByText('2,339 × 1,654 px')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Optimizar' }));
    expect(await screen.findByText('La imagen tiene transparencia')).toBeVisible();
    expect(toJpeg).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Optimizar igual' }));
    await waitFor(() => {
      expect(useAppStore.getState().template?.loaded.info.kind).toBe('jpg');
    });
    expect(toJpeg).toHaveBeenCalledWith(expect.objectContaining({ name: 'pesada.png' }), 0.85);
    expect(useAppStore.getState().notice?.text).toMatch(/Plantilla optimizada: 6.7 MB → 1000 B/);
  });
});
