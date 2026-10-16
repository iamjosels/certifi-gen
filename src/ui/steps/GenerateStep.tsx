import { Archive, Download, FileStack, Files, Loader2, RotateCcw, Square, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isAppError } from '../../domain/errors';
import { invalidFields } from '../../domain/field';
import { archiveFileName } from '../../domain/filename';
import { estimateProgress } from '../../domain/progress';
import {
  estimateOutputSize,
  LARGE_OUTPUT_BYTES,
  type OutputMode,
  type SizeSample,
} from '../../domain/size-estimate';
import { Alert } from '../components/Alert';
import { Stat } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { SparkIllustration } from '../components/Illustrations';
import { ProgressBar } from '../components/ProgressBar';
import { formatBytes, formatDuration, formatNumber } from '../format';
import { useServices } from '../hooks/services-context';
import { useOverflows } from '../hooks/use-measurements';
import { errorMessage } from '../messages';
import { useAppStore } from '../store/app-store';

const MODES: readonly {
  value: OutputMode;
  title: string;
  description: string;
  icon: typeof Archive;
}[] = [
  {
    value: 'zip',
    title: 'ZIP con un PDF por persona',
    description: 'Ideal para enviar cada certificado por separado. Incluye reporte.csv.',
    icon: Archive,
  },
  {
    value: 'merged',
    title: 'Un solo PDF con todos',
    description: 'Una página por participante, liviano: la plantilla va una sola vez.',
    icon: FileStack,
  },
  {
    value: 'both',
    title: 'Ambos',
    description: 'El ZIP y el PDF único, en una sola generación.',
    icon: Files,
  },
];

function useSizeSample(): { sample: SizeSample | null; failed: boolean } {
  const { engine, fonts } = useServices();
  const template = useAppStore((state) => state.template);
  const fields = useAppStore((state) => state.fields);
  const participants = useAppStore((state) => state.participants?.list.participants);
  const [sample, setSample] = useState<SizeSample | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!template || !participants) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const fontIds = [...new Set(fields.map((field) => field.fontId))];
          const assets = await Promise.all(fontIds.map((id) => fonts.load(id)));
          const result = await engine.estimate({
            template: template.loaded,
            fields,
            fonts: assets,
            participants,
          });
          if (!cancelled) {
            setSample(result);
            setFailed(false);
          }
        } catch {
          if (!cancelled) setFailed(true);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [template, fields, participants, engine, fonts]);

  return { sample, failed };
}

