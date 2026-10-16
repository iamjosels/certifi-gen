# PLAN — Generador masivo de certificados

Aplicación web que corre 100% en el navegador: recibe una plantilla de certificado (PDF, PNG o JPG) y una lista de participantes (TXT, CSV, XLSX o DOCX), permite ubicar visualmente los campos de texto y genera un ZIP con un PDF por participante, un único PDF con todos, o ambos. Ningún archivo sale del navegador.

Volumen objetivo: 360 participantes (caso normal), soporte de al menos 1000.

---

## 1. Stack

| Área               | Elección                                                                                              | Notas                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Build              | Vite 8 + `@vitejs/plugin-react`                                                                       | `worker.format: 'es'` para el worker de módulo                                                             |
| UI                 | React 19 + TypeScript 6 (strict)                                                                      | TS 6.0.x porque `typescript-eslint` aún no soporta TS 7                                                    |
| Estilos            | Tailwind CSS 4 (`@tailwindcss/vite`)                                                                  | Tokens en `src/ui/styles/tokens.css` vía `@theme` + variables CSS por tema                                 |
| Estado             | Zustand                                                                                               | `src/ui/store`                                                                                             |
| Íconos             | lucide-react                                                                                          |                                                                                                            |
| PDF (generación)   | `pdf-lib` + `@pdf-lib/fontkit`                                                                        | Fuentes TTF/OTF con subset                                                                                 |
| PDF (vista previa) | `pdfjs-dist` 6.x                                                                                      | Worker con `pdf.worker.min.mjs?url`; assets (`standard_fonts`, `cmaps`, `wasm`, `iccs`) en `public/pdfjs/` |
| ZIP                | JSZip                                                                                                 | Modo STORE (los PDF ya van comprimidos)                                                                    |
| CSV                | PapaParse                                                                                             | Tras decodificar con `TextDecoder`                                                                         |
| Excel              | SheetJS 0.20.3                                                                                        | Tarball oficial en `vendor/` como dependencia `file:` (el paquete `xlsx` de npm está desactualizado)       |
| DOCX               | mammoth                                                                                               | Se le pasa `{ arrayBuffer, buffer }` para funcionar en navegador y Node                                    |
| Unit/integración   | Vitest 5 + Testing Library                                                                            | Proyectos `node` (pool forks) y `jsdom`                                                                    |
| E2E                | Playwright (Chromium) + `@axe-core/playwright`                                                        | Contra `vite build && vite preview`                                                                        |
| Calidad            | ESLint 9 (flat) + typescript-eslint strict-type-checked + react-hooks + jsx-a11y + import-x, Prettier | ESLint 9 porque jsx-a11y aún no declara soporte para ESLint 10                                             |
| Scripts            | tsx                                                                                                   | Fixtures, fuentes, verificación y métricas                                                                 |

Interfaz en español; código, identificadores y commits en inglés.

---

## 2. Arquitectura (hexagonal)

```
src/
  domain/                  Tipos y reglas puras. Sin React ni librerías.
    participant.ts           Participant, normalización, clave de duplicado, detección de duplicados
    title-case.ts            Transformación a Título con partículas, O'Connor, María-José
    field.ts                 FieldConfig, FieldSource, transformaciones, campo por defecto
    template.ts              TemplateInfo: tipo, tamaño en puntos, orientación, rotación, avisos
    text-fit.ts              fitText(text, measure, maxWidth, maxSize, minSize)
    geometry.ts              Relativo ⇄ puntos PDF, cambio de origen, baseline, rotación
    filename.ts              Sanitización de nombres de archivo e índice con ceros
    code-pattern.ts          Códigos correlativos ("CERT-2026-{n:000}")
    progress.ts              ETA y ritmo de generación
    size-estimate.ts         Estimación de peso de ZIP y PDF único
    config.ts                ProjectConfig (schemaVersion), serialización y validación
    report.ts                Filas del reporte.csv
    errors.ts                Códigos de error de dominio (mensajes en español)
  application/             Casos de uso. Solo dependen de domain y de los puertos.
    ports.ts                 ParticipantParser, TemplateLoader, CertificateRenderer, FontProvider,
                             Archiver, TextMeasurer, PreviewRasterizer, ImageOptimizer, ConfigStorage
    parse-participants.ts    Archivo → tabla → participantes + reporte
    build-preview.ts         Un certificado real para la vista previa
    generate-certificates.ts Orquesta lotes, progreso, cancelación, ZIP / PDF único, reporte.csv
    measure-fields.ts        Anchos a 1 pt por texto → ajustes, desbordes y "los más largos"
    estimate-output.ts       Genera una muestra y estima pesos finales
  infrastructure/          Adaptadores que implementan los puertos
    parsers/                 txt-parser, csv-parser, xlsx-parser, docx-parser, decode-text, registry
    pdf/                     template-loader, pdf-lib-renderer, image-embedder, pdfjs-rasterizer
    fonts/                   bundled-font-provider, user-font-loader, fonts.json
    archive/                 jszip-archiver
    image/                   canvas-optimizer
    storage/                 local-config-storage (try/catch)
    worker/                  worker-client (cliente tipado del Web Worker)
  workers/
    protocol.ts              Mensajes tipados main ⇄ worker
    generate.worker.ts       Generación, medición y vista previa fuera del hilo principal
  ui/
    components/  steps/  hooks/  store/  styles/
  composition-root.ts      Único lugar que conecta adaptadores con casos de uso
  main.tsx
scripts/                   generate-fixtures.ts, download-fonts.ts, copy-pdfjs-assets.ts,
                           render-verification.ts, measure-metrics.ts
fixtures/                  Generados por script (en .gitignore; se regeneran con pretest)
tests/
  integration/             Lectura de fixtures, generación de 360, pesos
  e2e/                     Playwright
docs/verification/         PNG de verificación, capturas y reporte Lighthouse
public/fonts/              Fuentes OFL + licencias
public/pdfjs/              Assets de pdfjs
vendor/                    Tarball de SheetJS
```

