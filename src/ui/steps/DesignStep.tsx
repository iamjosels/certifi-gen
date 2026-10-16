import { ChevronLeft, ChevronRight, Eye, Ruler } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { RasterImage } from '../../application/ports';
import { NAME_FIELD_ID } from '../../domain/field';
import { widestIndexes } from '../../domain/layout';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { Modal } from '../components/Modal';
import { formatNumber } from '../format';
import { useServices } from '../hooks/services-context';
import { useOverflows } from '../hooks/use-measurements';
import { errorMessage } from '../messages';
import { useAppStore } from '../store/app-store';
import { DesignCanvas } from './design/DesignCanvas';
import { FieldPanel } from './design/FieldPanel';

function ParticipantPicker() {
  const participants = useAppStore((state) => state.participants?.list.participants);
  const previewIndex = useAppStore((state) => state.previewIndex);
  const setPreviewIndex = useAppStore((state) => state.setPreviewIndex);
  const nameWidths = useAppStore((state) => state.measurements?.fields[NAME_FIELD_ID]?.unitWidths);
  const [showLongest, setShowLongest] = useState(false);
  const longest = useMemo(() => (nameWidths ? widestIndexes(nameWidths, 3) : []), [nameWidths]);

  if (!participants || participants.length === 0) return null;
  const count = participants.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          aria-label="Participante anterior"
          disabled={previewIndex === 0}
          onClick={() => {
            setPreviewIndex(previewIndex - 1);
          }}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <label className="sr-only" htmlFor="preview-participant">
          Participante para la vista previa
        </label>
        <select
          id="preview-participant"
          value={previewIndex}
          onChange={(event) => {
            setPreviewIndex(Number(event.target.value));
          }}
          className="h-8 max-w-72 min-w-0 flex-1 cursor-pointer rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
        >
          {participants.map((participant) => (
            <option key={participant.index} value={participant.index}>
              {participant.index + 1}. {participant.name}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Participante siguiente"
          disabled={previewIndex >= count - 1}
          onClick={() => {
            setPreviewIndex(previewIndex + 1);
          }}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <Button
          size="sm"
          icon={<Ruler aria-hidden className="size-4" />}
          aria-expanded={showLongest}
          disabled={longest.length === 0}
          onClick={() => {
            setShowLongest(!showLongest);
            const first = longest[0];
            if (!showLongest && first !== undefined) setPreviewIndex(first);
          }}
        >
          Ver los más largos
        </Button>
      </div>
      {showLongest ? (
        <ol aria-label="Los 3 nombres más anchos" className="flex flex-wrap gap-1.5">
          {longest.map((index, rank) => (
            <li key={index}>
              <button
                type="button"
                aria-pressed={index === previewIndex}
                onClick={() => {
                  setPreviewIndex(index);
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  index === previewIndex
                    ? 'border-gold bg-gold-soft text-gold'
                    : 'border-line-strong text-muted hover:border-gold hover:text-ink'
                }`}
              >
                {rank + 1}. {participants[index]?.name}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function RealPreview() {
  const { engine, fonts, rasterizer } = useServices();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<RasterImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => image?.release(), [image]);

  async function show() {
    const state = useAppStore.getState();
    const participant = state.participants?.list.participants[state.previewIndex];
    if (!state.template || !participant) return;
    setOpen(true);
    setError(null);
    setImage(null);
    try {
      const fontIds = [...new Set(state.fields.map((field) => field.fontId))];
      const assets = await Promise.all(fontIds.map((id) => fonts.load(id)));
      const pdf = await engine.preview({
        template: state.template.loaded,
        fields: state.fields,
        fonts: assets,
        participant,
      });
      setImage(await rasterizer.renderPdf(pdf, 1400));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="primary"
        icon={<Eye aria-hidden className="size-4" />}
        onClick={() => void show()}
      >
        Vista previa real
      </Button>
      <Modal
        open={open}
        wide
        title="Vista previa del PDF"
        onClose={() => {
          setOpen(false);
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {image ? (
          <img
            src={image.url}
            alt="Certificado generado para el participante seleccionado"
            className="mx-auto w-full rounded shadow-lift"
          />
        ) : !error ? (
          <p className="py-16 text-center text-muted" aria-live="polite">
            Generando el certificado…
          </p>
        ) : null}
      </Modal>
    </>
  );
}

function DesignWarnings() {
  const overflows = useOverflows();
  const fields = useAppStore((state) => state.fields);
  const participants = useAppStore((state) => state.participants?.list.participants);
  const measurements = useAppStore((state) => state.measurements);
  const setPreviewIndex = useAppStore((state) => state.setPreviewIndex);
  if (!participants) return null;

  const byField = fields
    .map((field) => ({
      field,
      items: overflows.filter((item) => item.fieldId === field.id),
      missing: measurements?.fields[field.id]?.missingChars ?? [],
    }))
    .filter((entry) => entry.items.length > 0 || entry.missing.length > 0);

  if (byField.length === 0) {
    return measurements ? (
      <Alert tone="success">
        Todos los textos entran en sus cajas con las fuentes elegidas (
        {formatNumber(participants.length)} participantes revisados).
      </Alert>
    ) : null;
  }

  return (
    <div className="space-y-3">
      {byField.map(({ field, items, missing }) => (
        <div key={field.id} className="space-y-3">
          {items.length > 0 ? (
            <Alert
              tone="danger"
              title={`${formatNumber(items.length)} ${items.length === 1 ? 'texto no entra' : 'textos no entran'} en «${field.label}» ni al tamaño mínimo`}
            >
              <p>
                Agranda la caja, baja el tamaño mínimo o acorta el nombre en el paso 2. Si generas
                así, se dibujarán a {field.minSize} pt y quedarán marcados en reporte.csv.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {items.slice(0, 8).map((item) => (
                  <li key={item.participantIndex}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewIndex(item.participantIndex);
                      }}
                      className="rounded-full border border-danger/40 bg-surface px-2.5 py-0.5 text-xs font-semibold text-danger hover:border-danger"
                    >
                      {participants[item.participantIndex]?.name}
                    </button>
                  </li>
                ))}
                {items.length > 8 ? (
                  <li className="px-1 text-xs text-muted">
                    y {formatNumber(items.length - 8)} más
                  </li>
                ) : null}
              </ul>
            </Alert>
          ) : null}
          {missing.length > 0 ? (
            <Alert
              tone="warning"
              title={`La fuente de «${field.label}» no tiene algunos caracteres`}
            >
              {[...new Set(missing.flatMap((item) => [...item.chars]))].join(' ')} — en{' '}
              {formatNumber(missing.length)} participante{missing.length === 1 ? '' : 's'}. Elige
              otra fuente para que se vean bien.
            </Alert>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DesignStep() {
  const participant = useAppStore(
    (state) => state.participants?.list.participants[state.previewIndex],
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Paso 3"
        title="Ubica los campos sobre la plantilla"
        description="Arrastra cada caja hasta su lugar y ajusta su ancho: es el ancho máximo del texto. Los nombres largos se achican solos hasta el tamaño mínimo."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Card className="space-y-4 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ParticipantPicker />
              <RealPreview />
            </div>
            <div className="rounded-lg bg-canvas p-3 sm:p-6">
              <DesignCanvas participant={participant} />
            </div>
            <p className="text-xs text-subtle">
              Consejo: con una caja seleccionada usa las flechas para moverla (Mayús = pasos
              grandes) y Alt + flechas para cambiar su ancho. Se alinea sola al centro de la página.
            </p>
          </Card>
          <DesignWarnings />
        </div>
        <Card className="h-fit p-4 lg:sticky lg:top-24">
          <FieldPanel />
        </Card>
      </div>
    </div>
  );
}
