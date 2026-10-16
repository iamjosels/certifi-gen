import { resolveFieldText } from '../domain/field';
import type {
  CertificateRenderer,
  FieldMeasurements,
  MeasureRequest,
  MeasureResponse,
} from './ports';

/**
 * Width at 1 pt of every field text for every participant, plus missing glyphs. With these the
 * UI fits sizes and flags overflows instantly while the boxes are dragged (fitFromUnitWidth).
 */
export async function measureFields(
  request: MeasureRequest,
  renderer: CertificateRenderer,
): Promise<MeasureResponse> {
  const measurer = await renderer.prepareMeasurer(request.fonts, request.fields);
  const fields: Record<string, FieldMeasurements> = {};
  for (const field of request.fields) {
    const texts = request.participants.map((participant) => resolveFieldText(field, participant));
    const measure = measurer.measure(field, texts);
    fields[field.id] = {
      unitWidths: measure.unitWidths,
      capHeight: measure.capHeight,
      missingChars: measure.missingChars
        .map((chars, participantIndex) => ({ participantIndex, chars }))
        .filter((item) => item.chars.length > 0),
    };
  }
  return { fields };
}
