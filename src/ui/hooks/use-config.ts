import { useCallback, useEffect, useRef } from 'react';
import { applyLayout } from '../../application/parse-participants';
import {
  createConfig,
  parseConfig,
  serializeConfig,
  withAvailableFonts,
  type ConfigWarning,
  type ProjectConfig,
} from '../../domain/config';
import { DEFAULT_FONT_ID } from '../../domain/field';
import { useAppStore } from '../store/app-store';
import { useServices } from './services-context';

/** Builds the exportable configuration from the current state (never includes files). */
export function useCurrentConfig(): () => ProjectConfig {
  const { fonts } = useServices();
  return useCallback(() => {
    const state = useAppStore.getState();
    const page = state.template?.loaded.info.page;
    const usedFontIds = new Set(state.fields.map((field) => field.fontId));
    return createConfig({
      fields: state.fields,
      mode: state.mode,
      template:
        page && state.template
          ? { kind: state.template.loaded.info.kind, aspectRatio: page.width / page.height }
          : null,
      nameColumn: state.participants
        ? (state.participants.layout.columns[state.participants.layout.nameColumn] ?? null)
        : null,
      customFonts: fonts
        .list()
        .filter((font) => font.source === 'user' && usedFontIds.has(font.id))
        .map((font) => ({ id: font.id, name: font.name })),
    });
  }, [fonts]);
}

export function describeConfigWarnings(
  warnings: readonly ConfigWarning[],
  customFonts: ProjectConfig['customFonts'],
): string[] {
  return warnings.map((warning) => {
    if (warning.kind === 'missing-font') {
      const name = customFonts.find((font) => font.id === warning.fontId)?.name ?? warning.fontId;
      return `La fuente «${name}» no está disponible: se usará DM Serif Display. Súbela de nuevo en el paso Diseño.`;
    }
    return 'La plantilla actual tiene otra proporción que la de la configuración: revisa la posición de los campos.';
  });
}

/** Applies an imported (or restored) configuration. Returns the human-readable warnings. */
export function useApplyConfig(): (json: string) => string[] {
  const { fonts } = useServices();
  return useCallback(
    (json: string) => {
      const state = useAppStore.getState();
      const page = state.template?.loaded.info.page;
      const availableFontIds = fonts.list().map((font) => font.id);
      const { config, warnings } = parseConfig(json, {
        availableFontIds,
        templateAspectRatio: page ? page.width / page.height : null,
      });
      state.setFields(withAvailableFonts(config.fields, availableFontIds, DEFAULT_FONT_ID));
      state.setMode(config.output.mode);
      if (state.participants && config.nameColumn) {
        const { layout, list } = applyLayout(state.participants.table, {
          hasHeader: state.participants.layout.hasHeader,
          preferredNameColumn: config.nameColumn,
        });
        state.setParticipants({ ...state.participants, layout, list });
      }
      return describeConfigWarnings(warnings, config.customFonts);
    },
    [fonts],
  );
}

/** Restores the last configuration on start and saves it (debounced) on every change. */
export function useConfigPersistence(): void {
  const { configStorage } = useServices();
  const applyConfig = useApplyConfig();
  const currentConfig = useCurrentConfig();
  const fields = useAppStore((state) => state.fields);
  const mode = useAppStore((state) => state.mode);
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = configStorage.load();
    if (!saved) return;
    try {
      applyConfig(saved);
      useAppStore.getState().setNotice({
        kind: 'info',
        text: 'Restauramos el diseño de tu última sesión (campos, posiciones y fuentes).',
      });
    } catch {
      // A corrupt or old configuration is simply ignored.
    }
  }, [applyConfig, configStorage]);

  useEffect(() => {
    if (!restored.current) return;
    const timer = setTimeout(() => {
      configStorage.save(serializeConfig(currentConfig()));
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [fields, mode, configStorage, currentConfig]);
}
