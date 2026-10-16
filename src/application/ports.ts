/**
 * Ports: what the use cases need from the outside world. Infrastructure implements them and
 * composition-root.ts wires the implementations; use cases receive them as parameters.
 */
import type { FieldConfig } from '../domain/field';
import type { Participant } from '../domain/participant';
import type { ReportRow } from '../domain/report';
import type { OutputMode, SizeSample } from '../domain/size-estimate';
import type { RawTable } from '../domain/table';
import type { TemplateInfo } from '../domain/template';

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

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

export interface LoadedTemplate {
  readonly info: TemplateInfo;
  /** Bytes that are embedded in the certificates (the original file). */
  readonly bytes: Uint8Array;
}

export interface TemplateLoader {
  /**
   * Analyzes a template. Throws AppError: template-unsupported, template-pdf-encrypted,
   * template-pdf-damaged, template-pdf-empty, template-image-damaged.
   */
  load(file: SourceFile): Promise<LoadedTemplate>;
}

// ---------------------------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------------------------

export type FontCategory = 'serif' | 'sans' | 'script' | 'condensed' | 'classic' | 'custom';

export interface FontDescriptor {
  readonly id: string;
  readonly name: string;
  readonly category: FontCategory;
  /** Embed only the used glyphs (disabled for fonts that break when subset). */
  readonly subset: boolean;
  readonly source: 'bundled' | 'user';
}

export interface FontAsset {
  readonly id: string;
  readonly bytes: Uint8Array;
  readonly subset: boolean;
}

export interface FontInfo {
  readonly familyName: string;
  /** OpenType with CFF outlines: subsetting is disabled for these. */
  readonly isCff: boolean;
  /** Variable fonts are embedded with their default instance. */
  readonly isVariable: boolean;
  /** Spanish characters (áéíóúüñ¿¡…) the font cannot draw. */
  readonly missingSpanishChars: readonly string[];
}

export interface FontProvider {
  list(): readonly FontDescriptor[];
  load(id: string): Promise<FontAsset>;
  registerUserFont(file: SourceFile, info: FontInfo): FontDescriptor;
}

// ---------------------------------------------------------------------------------------------
// Rendering (runs inside the worker)
// ---------------------------------------------------------------------------------------------

export interface RenderSetup {
  readonly template: LoadedTemplate;
  readonly fields: readonly FieldConfig[];
  readonly fonts: readonly FontAsset[];
}

export interface RenderedCertificate {
  readonly bytes: Uint8Array;
  /** Labels of the fields that did not fit even at their minimum size. */
  readonly overflowFields: readonly string[];
}

export interface FieldMeasure {
  /** Width at 1 pt for each text. */
  readonly unitWidths: readonly number[];
  /** Characters missing from the font, per text (empty when complete). */
  readonly missingChars: readonly (readonly string[])[];
  /** Cap height of the field font as a fraction of the font size. */
  readonly capHeight: number;
}

export interface MergedDocumentBuilder {
  addPage(participant: Participant): { readonly overflowFields: readonly string[] };
  save(): Promise<Uint8Array>;
}

export interface RenderSession extends TextMeasurer {
  /** A standalone PDF with one certificate. */
  renderDocument(participant: Participant): Promise<RenderedCertificate>;
  /** A PDF where the template is embedded once and reused by every page. */
  createMergedDocument(): Promise<MergedDocumentBuilder>;
}

export interface TextMeasurer {
  measure(field: FieldConfig, texts: readonly string[]): FieldMeasure;
}

export interface CertificateRenderer {
  /** Parses the template and fonts once; the session renders any number of certificates. */
  prepare(setup: RenderSetup): Promise<RenderSession>;
  /** Text measurement only (no template needed). */
  prepareMeasurer(
    fonts: readonly FontAsset[],
    fields: readonly FieldConfig[],
  ): Promise<TextMeasurer>;
}

// ---------------------------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------------------------

export interface ArchiveBuilder {
  add(path: string, data: Uint8Array | string): void;
  finish(): Promise<Blob>;
}

export interface Archiver {
  create(): ArchiveBuilder;
}

// ---------------------------------------------------------------------------------------------
// Generation engine (main thread → worker)
// ---------------------------------------------------------------------------------------------

export interface RenderRequest {
  readonly template: LoadedTemplate;
  readonly fields: readonly FieldConfig[];
  readonly fonts: readonly FontAsset[];
}

export interface MeasureRequest {
  readonly fields: readonly FieldConfig[];
  readonly fonts: readonly FontAsset[];
  readonly participants: readonly Participant[];
}

export interface FieldMeasurements {
  readonly unitWidths: readonly number[];
  /** Participant index → missing characters, only for participants with missing glyphs. */
  readonly missingChars: readonly {
    readonly participantIndex: number;
    readonly chars: readonly string[];
  }[];
  readonly capHeight: number;
}

export interface MeasureResponse {
  /** By field id. */
  readonly fields: Readonly<Record<string, FieldMeasurements>>;
}

export interface GenerateRequest extends RenderRequest {
  readonly participants: readonly Participant[];
  readonly mode: OutputMode;
  /** Certificates per progress report (default 10). */
  readonly batchSize?: number;
}

export interface GenerationProgress {
  /** rendering certificates, then packaging the ZIP / saving the merged PDF. */
  readonly phase: 'rendering' | 'packaging';
  readonly done: number;
  readonly total: number;
  readonly elapsedMs: number;
}

export interface GenerationOutput {
  readonly zip: Blob | null;
  readonly merged: Blob | null;
  readonly report: readonly ReportRow[];
  readonly overflowCount: number;
  readonly elapsedMs: number;
}

export interface GenerationEngine {
  loadTemplate(file: SourceFile): Promise<LoadedTemplate>;
  inspectFont(file: SourceFile): Promise<FontInfo>;
  measure(request: MeasureRequest): Promise<MeasureResponse>;
  preview(request: RenderRequest & { readonly participant: Participant }): Promise<Uint8Array>;
  estimate(
    request: RenderRequest & { readonly participants: readonly Participant[] },
  ): Promise<SizeSample>;
  generate(
    request: GenerateRequest,
    onProgress: (progress: GenerationProgress) => void,
    signal: AbortSignal,
  ): Promise<GenerationOutput>;
}

// ---------------------------------------------------------------------------------------------
// Main-thread services
// ---------------------------------------------------------------------------------------------

export interface RasterImage {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  release(): void;
}

export interface PreviewRasterizer {
  /** Renders the first page of a PDF to an image of about `targetWidth` pixels. */
  renderPdf(bytes: Uint8Array, targetWidth: number): Promise<RasterImage>;
}

export interface ImageOptimizer {
  hasTransparency(file: SourceFile): Promise<boolean>;
  /** Re-encodes an image as JPG (white background) at the given quality (0..1). */
  toJpeg(file: SourceFile, quality: number): Promise<SourceFile>;
}

export interface ConfigStorage {
  load(): string | null;
  /** Returns false when the browser does not allow storage (private mode, quota…). */
  save(json: string): boolean;
}
