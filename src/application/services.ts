import type {
  ConfigStorage,
  FontProvider,
  GenerationEngine,
  ImageOptimizer,
  ParticipantParserRegistry,
  PreviewRasterizer,
} from './ports';

/** Everything the UI needs from the outside world, created by composition-root.ts. */
export interface AppServices {
  readonly engine: GenerationEngine;
  readonly parsers: ParticipantParserRegistry;
  readonly fonts: FontProvider;
  readonly rasterizer: PreviewRasterizer;
  readonly imageOptimizer: ImageOptimizer;
  readonly configStorage: ConfigStorage;
}