export function GenerateStep() {
  const { engine, fonts } = useServices();
  const template = useAppStore((state) => state.template);
  const participants = useAppStore((state) => state.participants);
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const generation = useAppStore((state) => state.generation);
  const setGeneration = useAppStore((state) => state.setGeneration);
  const setStep = useAppStore((state) => state.setStep);
  const overflows = useOverflows();
  const fields = useAppStore((state) => state.fields);
  const invalid = invalidFields(fields);
  const { sample, failed } = useSizeSample();
  const controller = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  if (!template || !participants) return null;
  const list = participants.list.participants;
  const total = list.length;
  const estimate = sample ? estimateOutputSize(sample, total, mode) : null;
  const heavyZip =
    estimate?.zipBytes !== null &&
    estimate?.zipBytes !== undefined &&
    estimate.zipBytes > LARGE_OUTPUT_BYTES;
  const overflowParticipants = new Set(overflows.map((item) => item.participantIndex)).size;
  const running = generation.status === 'running';

  async function generate() {
    const state = useAppStore.getState();
    if (!state.template || !state.participants) return;
    const abort = new AbortController();
    controller.current = abort;
    setGeneration({ status: 'running', progress: null });
    try {
      const fontIds = [...new Set(state.fields.map((field) => field.fontId))];
      const assets = await Promise.all(fontIds.map((id) => fonts.load(id)));
      const output = await engine.generate(
        {
          template: state.template.loaded,
          fields: state.fields,
          fonts: assets,
          participants: state.participants.list.participants,
          mode: state.mode,
        },
        (progress) => {
          if (!abort.signal.aborted) setGeneration({ status: 'running', progress });
        },
        abort.signal,
      );
      setGeneration({
        status: 'done',
        output,
        urls: {
          zip: output.zip ? URL.createObjectURL(output.zip) : null,
          merged: output.merged ? URL.createObjectURL(output.merged) : null,
        },
      });
    } catch (error) {
      if (isAppError(error) && error.code === 'generation-cancelled') {
        setGeneration({ status: 'cancelled' });
      } else {
        setGeneration({ status: 'error', message: errorMessage(error) });
      }
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }

  const progress = generation.status === 'running' ? generation.progress : null;
  const eta = progress ? estimateProgress(progress) : null;
  const baseName = 'certificados';
  const today = new Date();

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Paso 4"
        title="Genera los certificados"
        description={`${formatNumber(total)} participantes · todo se procesa en tu navegador, sin subir archivos.`}
      />

      <fieldset disabled={running} className="grid gap-3 md:grid-cols-3">
        <legend className="sr-only">Qué quieres descargar</legend>
        {MODES.map(({ value, title, description, icon: Icon }) => {
          const checked = mode === value;
          return (
            <label
              key={value}
              className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border p-4 transition duration-200 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/25 ${
                checked
                  ? 'border-accent bg-accent-soft shadow-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="output-mode"
                value={value}
                checked={checked}
                onChange={() => {
                  setMode(value);
                }}
                className="sr-only"
              />
              <span className="flex items-center gap-2">
                <span
                  className={`flex size-9 items-center justify-center rounded-lg ${checked ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-muted'}`}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="font-semibold text-ink">{title}</span>
              </span>
              <span className="text-sm text-muted">{description}</span>
            </label>
          );
        })}
      </fieldset>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-ink">Peso estimado</h3>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {mode !== 'merged' ? (
            <Stat
              label="ZIP"
              value={estimate?.zipBytes != null ? `≈ ${formatBytes(estimate.zipBytes)}` : '…'}
              tone={heavyZip ? 'warning' : 'neutral'}
            />
          ) : null}
          {mode !== 'zip' ? (
            <Stat
              label="PDF único"
              value={estimate?.mergedBytes != null ? `≈ ${formatBytes(estimate.mergedBytes)}` : '…'}
            />
          ) : null}
        </dl>
        {failed ? (
          <p className="mt-2 text-xs text-subtle">
            No se pudo estimar el peso; puedes generar igual.
          </p>
        ) : null}
        {heavyZip ? (
          <Alert
            tone="warning"
            className="mt-3"
            title="El ZIP será muy pesado"
            action={
              template.loaded.info.kind !== 'pdf' ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setStep(0);
                  }}
                >
                  Optimizar plantilla
                </Button>
              ) : null
            }
          >
            Cada PDF incluye la plantilla completa. Optimiza la imagen a JPG o elige solo el PDF
            único, que la incrusta una sola vez.
          </Alert>
        ) : null}
      </Card>

      {invalid.length > 0 ? (
        <Alert
          tone="danger"
          title="Hay un código con un patrón no válido"
          action={
            <Button
              size="sm"
              onClick={() => {
                setStep(2);
              }}
            >
              Corregir
            </Button>
          }
        >
          El campo «{invalid[0]?.label}» debe incluir {'{n}'} o {'{n:000}'} en su patrón.
        </Alert>
      ) : null}

      {overflowParticipants > 0 ? (
        <Alert
          tone="warning"
          title={`${formatNumber(overflowParticipants)} ${overflowParticipants === 1 ? 'certificado tiene' : 'certificados tienen'} texto que no entra en su caja`}
          action={
            <Button
              size="sm"
              onClick={() => {
                setStep(2);
              }}
            >
              Revisar diseño
            </Button>
          }
        >
          Se dibujarán al tamaño mínimo y quedarán marcados en reporte.csv.
        </Alert>
      ) : null}

      <Card className="p-5 md:p-6">
        {generation.status === 'idle' ||
        generation.status === 'cancelled' ||
        generation.status === 'error' ? (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1" aria-live="polite">
              {generation.status === 'cancelled' ? (
                <p className="font-semibold text-warning">
                  Generación cancelada. Puedes volver a generar.
                </p>
              ) : generation.status === 'error' ? (
                <p role="alert" className="font-semibold text-danger">
                  {generation.message}
                </p>
              ) : (
                <p className="font-semibold text-ink">Todo listo para generar.</p>
              )}
              <p className="text-sm text-muted">
                Puedes seguir usando la página mientras se generan: el trabajo corre en segundo
                plano.
              </p>
            </div>
            <Button
              size="lg"
              variant="primary"
              icon={
                generation.status === 'idle' ? (
                  <Zap aria-hidden className="size-5" />
                ) : (
                  <RotateCcw aria-hidden className="size-5" />
                )
              }
              disabled={invalid.length > 0}
              onClick={() => void generate()}
            >
              {generation.status === 'idle'
                ? `Generar ${formatNumber(total)} certificados`
                : 'Volver a generar'}
            </Button>
          </div>
        ) : null}

        {generation.status === 'running' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div aria-live="polite">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <Loader2 aria-hidden className="size-4 animate-spin text-accent" />
                  {progress?.phase === 'packaging'
                    ? 'Empaquetando los archivos…'
                    : 'Generando certificados…'}
                </p>
                <p className="text-sm text-muted tabular-nums" data-testid="progress-count">
                  {formatNumber(progress?.done ?? 0)}/{formatNumber(total)}
                  {eta?.remainingMs != null && progress?.phase !== 'packaging'
                    ? ` · quedan ~${formatDuration(eta.remainingMs)}`
                    : ''}
                </p>
              </div>
              <Button
                variant="danger"
                icon={<Square aria-hidden className="size-4" />}
                onClick={() => {
                  controller.current?.abort();
                }}
              >
                Cancelar
              </Button>
            </div>
            <ProgressBar value={eta?.fraction ?? 0} label="Progreso de la generación" />
          </div>
        ) : null}

        {generation.status === 'done' ? (
          <div className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
            <SparkIllustration className="mx-auto w-24 animate-[pop-in_0.4s_ease-out]" />
            <div className="space-y-4">
              <div aria-live="polite">
                <p className="font-display text-2xl text-ink">
                  ¡Listo! {formatNumber(generation.output.report.length)} certificados generados
                </p>
                <p className="text-sm text-muted">
                  En {formatDuration(generation.output.elapsedMs)}
                  {generation.output.overflowCount > 0
                    ? ` · ${formatNumber(generation.output.overflowCount)} con texto al tamaño mínimo (ver reporte.csv)`
                    : ' · sin textos desbordados'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {generation.urls.zip && generation.output.zip ? (
                  <a
                    href={generation.urls.zip}
                    download={archiveFileName(baseName, today, 'zip')}
                    className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink shadow-soft transition hover:-translate-y-px hover:bg-accent-hover"
                  >
                    <Download aria-hidden className="size-4" />
                    Descargar ZIP ({formatBytes(generation.output.zip.size)})
                  </a>
                ) : null}
                {generation.urls.merged && generation.output.merged ? (
                  <a
                    href={generation.urls.merged}
                    download={archiveFileName(baseName, today, 'pdf')}
                    className="inline-flex h-11 items-center gap-2 rounded-lg border border-accent bg-surface px-5 text-sm font-semibold text-accent-soft-ink transition hover:-translate-y-px hover:bg-accent-soft"
                  >
                    <Download aria-hidden className="size-4" />
                    Descargar PDF único ({formatBytes(generation.output.merged.size)})
                  </a>
                ) : null}
                <Button
                  icon={<RotateCcw aria-hidden className="size-4" />}
                  onClick={() => {
                    setGeneration({ status: 'idle' });
                  }}
                >
                  Generar de nuevo
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
