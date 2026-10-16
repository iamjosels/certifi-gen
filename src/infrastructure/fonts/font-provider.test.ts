import { describe, expect, it, vi } from 'vitest';
import { BUNDLED_FONTS } from './bundled-fonts';
import { createFontProvider } from './font-provider';

describe('createFontProvider', () => {
  it('lists the bundled fonts and loads them once from the base URL', async () => {
    const fetcher = vi.fn((url: string) => Promise.resolve(new TextEncoder().encode(url)));
    const provider = createFontProvider({ baseUrl: '/app/', fetcher });
    expect(provider.list().map((font) => font.id)).toEqual(BUNDLED_FONTS.map((font) => font.id));
    const [a, b] = await Promise.all([provider.load('poppins'), provider.load('poppins')]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('/app/fonts/poppins/Poppins-Medium.ttf');
    expect(a).toEqual(b);
    expect(a.subset).toBe(true);
  });

  it('retries after a failed download', async () => {
    const fetcher = vi
      .fn<(url: string) => Promise<Uint8Array>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new Uint8Array([1]));
    const provider = createFontProvider({ fetcher });
    await expect(provider.load('marcellus')).rejects.toThrow('offline');
    await expect(provider.load('marcellus')).resolves.toMatchObject({ bytes: new Uint8Array([1]) });
  });

  it('rejects unknown fonts', async () => {
    await expect(createFontProvider().load('nope')).rejects.toMatchObject({ code: 'font-invalid' });
  });

  it('registers user fonts in memory, without subsetting CFF fonts', async () => {
    const provider = createFontProvider({ fetcher: () => Promise.reject(new Error('unused')) });
    const bytes = new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 9, 9]);
    const cff = provider.registerUserFont(
      { name: 'Mía.otf', bytes },
      { familyName: 'Mía', isCff: true, isVariable: false, missingSpanishChars: [] },
    );
    expect(cff).toMatchObject({ name: 'Mía', category: 'custom', subset: false, source: 'user' });
    expect(provider.list().at(-1)).toEqual(cff);
    await expect(provider.load(cff.id)).resolves.toEqual({ id: cff.id, bytes, subset: false });
    const ttf = provider.registerUserFont(
      { name: 'Otra.ttf', bytes: new Uint8Array([0, 1, 0, 0, 1]) },
      { familyName: 'Otra', isCff: false, isVariable: false, missingSpanishChars: [] },
    );
    expect(ttf.subset).toBe(true);
    expect(ttf.id).not.toBe(cff.id);
  });
});
