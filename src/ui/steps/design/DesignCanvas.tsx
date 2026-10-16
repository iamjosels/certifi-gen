import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  FIELD_LIMITS,
  resolveFieldText,
  type FieldBox,
  type FieldConfig,
} from '../../../domain/field';
import { moveBox, resizeBox } from './box-math';
import { placeText } from '../../../domain/geometry';
import type { Participant } from '../../../domain/participant';
import { fitFromUnitWidth } from '../../../domain/text-fit';
import { fontFamilyFor, useFontFaces } from '../../hooks/use-font-faces';
import { useAppStore } from '../../store/app-store';

const KEY_STEP = 0.005;
const KEY_STEP_LARGE = 0.05;
/** Rough width at 1 pt (0.5 em per character) until the worker measurement arrives. */
const FALLBACK_EM = 0.5;

type DragMode = 'move' | 'left' | 'right';

interface Drag {
  readonly id: string;
  readonly mode: DragMode;
  readonly start: { x: number; y: number };
  readonly box: FieldBox;
}

function FieldShape({
  field,
  text,
  unitWidth,
  page,
  capHeight,
  selected,
  fontReady,
  onPointerDown,
  onKeyDown,
  onSelect,
}: {
  field: FieldConfig;
  text: string;
  unitWidth: number;
  page: { width: number; height: number };
  capHeight: number;
  selected: boolean;
  fontReady: boolean;
  onPointerDown: (event: PointerEvent, mode: DragMode) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onSelect: () => void;
}) {
  const left = field.box.x * page.width;
  const width = field.box.width * page.width;
  const height = field.maxSize * 1.35;
  const top = field.box.y * page.height - height / 2;
  const fit = fitFromUnitWidth(unitWidth, width, field.maxSize, field.minSize);
  const placement = placeText({
    box: field.box,
    page,
    size: fit.size,
    textWidth: fit.width,
    align: field.align,
    capHeight,
  });
  const anchorX =
    field.align === 'left' ? left : field.align === 'right' ? left + width : left + width / 2;
  const anchor = field.align === 'left' ? 'start' : field.align === 'right' ? 'end' : 'middle';
  const handle = Math.max(4, page.width * 0.008);
  const stroke = Math.max(0.6, page.width * 0.0014);
  const tone = fit.overflow ? 'var(--c-canvas-overflow)' : 'var(--c-canvas-field)';

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Campo ${field.label}${fit.overflow ? ' (no entra en la caja)' : ''}: ${text || 'vacío'}. Flechas para mover, Alt + flechas para cambiar el ancho.`}
      data-field-id={field.id}
      data-overflow={fit.overflow ? 'true' : 'false'}
      className="cursor-move outline-none"
      onPointerDown={(event) => {
        onSelect();
        onPointerDown(event, 'move');
      }}
      onKeyDown={onKeyDown}
      onFocus={onSelect}
    >
      <rect
        x={left}
        y={top}
        width={width}
        height={height}
        rx={stroke * 2}
        fill={fit.overflow ? 'var(--c-canvas-overflow)' : 'var(--c-canvas-field-fill)'}
        fillOpacity={selected ? 0.1 : 0.05}
        stroke={tone}
        strokeWidth={stroke}
        strokeDasharray={selected ? undefined : `${String(stroke * 4)} ${String(stroke * 3)}`}
        className="transition-[fill-opacity] duration-200"
      />
      <text
        x={anchorX}
        y={page.height - placement.baseline}
        textAnchor={anchor}
        fontSize={fit.size}
        fill={field.color}
        fontFamily={`${fontFamilyFor(field.fontId)}, Georgia, serif`}
        opacity={fontReady ? 1 : 0.55}
        className="pointer-events-none select-none"
      >
        {text}
      </text>
      {selected
        ? (['left', 'right'] as const).map((edge) => (
            <rect
              key={edge}
              data-handle={edge}
              x={(edge === 'left' ? left : left + width) - handle / 2}
              y={top + height / 2 - handle * 1.4}
              width={handle}
              height={handle * 2.8}
              rx={handle / 2}
              fill="var(--c-canvas-handle)"
              stroke={tone}
              strokeWidth={stroke}
              className="cursor-ew-resize"
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelect();
                onPointerDown(event, edge);
              }}
            />
          ))
        : null}
    </g>
  );
}

export function DesignCanvas({ participant }: { participant: Participant | undefined }) {
  const template = useAppStore((state) => state.template);
  const fields = useAppStore((state) => state.fields);
  const selectedId = useAppStore((state) => state.selectedFieldId);
  const measurements = useAppStore((state) => state.measurements);
  const selectField = useAppStore((state) => state.selectField);
  const updateField = useAppStore((state) => state.updateField);
  const readyFonts = useFontFaces(fields.map((field) => field.fontId));
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [guides, setGuides] = useState({ vertical: false, horizontal: false });

  if (!template) return null;
  const page = template.loaded.info.page;

  const relativePoint = (event: PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const startDrag = (field: FieldConfig) => (event: PointerEvent, mode: DragMode) => {
    if (event.button !== 0) return;
    event.preventDefault();
    svgRef.current?.setPointerCapture(event.pointerId);
    drag.current = { id: field.id, mode, start: relativePoint(event), box: field.box };
  };

  const onPointerMove = (event: PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const point = relativePoint(event);
    const dx = point.x - current.start.x;
    const dy = point.y - current.start.y;
    if (current.mode === 'move') {
      const moved = moveBox(current.box, dx, dy);
      setGuides(moved.guides);
      updateField(current.id, { box: moved.box });
    } else {
      updateField(current.id, { box: resizeBox(current.box, current.mode, dx) });
    }
  };

  const endDrag = (event: PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setGuides({ vertical: false, horizontal: false });
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const onKey = (field: FieldConfig) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    const { box } = field;
    let next: FieldBox | null = null;
    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const delta = event.key === 'ArrowRight' ? step : -step;
      const width = Math.min(1, Math.max(FIELD_LIMITS.minBoxWidth, box.width + delta));
      const center = box.x + box.width / 2;
      next = { ...box, width, x: Math.min(1 - width, Math.max(0, center - width / 2)) };
    } else if (event.key === 'ArrowLeft') next = { ...box, x: box.x - step };
    else if (event.key === 'ArrowRight') next = { ...box, x: box.x + step };
    else if (event.key === 'ArrowUp') next = { ...box, y: box.y - step };
    else if (event.key === 'ArrowDown') next = { ...box, y: box.y + step };
    if (next) {
      event.preventDefault();
      updateField(field.id, { box: next });
    }
  };

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-md bg-surface shadow-lift"
      style={{
        aspectRatio: `${String(page.width)} / ${String(page.height)}`,
        // Portrait templates would be very tall: keep the whole page in view.
        maxWidth: `min(100%, calc(78dvh * ${String(page.width / page.height)}))`,
      }}
    >
      <img
        src={template.previewUrl}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full select-none"
      />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${String(page.width)} ${String(page.height)}`}
        aria-label="Lienzo de diseño: campos sobre la plantilla"
        className="absolute inset-0 size-full touch-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {guides.vertical ? (
          <line
            x1={page.width / 2}
            x2={page.width / 2}
            y1={0}
            y2={page.height}
            stroke="var(--c-canvas-guide)"
            strokeWidth={page.width * 0.0015}
            strokeDasharray={`${String(page.width * 0.006)} ${String(page.width * 0.004)}`}
          />
        ) : null}
        {guides.horizontal ? (
          <line
            x1={0}
            x2={page.width}
            y1={page.height / 2}
            y2={page.height / 2}
            stroke="var(--c-canvas-guide)"
            strokeWidth={page.width * 0.0015}
            strokeDasharray={`${String(page.width * 0.006)} ${String(page.width * 0.004)}`}
          />
        ) : null}
        {fields.map((field) => {
          const measured = measurements?.fields[field.id];
          const text = participant ? resolveFieldText(field, participant) : field.label;
          const unitWidth =
            (participant ? measured?.unitWidths[participant.index] : undefined) ??
            text.length * FALLBACK_EM;
          return (
            <FieldShape
              key={field.id}
              field={field}
              text={text}
              unitWidth={unitWidth}
              page={page}
              capHeight={measured?.capHeight ?? 0.7}
              selected={field.id === selectedId}
              fontReady={readyFonts.has(field.fontId)}
              onPointerDown={startDrag(field)}
              onKeyDown={onKey(field)}
              onSelect={() => {
                if (field.id !== selectedId) selectField(field.id);
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
