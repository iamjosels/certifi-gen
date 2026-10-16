import { useEffect, useMemo } from 'react';
import type { FieldMeasurements } from '../../application/ports';
import type { FieldConfig } from '../../domain/field';
import { findOverflows, type OverflowItem } from '../../domain/layout';
import { errorMessage } from '../messages';
import { useAppStore } from '../store/app-store';
import { useServices } from './services-context';

/** Only these properties change the measured widths (moving or resizing a box does not). */
function measureKey(fields: readonly FieldConfig[]): string {
  return JSON.stringify(
    fields.map((field) => [field.id, field.fontId, field.transform, field.source]),
  );
}

/**
 * Keeps `measurements` in the store up to date: the worker measures every text at 1 pt with the
 * same fonts as the PDF whenever the list, a font, a transform or a source changes.
 */
export function useMeasurementsSync(): void {
  const { engine, fonts } = useServices();
  const fields = useAppStore((state) => state.fields);
  const participants = useAppStore((state) => state.participants?.list.participants);
  const fontsVersion = useAppStore((state) => state.fontsVersion);
  const setMeasurements = useAppStore((state) => state.setMeasurements);
  const setNotice = useAppStore((state) => state.setNotice);
  const key = measureKey(fields);

  useEffect(() => {
    if (!participants || participants.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const current = useAppStore.getState().fields;
      void (async () => {
        try {
          const fontIds = [...new Set(current.map((field) => field.fontId))];
          const assets = await Promise.all(fontIds.map((id) => fonts.load(id)));
          const result = await engine.measure({ fields: current, fonts: assets, participants });
          if (!cancelled) setMeasurements(result);
        } catch (error) {
          if (!cancelled) setNotice({ kind: 'warning', text: errorMessage(error) });
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, participants, fontsVersion, engine, fonts, setMeasurements, setNotice]);
}

export function useFieldMeasurement(fieldId: string): FieldMeasurements | undefined {
  return useAppStore((state) => state.measurements?.fields[fieldId]);
}

/** Every (field, participant) that does not fit at the minimum size, with the current boxes. */
export function useOverflows(): OverflowItem[] {
  const fields = useAppStore((state) => state.fields);
  const measurements = useAppStore((state) => state.measurements);
  const page = useAppStore((state) => state.template?.loaded.info.page);
  return useMemo(() => {
    if (!measurements || !page) return [];
    const widths = new Map(
      Object.entries(measurements.fields).map(([id, field]) => [id, field.unitWidths]),
    );
    return findOverflows(fields, widths, page);
  }, [fields, measurements, page]);
}
