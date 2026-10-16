import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { applyLayout, parseParticipants } from '../../application/parse-participants';
import { renameParticipant, type Participant } from '../../domain/participant';
import { comparisonKey, normalizeText } from '../../domain/text';
import { Alert } from '../components/Alert';
import { Badge, Stat } from '../components/Badge';
import { Button } from '../components/Button';
import { Card, SectionTitle } from '../components/Card';
import { Checkbox, SelectInput } from '../components/Controls';
import { DropZone } from '../components/DropZone';
import { ListIllustration } from '../components/Illustrations';
import { readSourceFile } from '../files';
import { formatNumber } from '../format';
import { useServices } from '../hooks/services-context';
import { errorMessage } from '../messages';
import { useAppStore } from '../store/app-store';

export const PAGE_SIZE = 20;
const ACCEPT =
  '.txt,.csv,.tsv,.xlsx,.xls,.docx,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const FORMAT_LABEL = { txt: 'TXT', csv: 'CSV', xlsx: 'Excel', docx: 'Word' };
const ENCODING_LABEL = {
  'utf-8': 'UTF-8',
  'utf-16le': 'UTF-16',
  'utf-16be': 'UTF-16',
  'windows-1252': 'Windows-1252',
};

function EditableName({
  participant,
  onSave,
}: {
  participant: Participant;
  onSave: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(participant.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const invalid = normalizeText(value).length === 0;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <span className="font-medium text-ink">{participant.name}</span>
        <button
          type="button"
          aria-label={`Editar el nombre de ${participant.name}`}
          onClick={() => {
            setValue(participant.name);
            setEditing(true);
          }}
          className="rounded p-1 text-subtle opacity-60 transition group-hover:opacity-100 hover:bg-surface-3 hover:text-ink focus:opacity-100"
        >
          <Pencil aria-hidden className="size-3.5" />
        </button>
      </div>
    );
  }

  const save = () => {
    if (invalid) return;
    onSave(value);
    setEditing(false);
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <input
        aria-label={`Nuevo nombre para ${participant.name}`}
        aria-invalid={invalid || undefined}
        ref={inputRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setEditing(false);
        }}
        className="h-8 w-full min-w-48 rounded-md border border-accent bg-surface px-2 text-sm text-ink focus:ring-3 focus:ring-accent/20 focus:outline-none"
      />
      <Button
        type="submit"
        size="sm"
        variant="primary"
        aria-label="Guardar nombre"
        disabled={invalid}
      >
        <Check aria-hidden className="size-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Cancelar edición"
        onClick={() => {
          setEditing(false);
        }}
      >
        <X aria-hidden className="size-4" />
      </Button>
    </form>
  );
}