### Reglas de dependencia (impuestas por ESLint con `import-x/no-restricted-paths`)

- `domain` no importa de `application`, `infrastructure`, `workers` ni `ui`, ni librerías externas.
- `application` solo importa de `domain`.
- `infrastructure` importa de `domain` y `application` (para implementar los puertos).
- `ui` importa de `domain` y `application`, nunca de `infrastructure` ni de `pdf-lib`, `pdfjs-dist`, `jszip`, `xlsx`, `mammoth`, `papaparse` o `@pdf-lib/fontkit`. Los adaptadores llegan por un contexto React creado en `composition-root.ts`.
- Los casos de uso reciben los adaptadores por parámetro.

### Modelo de campos

```ts
type FieldSource =
  | { kind: 'column'; column: string }
  | { kind: 'sequence'; pattern: string; start: number }
  | { kind: 'static'; text: string };

interface FieldConfig {
  id: string;
  label: string;
  source: FieldSource;
  box: { x: number; y: number; width: number }; // 0..1, origen arriba-izquierda; y = centro vertical de la línea
  fontId: string;
  maxSize: number; // pt
  minSize: number; // pt
  color: string; // #rrggbb
  align: 'left' | 'center' | 'right';
  transform: 'none' | 'title' | 'upper';
}
```

El campo "Nombre" (columna de nombre) viene por defecto. El usuario puede agregar otros (código, curso, fecha…). El ancho de la caja es el ancho máximo del texto.

### Medición y desborde

- El worker mide con `widthOfTextAtSize` de pdf-lib (las mismas métricas que la generación) y devuelve el ancho de cada texto a 1 pt.
- `fitText` (dominio) calcula el tamaño que entra en el ancho de la caja entre `maxSize` y `minSize`; si ni el mínimo entra, devuelve `overflow: true`.
- Los desbordes se marcan en rojo antes de generar. Si el usuario genera igual, ese texto se dibuja al tamaño mínimo y queda marcado en `reporte.csv`.

### Generación

- **Plantilla PDF:** primera página (aviso si tiene más), `embedPage` sobre el CropBox y compensación de `/Rotate`. Errores claros si está cifrado o dañado.
- **Plantilla imagen:** página con la proporción de la imagen (lado largo = 842 pt). El `image-embedder` codifica la imagen **una vez por trabajo**: JPG se copia tal cual; PNG RGB/gris de 8 bits sin entrelazar se pasa directo (IDAT + predictor PNG); el resto se decodifica una vez, se quita el alfa si es opaco y se recomprime con filtros (SMask si hay transparencia).
- **PDF único:** la plantilla se incrusta UNA vez y se dibuja en cada página.
- **ZIP:** un PDF por participante (`001_Maria_Jose_Lopez.pdf`) + `reporte.csv` (UTF-8 con BOM: índice, nombre, archivo, código, desborde).
- **Worker:** uno nuevo por trabajo, progreso por lotes, cesión de control entre lotes, cancelación cooperativa (con `terminate()` de respaldo) y resultado devuelto como `Blob`.

---

## 3. Fases y criterios de salida

Regla común para cerrar cualquier fase: `npm run check` (lint + typecheck + test + build) en verde, más los tests propios de la fase; `PROGRESS.md` actualizado; commit con conventional commits en inglés. Nunca se desactivan reglas, se saltan tests ni se bajan umbrales.

### Fase 0 — Setup

