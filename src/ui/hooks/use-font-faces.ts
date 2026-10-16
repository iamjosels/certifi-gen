import { useEffect, useState } from 'react';
import { useServices } from './services-context';

const loading = new Map<string, Promise<void>>();

export function fontFamilyFor(fontId: string): string {
  return `cf-${fontId}`;
}

/**
 * Registers the certificate fonts as CSS FontFaces (same files as the PDF) so the design
 * canvas shows the real typography. Returns the ids that are ready.
 */
export function useFontFaces(fontIds: readonly string[]): ReadonlySet<string> {
  const { fonts } = useServices();
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  const key = [...new Set(fontIds)].sort().join('|');

  useEffect(() => {
    let alive = true;
    for (const id of key.split('|').filter(Boolean)) {
      let pending = loading.get(id);
      if (!pending) {
        pending = (async () => {
          if (typeof FontFace === 'undefined') return;
          const asset = await fonts.load(id);
          const face = new FontFace(fontFamilyFor(id), asset.bytes.slice().buffer);
          await face.load();
          document.fonts.add(face);
        })();
        loading.set(id, pending);
      }
      pending.then(
        () => {
          if (alive) setReady((current) => (current.has(id) ? current : new Set(current).add(id)));
        },
        () => {
          loading.delete(id);
        },
      );
    }
    return () => {
      alive = false;
    };
  }, [key, fonts]);

  return ready;
}
