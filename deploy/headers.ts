/**
 * HTTP headers of the deployed site. vite.config.ts applies them to `vite preview` (so the E2E
 * suite runs with the production CSP) and tests/integration/deploy.test.ts checks that
 * vercel.json declares exactly the same values.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // pdf.js decodes some images with WebAssembly.
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