- Repo git, `.gitattributes` (LF), `.gitignore`.
- Vite + React + TS strict + Tailwind + ESLint + Prettier + Vitest + Playwright.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `check`, `fixtures`, `fonts`.
- Estructura de carpetas.
- Fuentes OFL descargadas a `public/fonts/` con su licencia; assets de pdfjs copiados.
- `scripts/generate-fixtures.ts` (determinista) genera: plantillas PDF A4 horizontal y vertical, PNG/JPG en ambas orientaciones, PNG pesado (>3 MB), PDF con `/Rotate 90`, PDF con CropBox ≠ MediaBox, PDF cifrado y PDF dañado; listas TXT, CSV UTF-8, CSV Windows-1252 (`;`), XLSX (Nombre, Correo, Curso), DOCX, lista vacía; y `expected.json` con la verdad esperada.
- **Salida:** `npm run check` pasa con un test de humo; E2E de humo que verifica el empaquetado (worker de pdfjs, worker propio, carga diferida de parsers).

### Fase 1 — Dominio

- Normalización (NFC, BOM, invisibles, espacios, vacías), Título con partículas, duplicados sin tildes ni mayúsculas (marcados, no eliminados), `fitText`, geometría relativo ⇄ PDF con casos de borde, nombres de archivo, códigos correlativos, ETA, estimación de peso, validación de configuración.
- **Salida:** cobertura de `src/domain` > 90% (umbral configurado en Vitest).

### Fase 2 — Lectura de participantes

- Un parser por formato detrás de `ParticipantParser`.
- Codificación: UTF-8 estricto → Windows-1252; BOM UTF-16 en TXT.
- CSV/XLSX: detección de encabezado, columnas disponibles, autodetección de nombre/nombres/participante/name/full name.
- DOCX: un nombre por párrafo.
- Reporte: válidos, vacías descartadas, duplicados, columnas.
- **Salida:** tests de integración que leen cada fixture y obtienen exactamente los mismos 360 registros válidos con tildes correctas, incluido el CSV Windows-1252.

### Fase 3 — Motor de generación

- Carga de plantillas, optimización de imágenes pesadas (JPG 0.85 desde canvas, aviso de transparencia), fuentes incluidas y subidas, renderer, worker cancelable con progreso por lotes, `reporte.csv`.
- **Salida:**
  - Test de integración: 360 en ambos modos → 360 archivos en el ZIP, 360 páginas en el PDF único, texto extraído de muestras (primero, último, más largo, uno con ñ) idéntico a la lista.
  - Límites de peso por tipo de plantilla: PDF único ≤ plantilla + 10 MB; cada PDF individual ≤ plantilla + 150 KB.
  - PNG de 4 certificados (más largo, con ñ, con apóstrofe, normal) en `docs/verification/`, revisados visualmente.
  - Tiempo de 360 y pesos de ZIP y PDF único registrados en `PROGRESS.md`.

### Fase 4 — Interfaz

- Asistente de 4 pasos (Plantilla, Participantes, Diseño, Generar) con indicador superior, diseño cuidado con tokens, modo claro/oscuro, accesible (teclado, labels, contraste AA).
- Exportar/importar configuración JSON; última configuración en localStorage (try/catch, nunca archivos).
- **Salida:** tests de componentes de los pasos clave y `npm run check` en verde.

### Fase 5 — E2E y pulido

- Flujos completos con fixtures (ver `PROGRESS.md` para la matriz), errores esperados, cancelar y regenerar, consola sin errores ni warnings, axe por paso y tema, Lighthouse.
- **Salida:** `npm run test:e2e` en verde; Lighthouse sin problemas evidentes.

### Fase 6 — Entrega

- `README.md` en español, `vercel.json`, build de producción probado con `npm run preview` recorriendo el flujo completo.
- **Salida:** checklist de "Definición de terminado" completa con evidencia.

---

## 4. Fuera de alcance: dónde se conectaría cada extensión

| Extensión                   | Punto de conexión                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **QR de verificación**      | Nuevo tipo de campo en `domain/field.ts` (`kind: 'qr'` con patrón de URL, p. ej. `https://verifica.ejemplo.com/{code}`), que reutiliza `code-pattern.ts` para el valor. Un puerto `QrEncoder` en `application/ports.ts` con un adaptador en `infrastructure/qr/`. `CertificateRenderer` dibuja la imagen del QR (embed PNG por certificado) en la caja del campo. La UI agrega la caja en el lienzo como cualquier otro campo. |
| **Envío por correo**        | Puerto `CertificateSender` en `application/ports.ts` y caso de uso `send-certificates.ts` que consume el mismo flujo de `generate-certificates.ts` (cada PDF por participante + columna de correo ya disponible en `Participant.fields`). El adaptador vive en `infrastructure/mail/` y hablaría con un backend (no se puede enviar correo solo desde el navegador).                                                           |
| **Backend o base de datos** | Nuevos adaptadores de los puertos existentes: `ConfigStorage` (hoy localStorage) → API remota; registro de certificados emitidos (para el QR) como puerto `CertificateRegistry`. El dominio y los casos de uso no cambian; solo se cambia el cableado en `composition-root.ts`.                                                                                                                                                |
