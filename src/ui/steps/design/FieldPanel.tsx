import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignLeft,
  AlignRight,
  Hash,
  Plus,
  Table2,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { formatCode, isValidCodePattern } from '../../../domain/code-pattern';
import {
  FIELD_LIMITS,
  NAME_FIELD_ID,
  type FieldConfig,
  type NewFieldKind,
  type TextAlign,
  type TextTransform,
} from '../../../domain/field';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import {
  ColorInput,
  NumberInput,
  Segmented,
  SelectInput,
  TextInput,
} from '../../components/Controls';
import { readSourceFile } from '../../files';
import { useServices } from '../../hooks/services-context';
import { errorMessage } from '../../messages';
import { useAppStore } from '../../store/app-store';

const ALIGN_OPTIONS: readonly { value: TextAlign; label: string; icon: ReactNode }[] = [
  {
    value: 'left',
    label: 'Alinear a la izquierda',
    icon: <AlignLeft aria-hidden className="size-4" />,
  },
  { value: 'center', label: 'Centrar', icon: <AlignCenter aria-hidden className="size-4" /> },
  {
    value: 'right',
    label: 'Alinear a la derecha',
    icon: <AlignRight aria-hidden className="size-4" />,
  },
];

const TRANSFORM_OPTIONS: readonly { value: TextTransform; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'title', label: 'Título' },
  { value: 'upper', label: 'MAYÚS' },
];

const CATEGORY_LABEL = {
  serif: 'serif elegante',
  sans: 'sans moderna',
  script: 'caligráfica',
  condensed: 'condensada',
  classic: 'clásica',
  custom: 'subida por ti',
};

