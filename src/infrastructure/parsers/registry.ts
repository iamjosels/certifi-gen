import type {
  ListFormat,
  ParticipantParser,
  ParticipantParserRegistry,
  SourceFile,
} from '../../application/ports';

const EXTENSIONS: Readonly<Record<string, ListFormat>> = {
  txt: 'txt',
  text: 'txt',
  csv: 'csv',
  tsv: 'csv',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xlsx',
  docx: 'docx',
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const isOle = (bytes: Uint8Array) => bytes[0] === 0xd0 && bytes[1] === 0xcf;

/** Each parser is a separate chunk, loaded the first time its format is used. */
const LOADERS: Readonly<Record<ListFormat, () => Promise<ParticipantParser>>> = {
  txt: () => import('./txt-parser').then((m) => m.txtParser),
  csv: () => import('./csv-parser').then((m) => m.csvParser),
  xlsx: () => import('./xlsx-parser').then((m) => m.xlsxParser),
  docx: () => import('./docx-parser').then((m) => m.docxParser),
};

export function createParserRegistry(): ParticipantParserRegistry {
  return {
    detectFormat(file: SourceFile): ListFormat | null {
      const format = EXTENSIONS[extensionOf(file.name)];
      if (!format) return null;
      // A binary spreadsheet/document saved with the wrong extension is still accepted.
      if ((format === 'txt' || format === 'csv') && isZip(file.bytes)) return null;
      if (format === 'docx' && !isZip(file.bytes) && file.bytes.length > 0) return null;
      if (format === 'xlsx' && file.bytes.length > 0 && !isZip(file.bytes) && !isOle(file.bytes)) {
        return null;
      }
      return format;
    },
    load(format) {
      return LOADERS[format]();
    },
  };
}
