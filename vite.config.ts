import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { SECURITY_HEADERS } from './deploy/headers.ts';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // Loaded lazily (dynamic import or inside the worker): pre-bundle them at startup so the
    // dev server does not re-optimize and reload in the middle of a session.
    include: [
      'pdfjs-dist',
      'pdf-lib',
      '@pdf-lib/fontkit',
      '@pdf-lib/upng',
      'jszip',
      'papaparse',
      'mammoth',
      'xlsx',
      'fflate',
    ],
  },
  build: {
    target: 'es2023',
    sourcemap: false,
  },
  preview: {
    port: 4173,
    strictPort: true,
    // Same headers as production (vercel.json), so the E2E suite runs under the real CSP.
    headers: { ...SECURITY_HEADERS },
  },
});
