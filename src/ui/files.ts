import type { SourceFile } from '../application/ports';

export async function readSourceFile(file: File): Promise<SourceFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type };
}

/** Starts a browser download of in-memory content. */
export function downloadText(content: string, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
