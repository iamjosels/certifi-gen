import { describe, expect, it } from 'vitest';
import { buildReportCsv } from './report';

describe('buildReportCsv', () => {
  const csv = buildReportCsv([
    {
      index: 1,
      name: "Seán O'Connor",
      fileName: '001_Sean_OConnor.pdf',
      code: 'CERT-001',
      overflowFields: [],
    },
    {
      index: 2,
      name: 'Ruiz, "Ana"',
      fileName: '002_Ruiz_Ana.pdf',
      code: '',
      overflowFields: ['Nombre', 'Curso'],
    },
  ]);

  it('starts with a UTF-8 BOM and uses CRLF', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('has the expected columns and rows', () => {
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('indice,nombre,archivo,codigo,desborde');
    expect(lines[1]).toBe("1,Seán O'Connor,001_Sean_OConnor.pdf,CERT-001,no");
    expect(lines[2]).toBe('2,"Ruiz, ""Ana""",002_Ruiz_Ana.pdf,,sí (Nombre / Curso)');
  });

  it('quotes values with leading or trailing spaces', () => {
    const line = buildReportCsv([
      { index: 1, name: ' Ana', fileName: 'a.pdf', code: 'x', overflowFields: [] },
    ]).split('\r\n')[1];
    expect(line).toBe('1," Ana",a.pdf,x,no');
  });
});
