/**
 * Ports: what the use cases need from the outside world. Infrastructure implements them and
 * composition-root.ts wires the implementations; use cases receive them as parameters.
 */
import type { RawTable } from '../domain/table';

/** A file chosen by the user, already read into memory. */
export interface SourceFile {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly mimeType?: string;
}

// ---------------------------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------------------------

export type ListFormat = 'txt' | 'csv' | 'xlsx' | 'docx';
export type TextEncodingName = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

export interface ParsedTable extends RawTable {
  /** Detected text encoding (TXT/CSV), null for binary formats. */
  readonly encoding: TextEncodingName | null;
}

export interface ParticipantParser {
  readonly format: ListFormat;
  /** Throws AppError('list-damaged') when the file cannot be read. */
  parse(file: SourceFile): Promise<ParsedTable>;
}

export interface ParticipantParserRegistry {
  /** Format of the file by extension and signature, or null when unsupported. */
  detectFormat(file: SourceFile): ListFormat | null;
  /** Loads (lazily) the parser for a format. */
  load(format: ListFormat): Promise<ParticipantParser>;
}
