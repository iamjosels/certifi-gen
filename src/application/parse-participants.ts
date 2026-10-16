import { AppError } from '../domain/errors';
import { buildParticipantList, type ParticipantList } from '../domain/participant';
import { describeTable, tableToRows, type TableLayout } from '../domain/table';
import type {
  ListFormat,
  ParsedTable,
  ParticipantParserRegistry,
  SourceFile,
  TextEncodingName,
} from './ports';

export interface ParticipantsResult {
  readonly fileName: string;
  readonly format: ListFormat;
  readonly encoding: TextEncodingName | null;
  readonly table: ParsedTable;
  readonly layout: TableLayout;
  readonly list: ParticipantList;
}

export interface LayoutChoice {
  /** Force the header detection result. */
  readonly hasHeader?: boolean;
  /** Name column index (in the layout columns). */
  readonly nameColumn?: number;
  /** Preferred name column label, used when it exists (e.g. from an imported configuration). */
  readonly preferredNameColumn?: string | null;
}

/** Applies a header/column choice to an already-read table. */
export function applyLayout(
  table: ParsedTable,
  choice: LayoutChoice = {},
): { layout: TableLayout; list: ParticipantList } {
  const detected = describeTable(table, choice.hasHeader);
  let nameColumn = detected.nameColumn;
  if (choice.nameColumn !== undefined && choice.nameColumn < detected.columns.length) {
    nameColumn = Math.max(0, choice.nameColumn);
  } else if (choice.preferredNameColumn) {
    const preferred = detected.columns.indexOf(choice.preferredNameColumn);
    if (preferred !== -1) nameColumn = preferred;
  }
  const layout: TableLayout = { ...detected, nameColumn };
  return { layout, list: buildParticipantList(tableToRows(table, layout)) };
}

/**
 * Reads a participant list in any supported format: detects the format, loads its parser,
 * detects header and name column, normalizes names and marks duplicates.
 */
export async function parseParticipants(
  file: SourceFile,
  registry: ParticipantParserRegistry,
  choice: LayoutChoice = {},
): Promise<ParticipantsResult> {
  const format = registry.detectFormat(file);
  if (!format) throw new AppError('list-unsupported', file.name);
  const parser = await registry.load(format);
  const table = await parser.parse(file);
  const { layout, list } = applyLayout(table, choice);
  if (list.participants.length === 0) throw new AppError('list-empty', file.name);
  return { fileName: file.name, format, encoding: table.encoding, table, layout, list };
}
