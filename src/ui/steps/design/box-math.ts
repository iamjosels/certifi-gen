import { FIELD_LIMITS, type FieldBox } from '../../../domain/field';

/** Snap distance to the page center, as a fraction of the page. */
export const SNAP = 0.012;

export function moveBox(box: FieldBox, dx: number, dy: number) {
  let x = Math.min(1 - box.width, Math.max(0, box.x + dx));
  let y = Math.min(1, Math.max(0, box.y + dy));
  let vertical = false;
  let horizontal = false;
  if (Math.abs(x + box.width / 2 - 0.5) < SNAP) {
    x = 0.5 - box.width / 2;
    vertical = true;
  }
  if (Math.abs(y - 0.5) < SNAP) {
    y = 0.5;
    horizontal = true;
  }
  return { box: { x, y, width: box.width }, guides: { vertical, horizontal } };
}

export function resizeBox(box: FieldBox, edge: 'left' | 'right', dx: number): FieldBox {
  const min = FIELD_LIMITS.minBoxWidth;
  if (edge === 'right') {
    return { ...box, width: Math.min(1 - box.x, Math.max(min, box.width + dx)) };
  }
  const right = box.x + box.width;
  const x = Math.min(right - min, Math.max(0, box.x + dx));
  return { ...box, x, width: right - x };
}
