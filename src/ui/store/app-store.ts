import { create } from 'zustand';
import type { ParticipantsResult } from '../../application/parse-participants';
import type {
  GenerationOutput,
  GenerationProgress,
  LoadedTemplate,
  MeasureResponse,
  SourceFile,
} from '../../application/ports';
import {
  clampBox,
  createField,
  createNameField,
  FIELD_LIMITS,
  NAME_FIELD_ID,
  type FieldConfig,
  type NewFieldKind,
} from '../../domain/field';
import type { ParticipantList } from '../../domain/participant';
import type { OutputMode, SizeEstimate } from '../../domain/size-estimate';

export const STEPS = ['Plantilla', 'Participantes', 'Diseño', 'Generar'] as const;
export type StepIndex = 0 | 1 | 2 | 3;

export interface TemplateState {
  readonly file: SourceFile;
  readonly loaded: LoadedTemplate;
  /** Image used as background in the design canvas (object URL). */
  readonly previewUrl: string;
  readonly releasePreview: () => void;
}

export type GenerationState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly progress: GenerationProgress | null }
  | { readonly status: 'done'; readonly output: GenerationOutput; readonly urls: OutputUrls }
  | { readonly status: 'cancelled' }
  | { readonly status: 'error'; readonly message: string };

export interface OutputUrls {
  readonly zip: string | null;
  readonly merged: string | null;
}

export interface Notice {
  readonly kind: 'info' | 'success' | 'warning';
  readonly text: string;
}

export interface AppState {
  step: StepIndex;
  template: TemplateState | null;
  participants: ParticipantsResult | null;
  fields: FieldConfig[];
  selectedFieldId: string;
  previewIndex: number;
  mode: OutputMode;
  measurements: MeasureResponse | null;
  /** Increases when a user font is added, so font lists and faces refresh. */
  fontsVersion: number;
  estimate: SizeEstimate | null;
  generation: GenerationState;
  notice: Notice | null;

  setStep: (step: StepIndex) => void;
  setTemplate: (template: TemplateState | null) => void;
  setParticipants: (participants: ParticipantsResult | null) => void;
  updateParticipantList: (list: ParticipantList) => void;
  setFields: (fields: FieldConfig[]) => void;
  updateField: (id: string, patch: Partial<Omit<FieldConfig, 'id'>>) => void;
  addField: (kind: NewFieldKind, column?: string) => void;
  removeField: (id: string) => void;
  selectField: (id: string) => void;
  setPreviewIndex: (index: number) => void;
  setMode: (mode: OutputMode) => void;
  setMeasurements: (measurements: MeasureResponse | null) => void;
  bumpFonts: () => void;
  setEstimate: (estimate: SizeEstimate | null) => void;
  setGeneration: (generation: GenerationState) => void;
  setNotice: (notice: Notice | null) => void;
  reset: () => void;
}

function revokeOutput(generation: GenerationState): void {
  if (generation.status !== 'done') return;
  if (generation.urls.zip) URL.revokeObjectURL(generation.urls.zip);
  if (generation.urls.merged) URL.revokeObjectURL(generation.urls.merged);
}

const initialState = () => ({
  step: 0 as StepIndex,
  template: null,
  participants: null,
  fields: [createNameField()],
  selectedFieldId: NAME_FIELD_ID,
  previewIndex: 0,
  mode: 'both' as OutputMode,
  measurements: null,
  fontsVersion: 0,
  estimate: null,
  generation: { status: 'idle' } as GenerationState,
  notice: null,
});

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState(),

  setStep: (step) => {
    set({ step });
  },
  setTemplate: (template) => {
    get().template?.releasePreview();
    revokeOutput(get().generation);
    set({ template, estimate: null, generation: { status: 'idle' } });
  },
  setParticipants: (participants) => {
    revokeOutput(get().generation);
    set({
      participants,
      previewIndex: 0,
      measurements: null,
      estimate: null,
      generation: { status: 'idle' },
    });
  },
  updateParticipantList: (list) => {
    const participants = get().participants;
    if (!participants) return;
    set({
      participants: { ...participants, list },
      previewIndex: Math.min(get().previewIndex, Math.max(0, list.participants.length - 1)),
      estimate: null,
    });
  },
  setFields: (fields) => {
    const selected = fields.some((field) => field.id === get().selectedFieldId)
      ? get().selectedFieldId
      : (fields[0]?.id ?? NAME_FIELD_ID);
    set({ fields, selectedFieldId: selected, estimate: null });
  },
  updateField: (id, patch) => {
    set({
      fields: get().fields.map((field) => {
        if (field.id !== id) return field;
        const next = { ...field, ...patch };
        return { ...next, box: clampBox(next.box) };
      }),
      estimate: null,
    });
  },
  addField: (kind, column) => {
    const { fields } = get();
    if (fields.length >= FIELD_LIMITS.maxFields) return;
    const field = createField(kind, fields, column === undefined ? {} : { column });
    set({ fields: [...fields, field], selectedFieldId: field.id, estimate: null });
  },
  removeField: (id) => {
    if (id === NAME_FIELD_ID) return;
    const fields = get().fields.filter((field) => field.id !== id);
    set({ fields, selectedFieldId: NAME_FIELD_ID, estimate: null });
  },
  selectField: (id) => {
    set({ selectedFieldId: id });
  },
  setPreviewIndex: (index) => {
    set({ previewIndex: index });
  },
  setMode: (mode) => {
    set({ mode });
  },
  setMeasurements: (measurements) => {
    set({ measurements });
  },
  bumpFonts: () => {
    set({ fontsVersion: get().fontsVersion + 1 });
  },
  setEstimate: (estimate) => {
    set({ estimate });
  },
  setGeneration: (generation) => {
    const previous = get().generation;
    if (previous !== generation) revokeOutput(previous);
    set({ generation });
  },
  setNotice: (notice) => {
    set({ notice });
  },
  reset: () => {
    get().template?.releasePreview();
    revokeOutput(get().generation);
    set(initialState());
  },
}));

/** Which steps can be opened, given what the user already provided. */
export function reachableSteps(state: Pick<AppState, 'template' | 'participants'>): boolean[] {
  const hasTemplate = state.template !== null;
  const hasParticipants = state.participants !== null;
  return [true, hasTemplate, hasTemplate && hasParticipants, hasTemplate && hasParticipants];
}
