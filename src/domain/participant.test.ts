import { describe, expect, it } from 'vitest';
import { buildParticipantList, renameParticipant } from './participant';

const rows = (names: string[]) =>
  names.map((name, i) => ({ name, sourceRow: i + 1, fields: { Nombre: name, Curso: ' Diseño ' } }));

describe('buildParticipantList', () => {
  it('normalizes names and discards empty rows', () => {
    const list = buildParticipantList(rows(['  Ana  Ruiz ', '', '   ', '\u200b', 'Luis Pérez']));
    expect(list.participants.map((p) => p.name)).toEqual(['Ana Ruiz', 'Luis Pérez']);
    expect(list.participants.map((p) => p.index)).toEqual([0, 1]);
    expect(list.participants.map((p) => p.sourceRow)).toEqual([1, 5]);
    expect(list.report.valid).toBe(2);
    expect(list.report.emptyDiscarded).toBe(3);
  });

  it('normalizes the other columns too', () => {
    const list = buildParticipantList(rows(['Ana']));
    expect(list.participants[0]?.fields).toEqual({ Nombre: 'Ana', Curso: 'Diseño' });
  });

  it('works without extra fields', () => {
    const list = buildParticipantList([{ name: 'Ana', sourceRow: 1 }]);
    expect(list.participants[0]?.fields).toEqual({});
  });

  it('marks duplicates (accent and case insensitive) without removing them', () => {
    const list = buildParticipantList(
      rows(['Andrés Gómez', 'Lucía Fernández', 'ANDRES GOMEZ', 'Lucía Fernández', 'andrés  gómez']),
    );
    expect(list.participants).toHaveLength(5);
    expect(list.participants.map((p) => p.duplicateOf)).toEqual([null, null, 0, 1, 0]);
    expect(list.report.duplicateGroups).toEqual([
      { key: 'andres gomez', indexes: [0, 2, 4] },
      { key: 'lucia fernandez', indexes: [1, 3] },
    ]);
    expect(list.report.duplicateCount).toBe(3);
  });

  it('reports no duplicates for unique names', () => {
    const list = buildParticipantList(rows(['Ana', 'Luis']));
    expect(list.report.duplicateGroups).toEqual([]);
    expect(list.report.duplicateCount).toBe(0);
  });
});

describe('renameParticipant', () => {
  it('replaces one name and recomputes duplicates', () => {
    const list = buildParticipantList(rows(['Ana Ruiz', 'Ana Ruiz', 'Luis']));
    expect(list.report.duplicateCount).toBe(1);
    const renamed = renameParticipant(list, 1, '  Ana  Ruíz Soto ');
    expect(renamed.participants[1]?.name).toBe('Ana Ruíz Soto');
    expect(renamed.report.duplicateCount).toBe(0);
    expect(renamed.participants[1]?.fields.Curso).toBe('Diseño');
  });

  it('keeps the count of discarded rows', () => {
    const list = buildParticipantList(rows(['Ana', '', 'Luis']));
    const renamed = renameParticipant(list, 0, 'Ana María');
    expect(renamed.report.emptyDiscarded).toBe(1);
    expect(renamed.report.valid).toBe(2);
  });
});
