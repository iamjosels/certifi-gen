import { FileImage, FileText, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import type { LoadedTemplate, SourceFile } from '../../application/ports';
import { OPTIMIZED_JPEG_QUALITY, type TemplateWarning } from '../../domain/template';
import { Alert } from '../components/Alert';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { DropZone } from '../components/DropZone';
import { CertificateIllustration } from '../components/Illustrations';
import { readSourceFile } from '../files';
import { formatBytes, formatNumber, pointsToMm } from '../format';
import { useServices } from '../hooks/services-context';
import { errorMessage } from '../messages';
import { useAppStore, type TemplateState } from '../store/app-store';

const ORIENTATION_LABEL = { landscape: 'Horizontal', portrait: 'Vertical', square: 'Cuadrada' };
const KIND_LABEL = { pdf: 'PDF', png: 'PNG', jpg: 'JPG' };

function warningText(warning: TemplateWarning): string | null {
  switch (warning.kind) {
    case 'extra-pages':
      return `El PDF tiene ${String(warning.pageCount)} páginas: se usará solo la primera.`;
    case 'exif-rotated':
      return 'La foto traía una orientación EXIF: se enderezó automáticamente.';
    case 'heavy-image':
      return null;
  }
}

export function TemplateStep() {
  const { engine, rasterizer, imageOptimizer } = useServices();
  const template = useAppStore((state) => state.template);
  const setTemplate = useAppStore((state) => state.setTemplate);
  const setNotice = useAppStore((state) => state.setNotice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [transparencyWarning, setTransparencyWarning] = useState(false);

  async function preview(loaded: LoadedTemplate, file: SourceFile): Promise<TemplateState> {
    if (loaded.info.kind === 'pdf') {
      const image = await rasterizer.renderPdf(loaded.bytes, 1600);
      return {
        file,
        loaded,
        previewUrl: image.url,
        releasePreview: () => {
          image.release();
        },
      };
    }
    const url = URL.createObjectURL(
      new Blob([file.bytes as Uint8Array<ArrayBuffer>], {
        type: loaded.info.kind === 'png' ? 'image/png' : 'image/jpeg',
      }),
    );
    return {
      file,
      loaded,
      previewUrl: url,
      releasePreview: () => {
        URL.revokeObjectURL(url);
      },
    };
  }

  async function load(file: SourceFile): Promise<void> {
    const loaded = await engine.loadTemplate(file);
    setTemplate(await preview(loaded, file));
    setTransparencyWarning(false);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      await load(await readSourceFile(file));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function optimize(confirmTransparency: boolean) {
    if (!template) return;
    setOptimizing(true);
    setError(null);
    try {
      if (!confirmTransparency && (await imageOptimizer.hasTransparency(template.file))) {
        setTransparencyWarning(true);
        return;
      }
      const before = template.loaded.info.fileSize;
      const jpeg = await imageOptimizer.toJpeg(template.file, OPTIMIZED_JPEG_QUALITY);
      await load(jpeg);
      setNotice({
        kind: 'success',
        text: `Plantilla optimizada: ${formatBytes(before)} → ${formatBytes(jpeg.bytes.length)}.`,
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setOptimizing(false);
    }
  }

  const info = template?.loaded.info;
  const heavy = info?.warnings.some((warning) => warning.kind === 'heavy-image') ?? false;

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Paso 1"
        title="Sube la plantilla del certificado"
        description="El diseño sin nombres, en PDF, PNG o JPG. Exporta desde Canva como PDF y deja libre el espacio donde irá el nombre."
      />

      {error ? (
        <Alert tone="danger" title="No se pudo usar ese archivo">
          {error}
        </Alert>
      ) : null}

      {!template || !info ? (
        <DropZone
          label="Elegir plantilla (PDF, PNG o JPG)"
          title="Arrastra aquí tu plantilla o haz clic para elegirla"
          hint="PDF, PNG o JPG · horizontal o vertical · cualquier tamaño de página"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          illustration={<CertificateIllustration />}
          busy={busy}
          onFile={(file) => void handleFile(file)}
        />
      ) : (
        <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-6">
          <div className="flex items-center justify-center rounded-lg bg-canvas p-4">
            <img
              src={template.previewUrl}
              alt={`Miniatura de la plantilla ${info.fileName}`}
              className="max-h-[420px] w-auto rounded-sm shadow-lift"
            />
          </div>
          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">
                  {info.kind === 'pdf' ? (
                    <FileText aria-hidden className="size-3.5" />
                  ) : (
                    <FileImage aria-hidden className="size-3.5" />
                  )}
                  {KIND_LABEL[info.kind]}
                </Badge>
                <Badge tone="gold">{ORIENTATION_LABEL[info.orientation]}</Badge>
              </div>
              <p className="font-semibold break-all text-ink">{info.fileName}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted">Tamaño de página</dt>
                <dd className="font-semibold text-ink tabular-nums">
                  {pointsToMm(info.page.width)} × {pointsToMm(info.page.height)} mm
                </dd>
                <dd className="text-xs text-subtle tabular-nums">
                  {formatNumber(Math.round(info.page.width * 10) / 10)} ×{' '}
                  {formatNumber(Math.round(info.page.height * 10) / 10)} pt
                </dd>
              </div>
              <div>
                <dt className="text-muted">Peso</dt>
                <dd className="font-semibold text-ink tabular-nums">
                  {formatBytes(info.fileSize)}
                </dd>
                {info.pixels ? (
                  <dd className="text-xs text-subtle tabular-nums">
                    {formatNumber(info.pixels.width)} × {formatNumber(info.pixels.height)} px
                  </dd>
                ) : null}
              </div>
            </dl>

            {info.warnings.map((warning) => {
              const text = warningText(warning);
              return text ? (
                <Alert key={warning.kind} tone="info">
                  {text}
                </Alert>
              ) : null;
            })}

            {heavy ? (
              <Alert
                tone="warning"
                title="Imagen pesada"
                action={
                  !transparencyWarning ? (
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Wand2 aria-hidden className="size-4" />}
                      disabled={optimizing}
                      onClick={() => void optimize(false)}
                    >
                      {optimizing ? 'Optimizando…' : 'Optimizar'}
                    </Button>
                  ) : null
                }
              >
                Cada PDF incluye la plantilla completa ({formatBytes(info.fileSize)}). Convertirla a
                JPG (calidad 85 %) reduce mucho el peso del ZIP sin pérdida visible.
              </Alert>
            ) : null}

            {transparencyWarning ? (
              <Alert
                tone="warning"
                title="La imagen tiene transparencia"
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={optimizing}
                    onClick={() => void optimize(true)}
                  >
                    Optimizar igual
                  </Button>
                }
              >
                El JPG no admite transparencia: esas zonas quedarán blancas.
              </Alert>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2">
              <DropZone
                compact
                label="Reemplazar plantilla"
                title="Cambiar plantilla"
                hint="Arrastra otro archivo o haz clic"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                illustration={<RefreshCw aria-hidden className="mx-auto size-6 text-accent" />}
                busy={busy}
                onFile={(file) => void handleFile(file)}
              />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-subtle">
              <Sparkles aria-hidden className="size-3.5 text-gold" />
              La plantilla se incrusta una sola vez en el PDF único, para que pese poco.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
