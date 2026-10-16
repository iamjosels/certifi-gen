import { describe, expect, it } from 'vitest';
import {
  columnLabel,
  describeTable,
  detectHeader,
  detectNameColumn,
  tableToRows,
  type RawTable,
} from './table';

const table = (rows: string[][], singleColumn = false): RawTable => ({ rows, singleColumn });

describe('detectHeader', () => {
  it('detects known header names (accent and case insensitive)', () => {
    expect(
      detectHeader(
        table([
          ['Nombre', 'Correo', 'Curso'],
          ['Ana', 'a@x.pe', 'X'],
        ]),
      ),
    ).toBe(true);
    expect(
      detectHeader(
        table([
          ['  PARTICIPANTE ', 'E-mail'],
          ['Ana', 'a@x.pe'],
        ]),
      ),
    ).toBe(true);
    expect(detectHeader(table([['Full Name'], ['Ana']]))).toBe(true);
    expect(
      detectHeader(
        table([
          ['Código:', 'Nombres y apellidos'],
          ['1', 'Ana'],
        ]),
      ),
    ).toBe(true);
  });

  it('skips blank rows before the header', () => {
    expect(
      detectHeader(
        table([
          ['', ''],
          ['Nombre', 'Mail'],
          ['Ana', 'a@x.pe'],
        ]),
      ),
    ).toBe(true);
  });

  it('detects a header when the column below holds e-mails', () => {
    const rows = [
      ['Asistente', 'Contacto personal'],
      ['Ana', 'ana@x.pe'],
      ['Luis', 'luis@x.pe'],
    ];
    expect(detectHeader(table(rows))).toBe(true);
  });

  it('returns false for data rows', () => {
    expect(
      detectHeader(
        table([
          ['Ana Ruiz', 'ana@x.pe'],
          ['Luis', 'luis@x.pe'],
        ]),
      ),
    ).toBe(false);
    expect(detectHeader(table([['Ana Ruiz', 'Diseño']]))).toBe(false);
    expect(detectHeader(table([]))).toBe(false);
  });

  it('single-column lists only have a header when it is a name header', () => {
    expect(detectHeader(table([['Nombres'], ['Ana']], true))).toBe(true);
    expect(detectHeader(table([['Correo'], ['Ana']], true))).toBe(false);
    expect(detectHeader(table([['Ana Ruiz'], ['Luis']], true))).toBe(false);
    expect(detectHeader(table([], true))).toBe(false);
  });
});

describe('detectNameColumn', () => {
  it('uses the most specific name header', () => {
    const rows = [
      ['Nombre', 'Nombre completo', 'Correo'],
      ['Ana', 'Ana Ruiz', 'a@x.pe'],
    ];
    expect(detectNameColumn(table(rows), true)).toBe(1);
    expect(
      detectNameColumn(
        table([
          ['Correo', 'Name'],
          ['a@x.pe', 'Ana'],
        ]),
        true,
      ),
    ).toBe(1);
  });

  it('falls back to the first column that looks like text', () => {
    const rows = [
      ['1', 'a@x.pe', 'Ana Ruiz'],
      ['2', 'b@x.pe', 'Luis Pérez'],
    ];
    expect(detectNameColumn(table(rows), false)).toBe(2);
    const withHeader = [['N°', 'Mail', 'Asistente'], ...rows];
    expect(detectNameColumn(table(withHeader), true)).toBe(2);
  });

  it('skips empty columns and defaults to the first one', () => {
    expect(
      detectNameColumn(
        table([
          ['', 'Ana'],
          ['', 'Luis'],
        ]),
        false,
      ),
    ).toBe(1);
    expect(
      detectNameColumn(
        table([
          ['1', '2'],
          ['3', '4'],
        ]),
        false,
      ),
    ).toBe(0);
    expect(detectNameColumn(table([['Ana']]), false)).toBe(0);
  });
});

describe('describeTable', () => {
  it('lists header columns and makes duplicate labels unique', () => {
    const layout = describeTable(
      table([
        ['Nombre', 'Curso', 'Curso', ''],
        ['Ana', 'A', 'B', 'C'],
      ]),
    );
    expect(layout.hasHeader).toBe(true);
    expect(layout.columns).toEqual(['Nombre', 'Curso', 'Curso (2)', 'Columna 4']);
    expect(layout.nameColumn).toBe(0);
  });

  it('labels columns when there is no header', () => {
    const layout = describeTable(table([['Ana', 'a@x.pe']]));
    expect(layout).toEqual({
      hasHeader: false,
      columns: ['Columna 1', 'Columna 2'],
      nameColumn: 0,
    });
  });

  it('accepts a forced header choice', () => {
    const layout = describeTable(
      table([
        ['Ana', 'a@x.pe'],
        ['Luis', 'l@x.pe'],
      ]),
      true,
    );
    expect(layout.columns).toEqual(['Ana', 'a@x.pe']);
  });

  it('handles empty tables', () => {
    expect(describeTable(table([])).columns).toEqual(['Columna 1']);
  });
});

describe('tableToRows', () => {
  it('skips the header and maps every column', () => {
    const raw = table([
      ['', '', ''],
      ['Nombre', 'Correo', 'Curso'],
      ['Ana', 'a@x.pe', 'Diseño'],
      ['', '', ''],
      ['Luis'],
    ]);
    const layout = describeTable(raw);
    expect(tableToRows(raw, layout)).toEqual([
      { name: 'Ana', fields: { Nombre: 'Ana', Correo: 'a@x.pe', Curso: 'Diseño' }, sourceRow: 3 },
      { name: '', fields: { Nombre: '', Correo: '', Curso: '' }, sourceRow: 4 },
      { name: 'Luis', fields: { Nombre: 'Luis', Correo: '', Curso: '' }, sourceRow: 5 },
    ]);
  });

  it('keeps every row without header, using the chosen name column', () => {
    const raw = table([
      ['a@x.pe', 'Ana'],
      ['b@x.pe', 'Luis'],
    ]);
    const rows = tableToRows(raw, { hasHeader: false, columns: ['C1', 'C2'], nameColumn: 1 });
    expect(rows.map((row) => row.name)).toEqual(['Ana', 'Luis']);
    expect(rows[0]?.sourceRow).toBe(1);
  });
});

describe('columnLabel', () => {
  it('is 1-based', () => {
    expect(columnLabel(0)).toBe('Columna 1');
  });
});
