import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  blobBytes,
  loadBundledFonts,
  loadParticipants,
  loadTemplateFixture,
  runGeneration,
} from './engine-helpers';

describe('volume: 1000 participants', () => {
  it('generates 1000 certificates in both modes', async () => {
    const [fonts, participants, template] = await Promise.all([
      loadBundledFonts(),
      loadParticipants('participantes-1000.txt'),
      loadTemplateFixture('plantilla-horizontal.pdf'),
    ]);
    expect(participants).toHaveLength(1000);
    const output = await runGeneration({ template, participants, mode: 'both', fonts });
    const zip = await JSZip.loadAsync(await blobBytes(output.zip));
    const pdfs = Object.keys(zip.files).filter((name) => name.endsWith('.pdf'));
    expect(pdfs).toHaveLength(1000);
    expect(pdfs).toContain(`0001_${pdfs[0]?.slice(5) ?? ''}`);
    expect((await PDFDocument.load(await blobBytes(output.merged))).getPageCount()).toBe(1000);
    expect(output.overflowCount).toBe(0);
    console.info(
      `[metrics] 1000 both modes: ${String(Math.round(output.elapsedMs))} ms, ` +
        `ZIP ${(output.zip?.size ?? 0).toLocaleString('en')} B, merged ${(output.merged?.size ?? 0).toLocaleString('en')} B`,
    );
  });
});