function AddFieldMenu({ columns }: { columns: readonly string[] }) {
  const addField = useAppStore((state) => state.addField);
  const count = useAppStore((state) => state.fields.length);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const add = (kind: NewFieldKind, column?: string) => {
    addField(kind, column);
    setOpen(false);
  };
  return (
    <div className="relative">
      <Button
        size="sm"
        icon={<Plus aria-hidden className="size-4" />}
        aria-expanded={open}
        aria-controls={menuId}
        disabled={count >= FIELD_LIMITS.maxFields}
        onClick={() => {
          setOpen(!open);
        }}
      >
        Agregar campo
      </Button>
      {open ? (
        <div
          id={menuId}
          className="absolute top-full right-0 z-20 mt-1 w-64 animate-[fade-in_0.15s_ease-out] rounded-lg border border-line bg-surface p-1 shadow-lift"
        >
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              add('sequence');
            }}
          >
            <Hash aria-hidden className="mt-0.5 size-4 text-accent" />
            <span>
              <span className="block font-semibold text-ink">Código correlativo</span>
              <span className="text-xs text-muted">CERT-2026-001, 002…</span>
            </span>
          </button>
          {columns.length > 0 ? (
            <button
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
              onClick={() => {
                add('column', columns[0]);
              }}
            >
              <Table2 aria-hidden className="mt-0.5 size-4 text-accent" />
              <span>
                <span className="block font-semibold text-ink">Columna de la lista</span>
                <span className="text-xs text-muted">Curso, fecha, correo…</span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
            onClick={() => {
              add('static');
            }}
          >
            <Type aria-hidden className="mt-0.5 size-4 text-accent" />
            <span>
              <span className="block font-semibold text-ink">Texto fijo</span>
              <span className="text-xs text-muted">Igual en todos los certificados</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FontPicker({ field }: { field: FieldConfig }) {
  const { fonts, engine } = useServices();
  const fontsVersion = useAppStore((state) => state.fontsVersion);
  const updateField = useAppStore((state) => state.updateField);
  const bumpFonts = useAppStore((state) => state.bumpFonts);
  const [message, setMessage] = useState<{ tone: 'warning' | 'danger'; text: string } | null>(null);
  const inputId = useId();
  const list = fonts.list();

  async function upload(file: File) {
    setMessage(null);
    try {
      const source = await readSourceFile(file);
      const info = await engine.inspectFont(source);
      const descriptor = fonts.registerUserFont(source, info);
      bumpFonts();
      updateField(field.id, { fontId: descriptor.id });
      const notes: string[] = [];
      if (info.missingSpanishChars.length > 0) {
        notes.push(`No tiene estos caracteres: ${info.missingSpanishChars.join(' ')}`);
      }
      if (info.isVariable) notes.push('Es una fuente variable: se usará su grosor por defecto.');
      if (notes.length > 0) setMessage({ tone: 'warning', text: notes.join(' ') });
    } catch (error) {
      setMessage({ tone: 'danger', text: errorMessage(error) });
    }
  }

  return (
    <div className="space-y-2" data-fonts-version={fontsVersion}>
      <SelectInput
        label="Fuente"
        value={field.fontId}
        onChange={(fontId) => {
          updateField(field.id, { fontId });
        }}
        options={list.map((font) => ({
          value: font.id,
          label: `${font.name} · ${CATEGORY_LABEL[font.category]}`,
        }))}
      />
      <label
        htmlFor={inputId}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-xs font-semibold text-accent-soft-ink hover:underline focus-within:ring-3 focus-within:ring-accent/25"
      >
        <Upload aria-hidden className="size-3.5" />
        Subir fuente TTF u OTF
        <input
          id={inputId}
          type="file"
          accept=".ttf,.otf,font/ttf,font/otf"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </label>
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
    </div>
  );
}

function SourceEditor({ field, columns }: { field: FieldConfig; columns: readonly string[] }) {
  const updateField = useAppStore((state) => state.updateField);
  const nameColumn = useAppStore((state) => {
    const participants = state.participants;
    if (!participants || participants.table.singleColumn) return undefined;
    return participants.layout.columns[participants.layout.nameColumn];
  });
  const { source } = field;

  switch (source.kind) {
    case 'name':
      return (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          {nameColumn
            ? `Usa la columna «${nameColumn}» de la lista.`
            : 'Usa el nombre de cada participante de la lista.'}
        </p>
      );
    case 'column':
      return (
        <SelectInput
          label="Columna de la lista"
          value={source.column}
          onChange={(column) => {
            updateField(field.id, { source: { kind: 'column', column }, label: column });
          }}
          options={columns.map((column) => ({ value: column, label: column }))}
        />
      );
    case 'sequence': {
      const valid = isValidCodePattern(source.pattern);
      return (
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <TextInput
            label="Patrón del código"
            value={source.pattern}
            invalid={!valid}
            hint={
              valid
                ? `Ejemplo: ${formatCode(source.pattern, source.start)}`
                : 'Incluye {n} o {n:000} (ceros = dígitos).'
            }
            onChange={(pattern) => {
              updateField(field.id, { source: { ...source, pattern } });
            }}
          />
          <NumberInput
            label="Empieza en"
            value={source.start}
            min={0}
            max={999999}
            onChange={(start) => {
              updateField(field.id, { source: { ...source, start: Math.round(start) } });
            }}
          />
        </div>
      );
    }
    case 'static':
      return (
        <TextInput
          label="Texto"
          value={source.text}
          onChange={(text) => {
            updateField(field.id, { source: { kind: 'static', text } });
          }}
        />
      );
  }
}

export function FieldPanel() {
  const fields = useAppStore((state) => state.fields);
  const selectedId = useAppStore((state) => state.selectedFieldId);
  const selectField = useAppStore((state) => state.selectField);
  const updateField = useAppStore((state) => state.updateField);
  const removeField = useAppStore((state) => state.removeField);
  const participants = useAppStore((state) => state.participants);
  const columns = useMemo(() => {
    if (!participants || participants.table.singleColumn) return [];
    const { layout } = participants;
    return layout.columns.filter((_, index) => index !== layout.nameColumn);
  }, [participants]);
  const field = fields.find((item) => item.id === selectedId) ?? fields[0];
  if (!field) return null;

  const percentInput = (key: 'x' | 'y' | 'width', label: string) => (
    <NumberInput
      label={label}
      value={field.box[key] * 100}
      min={key === 'width' ? FIELD_LIMITS.minBoxWidth * 100 : 0}
      max={100}
      step={0.5}
      suffix="%"
      onChange={(value) => {
        updateField(field.id, { box: { ...field.box, [key]: value / 100 } });
      }}
    />
  );

  return (
    <aside aria-label="Propiedades del campo" className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Campos</h3>
          <AddFieldMenu columns={columns} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Campos del certificado">
          {fields.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === field.id}
              onClick={() => {
                selectField(item.id);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition duration-200 ${
                item.id === field.id
                  ? 'border-accent bg-accent text-accent-ink shadow-soft'
                  : 'border-line-strong bg-surface text-muted hover:border-accent hover:text-ink'
              }`}
            >
              {item.label || 'Sin nombre'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface-2/50 p-4" role="tabpanel">
        <TextInput
          label="Nombre del campo"
          value={field.label}
          onChange={(label) => {
            updateField(field.id, { label });
          }}
        />
        <SourceEditor field={field} columns={columns} />
        <FontPicker field={field} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Tamaño máximo"
            value={field.maxSize}
            min={FIELD_LIMITS.minFontSize}
            max={FIELD_LIMITS.maxFontSize}
            step={0.5}
            suffix="pt"
            onChange={(maxSize) => {
              updateField(field.id, { maxSize, minSize: Math.min(field.minSize, maxSize) });
            }}
          />
          <NumberInput
            label="Tamaño mínimo"
            value={field.minSize}
            min={FIELD_LIMITS.minFontSize}
            max={FIELD_LIMITS.maxFontSize}
            step={0.5}
            suffix="pt"
            onChange={(minSize) => {
              updateField(field.id, { minSize, maxSize: Math.max(field.maxSize, minSize) });
            }}
          />
        </div>
        <ColorInput
          label="Color"
          value={field.color}
          onChange={(color) => {
            updateField(field.id, { color });
          }}
        />
        <Segmented
          label="Alineación"
          value={field.align}
          options={ALIGN_OPTIONS}
          onChange={(align) => {
            updateField(field.id, { align });
          }}
        />
        <Segmented
          label="Transformación"
          value={field.transform}
          options={TRANSFORM_OPTIONS}
          onChange={(transform) => {
            updateField(field.id, { transform });
          }}
        />
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted">Posición y ancho máximo</legend>
          <div className="grid grid-cols-3 gap-2">
            {percentInput('x', 'Izquierda')}
            {percentInput('y', 'Altura')}
            {percentInput('width', 'Ancho')}
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<AlignHorizontalJustifyCenter aria-hidden className="size-4" />}
            onClick={() => {
              updateField(field.id, { box: { ...field.box, x: 0.5 - field.box.width / 2 } });
            }}
          >
            Centrar en la página
          </Button>
        </fieldset>
        {field.id !== NAME_FIELD_ID ? (
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 aria-hidden className="size-4" />}
            onClick={() => {
              removeField(field.id);
            }}
          >
            Eliminar campo
          </Button>
        ) : null}
      </div>
    </aside>
  );
}
