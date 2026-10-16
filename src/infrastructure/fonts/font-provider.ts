import type {
  FontAsset,
  FontDescriptor,
  FontInfo,
  FontProvider,
  SourceFile,
} from '../../application/ports';
import { AppError } from '../../domain/errors';
import { BUNDLED_FONTS } from './bundled-fonts';

type Fetcher = (url: string) => Promise<Uint8Array>;

const browserFetcher: Fetcher = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
  return new Uint8Array(await response.arrayBuffer());
};

/**
 * Bundled fonts (fetched on demand from /fonts and cached) plus fonts uploaded by the user,
 * which live only in memory for this session.
 */
export function createFontProvider(
  options: { baseUrl?: string; fetcher?: Fetcher } = {},
): FontProvider {
  const { baseUrl = '/', fetcher = browserFetcher } = options;
  const userFonts = new Map<string, { descriptor: FontDescriptor; bytes: Uint8Array }>();
  const cache = new Map<string, Promise<Uint8Array>>();

  return {
    list() {
      return [...BUNDLED_FONTS, ...[...userFonts.values()].map((font) => font.descriptor)];
    },
    async load(id): Promise<FontAsset> {
      const user = userFonts.get(id);
      if (user) return { id, bytes: user.bytes, subset: user.descriptor.subset };
      const bundled = BUNDLED_FONTS.find((font) => font.id === id);
      if (!bundled) throw new AppError('font-invalid', id);
      let pending = cache.get(id);
      if (!pending) {
        pending = fetcher(`${baseUrl}${bundled.path}`);
        cache.set(id, pending);
        pending.catch(() => cache.delete(id));
      }
      return { id, bytes: await pending, subset: bundled.subset };
    },
    registerUserFont(file: SourceFile, info: FontInfo): FontDescriptor {
      let hash = 0x811c9dc5;
      for (
        let i = 0;
        i < file.bytes.length;
        i += Math.max(1, Math.floor(file.bytes.length / 4096))
      ) {
        hash = Math.imul(hash ^ (file.bytes[i] ?? 0), 0x01000193) >>> 0;
      }
      const id = `user-${hash.toString(36)}-${file.bytes.length.toString(36)}`;
      const descriptor: FontDescriptor = {
        id,
        name: info.familyName,
        category: 'custom',
        // fontkit's CFF subsetting is unreliable: those fonts are embedded complete.
        subset: !info.isCff,
        source: 'user',
      };
      userFonts.set(id, { descriptor, bytes: file.bytes });
      return descriptor;
    },
  };
}
