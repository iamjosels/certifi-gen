import { describe, expect, it } from 'vitest';
import { createField, createNameField } from './field';
import { fieldMaxWidth, findOverflows, fitFieldText, widestIndexes } from './layout';

const page = { width: 1000, height: 700 };

describe('layout helpers', () => {
  const name = {
    ...createNameField(),
    box: { x: 0.1, y: 0.5, width: 0.5 },
    maxSize: 40,
    minSize: 10,
  };

  it('computes the maximum width from the relative box', () => {
    expect(fieldMaxWidth(name, page)).toBe(500);
  });

  it('fits a text by its unit width', () => {
    expect(fitFieldText(name, 10, page)).toEqual({ size: 40, width: 400, overflow: false });
    expect(fitFieldText(name, 25, page)).toEqual({ size: 20, width: 500, overflow: false });
    expect(fitFieldText(name, 60, page).overflow).toBe(true);
  });

  it('lists every overflow per field and participant', () => {
    const code = createField('sequence', [name]);
    const widths = new Map([
      [name.id, [10, 60, 25, 51]],
      [code.id, [1, 1, 1, 1]],
    ]);
    expect(findOverflows([name, code, createField('static', [])], widths, page)).toEqual([
      { fieldId: 'name', participantIndex: 1, width: 600, maxWidth: 500 },
      { fieldId: 'name', participantIndex: 3, width: 510, maxWidth: 500 },
    ]);
  });

  it('returns the widest texts by measured width', () => {
    expect(widestIndexes([5, 9, 1, 9, 7])).toEqual([1, 3, 4]);
    expect(widestIndexes([5], 3)).toEqual([0]);
  });
});
