/** Width of `text` at `size` points, in points. */
export type MeasureFn = (text: string, size: number) => number;

export interface FitResult {
  /** Chosen font size in points (the minimum when it overflows). */
  readonly size: number;
  /** Text width at that size, in points. */
  readonly width: number;
  /** True when not even the minimum size fits in the maximum width. */
  readonly overflow: boolean;
}

export const FIT_STEP = 0.25;

function floorToStep(value: number, step: number): number {
  return Math.floor(value / step + 1e-9) * step;
}

/**
 * Largest font size between `minSize` and `maxSize` (in `step` increments) whose width fits
 * in `maxWidth`. Starts from a proportional estimate and walks down, so it also works with
 * measure functions that are not perfectly linear (kerning, hinting).
 */
export function fitText(
  text: string,
  measure: MeasureFn,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  step = FIT_STEP,
): FitResult {
  const upper = Math.max(maxSize, minSize);
  const lower = Math.min(maxSize, minSize);
  if (text.length === 0) return { size: upper, width: 0, overflow: false };

  const widthAtMax = measure(text, upper);
  if (widthAtMax <= maxWidth) return { size: upper, width: widthAtMax, overflow: false };

  let size = Math.max(lower, Math.min(upper, floorToStep((upper * maxWidth) / widthAtMax, step)));
  let width = measure(text, size);
  while (width > maxWidth && size - step >= lower - 1e-9) {
    size = Math.max(lower, size - step);
    width = measure(text, size);
    if (size === lower) break;
  }
  if (width > maxWidth) {
    return { size: lower, width: measure(text, lower), overflow: true };
  }
  return { size, width, overflow: false };
}

/** fitText for a text whose width at 1 pt is known (width scales linearly with size). */
export function fitFromUnitWidth(
  unitWidth: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  step = FIT_STEP,
): FitResult {
  return fitText(
    unitWidth > 0 ? 'x' : '',
    (_text, size) => unitWidth * size,
    maxWidth,
    maxSize,
    minSize,
    step,
  );
}