export function ParticipantsStep() {
  const { parsers } = useServices();
  const result = useAppStore((state) => state.participants);
  const setParticipants = useAppStore((state) => state.setParticipants);
  const updateList = useAppStore((state) => state.updateParticipantList);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [page, setPage] = useState(0);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const preferred = useAppStore.getState().participants?.layout;
      const parsed = await parseParticipants(await readSourceFile(file), parsers, {
        preferredNameColumn: preferred ? (preferred.columns[preferred.nameColumn] ?? null) : null,
      });
      setParticipants(parsed);
      setQuery('');
      setPage(0);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (!result) return [];
    const key = comparisonKey(query);
    return result.list.participants.filter(
      (participant) =>
        (!onlyDuplicates ||
          participant.duplicateOf !== null ||
          result.list.report.duplicateGroups.some(
            (group) => group.indexes[0] === participant.index,
          )) &&
        (key.length === 0 || comparisonKey(participant.name).includes(key)),
    );
  }, [result, query, onlyDuplicates]);

  if (!result) {
    return (
      <div className="space-y-6">
        <SectionTitle
          eyebrow="Paso 2"
          title="Agrega la lista de participantes"
          description="Un nombre por línea (TXT o Word) o una hoja con una columna de nombres (CSV o Excel). Las tildes y la ñ se leen bien aunque el CSV venga de Excel en Windows."
        />
        {error ? (
          <Alert tone="danger" title="No se pudo leer la lista">
            {error}
          </Alert>
        ) : null}
        <DropZone
          label="Elegir lista de participantes"
          title="Arrastra aquí tu lista o haz clic para elegirla"
          hint="TXT, CSV, Excel (.xlsx) o Word (.docx)"
          accept={ACCEPT}
          illustration={<ListIllustration />}
          busy={busy}
          onFile={(file) => void handleFile(file)}
        />
      </div>
    );
  }

  const { list, layout, table } = result;
  const report = list.report;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const extraColumns = layout.columns
    .map((label, index) => ({ label, index }))
    .filter((column) => column.index !== layout.nameColumn)
    .slice(0, 3);
  const duplicateIndexes = new Set(
    report.duplicateGroups.flatMap((group) => group.indexes as number[]),
  );

  const changeLayout = (choice: { hasHeader?: boolean; nameColumn?: number }) => {
    const next = applyLayout(table, {
      hasHeader: choice.hasHeader ?? layout.hasHeader,
      nameColumn: choice.nameColumn ?? layout.nameColumn,
    });
    if (next.list.participants.length === 0) {
      setError('Esa columna no tiene nombres. Elige otra.');
      return;
    }
    setError(null);
    setParticipants({ ...result, ...next });
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Paso 2"
        title="Revisa los participantes"
        description={
          <>
            {result.fileName} · {FORMAT_LABEL[result.format]}
            {result.encoding ? ` · ${ENCODING_LABEL[result.encoding]}` : ''}
          </>
        }
        actions={
          <DropZone
            compact
            label="Cambiar lista de participantes"
            title="Cambiar lista"
            hint="Arrastra otro archivo o haz clic"
            accept={ACCEPT}
            illustration={null}
            busy={busy}
            onFile={(file) => void handleFile(file)}
          />
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Participantes válidos" value={formatNumber(report.valid)} tone="success" />
        <Stat label="Filas vacías descartadas" value={formatNumber(report.emptyDiscarded)} />
        <Stat
          label="Nombres repetidos"
          value={formatNumber(report.duplicateCount)}
          tone={report.duplicateCount > 0 ? 'warning' : 'neutral'}
        />
        <Stat label="Columnas" value={formatNumber(layout.columns.length)} />
      </dl>

      {report.duplicateCount > 0 ? (
        <Alert
          tone="warning"
          title={`Hay ${formatNumber(report.duplicateCount)} ${report.duplicateCount === 1 ? 'nombre repetido' : 'nombres repetidos'}`}
          action={
            <Button
              size="sm"
              icon={<Copy aria-hidden className="size-4" />}
              onClick={() => {
                setOnlyDuplicates(!onlyDuplicates);
                setPage(0);
              }}
            >
              {onlyDuplicates ? 'Ver todos' : 'Ver repetidos'}
            </Button>
          }
        >
          Se comparan sin tildes ni mayúsculas. No se eliminan: cada uno tendrá su certificado y su
          archivo con número propio.
        </Alert>
      ) : null}

      {!table.singleColumn ? (
        <Card className="flex flex-wrap items-end gap-6 p-4">
          <div className="w-64">
            <SelectInput
              label="Columna con el nombre"
              value={String(layout.nameColumn)}
              onChange={(value) => {
                changeLayout({ nameColumn: Number(value) });
              }}
              options={layout.columns.map((label, index) => ({ value: String(index), label }))}
            />
          </div>
          <Checkbox
            label="La primera fila es el encabezado"
            checked={layout.hasHeader}
            onChange={(checked) => {
              changeLayout({ hasHeader: checked });
            }}
          />
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          <div className="relative w-full max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
            />
            <input
              type="search"
              aria-label="Buscar participante"
              placeholder="Buscar participante…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              className="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-subtle focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none"
            />
          </div>
          <p className="text-sm text-muted" aria-live="polite">
            {formatNumber(filtered.length)} de {formatNumber(report.valid)}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Participantes de la lista</caption>
            <thead className="bg-surface-2 text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="w-16 px-4 py-2.5 font-semibold">
                  #
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {layout.columns[layout.nameColumn] ?? 'Nombre'}
                </th>
                {extraColumns.map((column) => (
                  <th key={column.index} scope="col" className="px-4 py-2.5 font-semibold">
                    {column.label}
                  </th>
                ))}
                <th scope="col" className="w-28 px-4 py-2.5 font-semibold">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((participant) => (
                <tr key={participant.index} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-4 py-2 text-subtle tabular-nums">{participant.index + 1}</td>
                  <td className="px-4 py-2">
                    <EditableName
                      key={participant.name}
                      participant={participant}
                      onSave={(name) => {
                        updateList(renameParticipant(list, participant.index, name));
                      }}
                    />
                  </td>
                  {extraColumns.map((column) => (
                    <td key={column.index} className="max-w-56 truncate px-4 py-2 text-muted">
                      {participant.fields[column.label] ?? ''}
                    </td>
                  ))}
                  <td className="px-4 py-2">
                    {duplicateIndexes.has(participant.index) ? (
                      <Badge tone="warning">Repetido</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + extraColumns.length}
                    className="px-4 py-10 text-center text-muted"
                  >
                    Ningún participante coincide con «{query}».
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <nav
          aria-label="Paginación de participantes"
          className="flex items-center justify-between gap-3 border-t border-line px-3 py-2"
        >
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronLeft aria-hidden className="size-4" />}
            disabled={currentPage === 0}
            onClick={() => {
              setPage(currentPage - 1);
            }}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted tabular-nums">
            Página {currentPage + 1} de {pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage >= pageCount - 1}
            onClick={() => {
              setPage(currentPage + 1);
            }}
          >
            Siguiente
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </nav>
      </Card>
    </div>
  );
}
