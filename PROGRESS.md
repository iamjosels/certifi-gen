# PROGRESS

Registro de avance por fase. Si la sesión se interrumpe, se retoma desde la primera fase que no esté marcada como cerrada.

| Fase              | Estado    | Commit             |
| ----------------- | --------- | ------------------ |
| 0 — Setup         | cerrada   | ver `git log` (#0) |
| 1 — Dominio       | pendiente | —                  |
| 2 — Participantes | pendiente | —                  |
| 3 — Motor         | pendiente | —                  |
| 4 — Interfaz      | pendiente | —                  |
| 5 — E2E y pulido  | pendiente | —                  |
| 6 — Entrega       | pendiente | —                  |

## Decisiones globales

- **TypeScript 6.0.x** (no 7): `typescript-eslint` 8.71 declara `typescript <6.1.0`.
- **ESLint 9.39** (no 10): `eslint-plugin-jsx-a11y` 6.10 declara soporte hasta ESLint 9.
- Commits solo locales (no hay remoto configurado); el proyecto queda listo para Vercel pero no se despliega.
- **SheetJS 0.20.3** desde `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, guardado en `vendor/` y referenciado como `file:vendor/xlsx-0.20.3.tgz` (recomendación oficial; 0.20.3 sigue siendo la última publicada en su CDN).
- `npm audit` reporta 3 vulnerabilidades moderadas en `sprintf-js` → `argparse` → `mammoth`. `argparse` solo lo usa la CLI de mammoth (no se incluye en el bundle del navegador); la "solución" de npm baja mammoth a 0.3.x, así que se mantiene la versión actual.

---

## Fase 0 — Setup ✅

**Qué se hizo**

- Repo git (`main`), `.gitattributes` con `eol=lf` y binarios marcados, `.gitignore`.
- Vite 8 + React 19 + TS 6 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.), Tailwind 4 con tokens semánticos (`src/ui/styles/tokens.css`) y modo oscuro por `data-theme`.
- Tres proyectos TypeScript: `tsconfig.app.json` (DOM), `tsconfig.worker.json` (lib `WebWorker`, solo `*.worker.ts`) y `tsconfig.node.json` (scripts, tests y configs).
- ESLint flat: typescript-eslint strict + stylistic type-checked, react-hooks, react-refresh, jsx-a11y strict y Prettier. Las reglas de capas se imponen con `import-x/no-restricted-paths` (zonas por carpeta) y `no-restricted-imports` (domain/application sin librerías externas; UI sin pdf-lib, pdfjs, JSZip, xlsx, mammoth, papaparse, fontkit ni fflate).
- Vitest 5 con dos proyectos (`node` con `pool: 'forks'` y `ui` con jsdom) y cobertura v8 con umbral 90% en `src/domain/**`.
- Playwright (Chromium 156) contra `npm run build && npm run preview`, con un fixture automático que falla la prueba ante cualquier `console.error`, `console.warn`, mensaje `Warning:` de pdf.js o error de página.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `check`, `fixtures`, `fonts`, `pdfjs-assets`, `verify:render`, `metrics`.
- Fuentes OFL estáticas descargadas de `google/fonts` (`npm run fonts`) a `public/fonts/<id>/` con su `OFL.txt`:
  DM Serif Display (75 KB), Poppins Medium (155 KB), Great Vibes (447 KB), Barlow Condensed Medium (101 KB), Marcellus (45 KB).
- Assets de pdf.js (`standard_fonts`, `cmaps`, `wasm`, `iccs`) copiados a `public/pdfjs/` en `predev`/`prebuild` (no se versionan).
- `scripts/generate-fixtures.ts` (determinista, semilla 2026, se salta si las fuentes del generador no cambiaron; `--force` para regenerar) genera en `fixtures/`:
  - Plantillas: PDF A4 horizontal y vertical (dibujadas con pdf-lib y las fuentes incluidas), PNG y JPG horizontales y verticales (rasterizados del mismo PDF a 200 DPI con pdf.js + @napi-rs/canvas), PNG pesado con textura de papel (6,8 MB), PNG con transparencia (>1 MB), JPG con EXIF Orientation = 6, PDF de 2 páginas, PDF con `/Rotate 90`, PDF con CropBox ≠ MediaBox (sangrado de 36 pt), PDF con `/Encrypt` y PDF dañado, más un GIF (formato no soportado).
  - Listas: `participantes-360.txt` (UTF-8 con BOM, CRLF), CSV UTF-8 (`,`), CSV Windows-1252 (`;`, CRLF, como Excel en Windows en español), XLSX (Nombre, Correo, Curso), DOCX (un nombre por párrafo), lista vacía y JSON (no soportado).
  - Los 360 nombres incluyen tildes, ñ, ü, ë, apóstrofes (`O'Connor`, `O’Neill`), guiones (`María-José`), partículas (`de la`, `van der`, `von`, `da`), 5 nombres de más de 45 caracteres, 3 pares de duplicados exactos y 2 pares que solo difieren en tildes/mayúsculas, mayúsculas mezcladas, y en los archivos: espacios dobles, tabs, NBSP, espacio de ancho cero, guion suave y 17 filas/líneas vacías.
  - `expected.json`: los 360 nombres normalizados esperados, grupos de duplicados y muestras (primero, último, más largo, con ñ, con apóstrofe, con guion, con diéresis, normal).
- App mínima en español y tests de humo: render de la app (jsdom), fixtures (node) y carga de la app sin errores de consola (E2E).

**Decisiones**

- Los fixtures no se versionan: se regeneran en `pretest` y `pretest:e2e` (≈3,5 s), así el repositorio no carga con 14 MB de binarios.
- El PDF "protegido" es un PDF válido con diccionario `/Encrypt` en el trailer (no hay `qpdf` en el entorno para cifrar de verdad); pdf-lib lo rechaza igual que a uno cifrado real.
- El espacio del nombre en las plantillas de prueba está centrado al 50% de la altura, alineado con la posición por defecto del campo "Nombre".
- Revisé visualmente las plantillas horizontal y vertical, y las variantes rotada y recortada renderizadas con pdf.js: se ven derechas y completas.

**Pruebas que pasan**

- `npm run check` ✅ (lint, typecheck, 3 tests, build).
- `npm run test:e2e` ✅ (1 test de humo).

**Pendientes**

- Ninguno de la fase.
