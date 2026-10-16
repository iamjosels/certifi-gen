import type { FieldConfig } from './field';
import type { Size } from './geometry';
import { fitFromUnitWidth, type FitResult } from './text-fit';

/** Width at 1 pt of each participant's text for one field (index = participant index). */
export type UnitWidths = readonly number[];

export function fieldMaxWidth(field: FieldConfig, page: Size): number {
  return field.box.width * page.width;
}

export function fitFieldText(field: FieldConfig, unitWidth: number, page: Size): FitResult {
  return fitFromUnitWidth(unitWidth, fieldMaxWidth(field, page), field.maxSize, field.minSize);
}

export interface OverflowItem {
  readonly fieldId: string;
  readonly participantIndex: number;
  /** Text width at the minimum size, in points. */
  readonly width: number;
  /** Maximum width of the box, in points. */
  readonly maxWidth: number;
}

/** Every (field, participant) whose text does not fit even at the field's minimum size. */
export function findOverflows(
  fields: readonly FieldConfig[],
  widths: ReadonlyMap<string, UnitWidths>,
  page: Size,
): OverflowItem[] {
  const items: OverflowItem[] = [];
  for (const field of fields) {
    const unitWidths = widths.get(field.id);
    if (!unitWidths) continue;
    const maxWidth = fieldMaxWidth(field, page);
    unitWidths.forEach((unitWidth, participantIndex) => {
      const fit = fitFromUnitWidth(unitWidth, maxWidth, field.maxSize, field.minSize);
      if (fit.overflow) {
        items.push({ fieldId: field.id, participantIndex, width: fit.width, maxWidth });
      }
    });
  }
  return items;
}

/** Indexes of the `count` widest texts (measured width, not character count). */
export function widestIndexes(unitWidths: UnitWidths, count = 3): number[] {
  return unitWidths
    .map((width, index) => ({ width, index }))
    .sort((a, b) => b.width - a.width || a.index - b.index)
    .slice(0, count)
    .map((item) => item.index);
}
