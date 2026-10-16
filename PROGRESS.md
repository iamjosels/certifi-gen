# PROGRESS

Registro de avance por fase. Si la sesión se interrumpe, se retoma desde la primera fase que no esté marcada como cerrada.

Los hashes de commit de cada fase se ven con `git log --oneline` (cada mensaje termina en `(phase N)`).

| Fase              | Estado  |
| ----------------- | ------- |
| 0 — Setup         | cerrada |
| 1 — Dominio       | cerrada |
| 2 — Participantes | cerrada |
| 3 — Motor         | cerrada |
| 4 — Interfaz      | cerrada |
| 5 — E2E y pulido  | cerrada |
| 6 — Entrega       | cerrada |

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

---

## Fase 1 — Dominio ✅

**Qué se hizo** (`src/domain/`, sin dependencias externas; lo impone ESLint)

- `text.ts`: normalización (NFC; quita BOM y caracteres de formato `\p{Cf}` como el espacio de ancho cero, el guion suave o las marcas bidi; quita controles; cualquier espacio Unicode → un espacio; trim), `stripDiacritics` y `comparisonKey` (sin tildes ni mayúsculas, con apóstrofes y guiones tipográficos unificados).
- `title-case.ts`: Título con partículas en minúscula salvo al inicio (de, del, la, las, los, y, e, da, van, von, más das, do, dos, di, du, der, den), apóstrofes (`O'Connor`, `O’Neill`, `D'Angelo`), guiones (`María-José`) y palabras que empiezan con dígito (`3ro`). Mayúsculas con locale `es`.
- `participant.ts`: lista de participantes, vacías descartadas, duplicados marcados (`duplicateOf` + grupos) y nunca eliminados; edición rápida con recálculo de duplicados.
- `table.ts`: detección de encabezado (nombres conocidos, o columna de correos debajo), autodetección de la columna de nombre (nombre completo > nombre > nombres > participante > name…; si no hay, la primera columna con texto) y etiquetas de columna únicas.
- `field.ts`: modelo de N campos (`name`, `column`, `sequence`, `static`), transformaciones y campo "Nombre" por defecto.
- `text-fit.ts`: `fitText` (estimación proporcional y bajada en pasos de 0,25 pt; funciona también con medidas no lineales) y `fitFromUnitWidth`.
- `geometry.ts`: relativo ⇄ PDF ⇄ canvas, baseline centrada por altura de mayúsculas, alineación, y transformación para enderezar páginas con `/Rotate`.
- `filename.ts`: `001_Maria_Jose_Lopez.pdf` (índice con ceros según el total, solo `[A-Za-z0-9_]`, máximo 80 caracteres de nombre, respaldo `certificado`).
- `code-pattern.ts`: `{n}`, `{n:000}`, llaves literales `{{ }}` y validación.
- `template.ts` (firma del archivo, orientación, tamaño de página para imágenes, EXIF Orientation), `progress.ts` (ETA y lotes), `size-estimate.ts`, `config.ts` (`schemaVersion`, validación completa, avisos de fuente faltante y de proporción distinta), `report.ts` (`reporte.csv`), `layout.ts` (desbordes y "los más largos" por ancho medido) y `errors.ts` (códigos de error; los textos en español viven en la UI).

**Decisiones**

- La transformación por defecto del campo Nombre es "ninguna": respeta lo escrito (p. ej. `McDonald`); el usuario puede elegir Título o MAYÚSCULAS.
- Se agregaron partículas extra (das, do, dos, di, du, der, den) para que `van der Berg` quede bien.
- Un texto que desborda se dibuja al tamaño mínimo y se marca en `reporte.csv`; la UI lo avisa antes de generar.
- `reporte.csv` usa coma (RFC 4180) con BOM UTF-8 para que Excel muestre bien las tildes.
- Los mensajes de error se resuelven en la UI a partir de `AppError.code`, para que dominio e infraestructura no tengan textos de interfaz.

**Pruebas que pasan**

- 161 tests de dominio en 16 archivos. Cobertura de `src/domain`: **99,35% sentencias, 95,39% ramas, 100% funciones, 100% líneas** (umbral: 90%).
- Verificado que ESLint rechaza domain → ui, domain → `pdf-lib`, application → infrastructure y ui → `pdf-lib`.
- `npm run check` ✅.

**Pendientes**

- Ninguno de la fase.

---

## Fase 2 — Lectura de participantes ✅

**Qué se hizo**

- Puertos `ParticipantParser` y `ParticipantParserRegistry` (`src/application/ports.ts`) y caso de uso `parseParticipants` + `applyLayout` (`src/application/parse-participants.ts`): detecta formato, carga el parser, detecta encabezado y columna de nombre, normaliza y marca duplicados. `applyLayout` permite cambiar la columna o el encabezado sin volver a leer el archivo.
- Un parser por formato en `src/infrastructure/parsers/`, cada uno cargado bajo demanda (`import()` → chunk propio):
  - `txt-parser`: una línea por participante.
  - `csv-parser`: PapaParse con detección de separador (`,` `;` tab `|`).
  - `xlsx-parser`: SheetJS, primera hoja con datos, celdas como texto formateado.
  - `docx-parser`: mammoth, un nombre por párrafo (los saltos de línea dentro de un párrafo también separan).
- `decode-text.ts`: BOM UTF-8/UTF-16, UTF-16 sin BOM por heurística, UTF-8 estricto (`TextDecoder` con `fatal: true`) y, si falla, Windows-1252.
- `registry.ts`: detección por extensión (txt, csv, tsv, xlsx, xlsm, xls, docx) validada con la firma del archivo (ZIP/OLE), para rechazar archivos renombrados.

**Decisiones**

- Se acepta también `.xls`/`.xlsm`/`.tsv` porque SheetJS y PapaParse los leen sin costo extra.
- Un archivo sin participantes válidos es un error (`list-empty`), no una lista vacía silenciosa.

**Pruebas que pasan**

- `tests/integration/participants.test.ts`: cada uno de los 5 fixtures (TXT, CSV UTF-8, CSV Windows-1252, XLSX, DOCX) produce **exactamente los mismos 360 nombres de `expected.json`**, con tildes, ñ, ü, ë, apóstrofes y guiones correctos; 17 vacías descartadas; los mismos 5 grupos de duplicados; encabezado y columna "Nombre" detectados en CSV/XLSX; codificación `windows-1252` detectada. También: elegir otra columna, tratar el encabezado como dato, lista vacía, formato no soportado, XLSX y DOCX dañados.
- Unitarios de decodificación, separación de líneas, CSV y registro.
- `npm run check` ✅ (201 tests).

**Pendientes**

- Ninguno de la fase (la carga de xlsx/mammoth en el navegador se valida en los E2E de la Fase 5).

---

## Fase 3 — Motor de generación ✅

**Qué se hizo**

- **Puertos** (`src/application/ports.ts`): `TemplateLoader`, `FontProvider`, `CertificateRenderer` (+ `RenderSession`, `TextMeasurer`, `MergedDocumentBuilder`), `Archiver`, `GenerationEngine` (hilo principal → worker), `PreviewRasterizer`, `ImageOptimizer` y `ConfigStorage`; `AppServices` agrupa lo que recibe la UI.
- **Casos de uso**:
  - `generateCertificates`: lotes, progreso por fase (`rendering`/`packaging`), punto de cancelación entre lotes, ZIP con `reporte.csv` y/o PDF único.
  - `buildPreview`: un certificado real.
  - `measureFields`: ancho a 1 pt de cada texto y glifos faltantes.
  - `estimateOutput`: genera 3 certificados individuales y 2 PDFs únicos de muestra.
- **Plantillas** (`infrastructure/pdf/template-loader.ts`), con detección por firma:
  - PDF con pdf-lib (`throwOnInvalidObject`): primera página, con aviso si hay más; respeta `/Rotate` y CropBox.
  - Errores: `template-pdf-encrypted`, `template-pdf-damaged`, `template-unsupported` y `template-image-damaged`.
  - PNG/JPG: página con la proporción de la imagen (lado largo de 842 pt), detección de transparencia real, aviso de imagen pesada (>1 MB) y de orientación EXIF.
- **Imagen incrustada una sola vez** (`png.ts`, `image-embedder.ts`):
  - El PNG se codifica una vez por trabajo y se cachea en el worker.
  - Los PNG RGB, gris o paleta de 8 bits se pasan tal cual (IDAT + predictor PNG).
  - El resto se decodifica una vez, se elimina el alfa si es opaco (o va a un SMask), se filtra por filas (heurística de libpng) y se comprime a nivel 9.
  - El JPG se incrusta sin decodificar. La orientación EXIF se aplica con una matriz (`exifImageMatrix`), sin recomprimir.
- **Renderer con pdf-lib** (`pdf-lib-renderer.ts`):
  - Plantilla PDF con `embedPage` sobre el CropBox y una transformación que endereza `/Rotate`.
  - Ajuste del texto con `fitText`, midiendo con `widthOfTextAtSize` de la misma fuente.
  - Baseline centrada con la altura de mayúsculas de la fuente.
  - Metadatos del PDF: título e idioma `es`.
- **Fuentes**:
  - `bundled-fonts.ts`: manifiesto de las incluidas.
  - `font-tools.ts`: validación TTF/OTF; detecta CFF, fuentes variables y glifos faltantes.
  - `font-provider.ts`: carga diferida con caché; las fuentes subidas viven en memoria y las CFF se incrustan completas.
- **ZIP**: `jszip-archiver.ts` (STORE).
- **Worker**:
  - `workers/protocol.ts` (mensajes tipados), `workers/handler.ts` (testeable sin `Worker`) y `workers/generate.worker.ts`.
  - Cliente `infrastructure/worker/worker-client.ts`: un worker persistente para tareas rápidas y uno nuevo por generación.
  - Cancelación cooperativa, con `terminate()` si no se detiene en 500 ms.
  - Si el worker se cae, devuelve `worker-unavailable` y se recrea.
- **Hilo principal**:
  - `pdfjs-rasterizer.ts`: pdf.js cargado bajo demanda, assets locales, solo muestra errores.
  - `canvas-optimizer.ts`: detecta transparencia y convierte a JPG 0,85 con fondo blanco.
  - `local-config-storage.ts`: con try/catch.
  - `composition-root.ts` y `ServicesProvider`.
- **Scripts**: `npm run verify:render` (imágenes de verificación) y `npm run metrics` (`docs/verification/metrics-node.json`).

**Decisiones y hallazgos**

- **Las 5 fuentes se incrustan recortadas (subset).** `fonts.test.ts` demuestra que, con la misma maquetación, la fuente recortada y la completa dan **píxeles idénticos** en las 5 fuentes, y que el texto extraído es exacto con las dos incrustaciones.
- **Bug de pdf-lib con la fuente completa.**
  - Al incrustar sin recortar, la tabla de anchos `W` solo incluye glifos alcanzables desde el `cmap`.
  - Los alternativos contextuales y las ligaduras (Great Vibes; "fl" en DM Serif) quedan con el ancho por defecto, y el texto se ve mal espaciado.
  - Por eso las fuentes que se incrustan completas (solo las CFF subidas por el usuario) desactivan `liga/clig/calt/dlig/rlig/rclt/ccmp`, tanto al dibujar como al medir.
  - Las fuentes recortadas conservan ligaduras y alternativos.
- `EncryptedPDFError` de pdf-lib no conserva su prototipo (está compilado a ES5), así que también se detecta por el mensaje.
- UPNG (`@pdf-lib/upng`) pasó a ser dependencia directa; su export se resuelve tanto en ESM como en CJS.
- **ZIP enorme con plantillas pesadas.** Con el PNG de 6,8 MB, los 360 PDFs individuales suman 2,4 GB, porque cada uno incluye la plantilla. El estimador y la UI avisarán antes de generar y ofrecerán la optimización a JPG.
- pdf.js se carga bajo demanda: el bundle inicial bajó de 659 KB a 230 KB.
- **Empaquetado en el navegador.** La prueba con el worker propio, el de pdf.js y los parsers diferidos se hace con los E2E de flujo completo (Fases 4 y 5), cuando la UI los usa. En esta fase el build ya genera los chunks `generate.worker-*.js`, `pdf.worker.min-*.mjs`, `pdf-*.js` y uno por parser.

**Pruebas que pasan**

- `tests/integration/generation.test.ts` (24 tests), con los 360 certificados en ambos modos:
  - **360 PDF + `reporte.csv` en el ZIP, y 360 páginas en el PDF único**.
  - Texto extraído idéntico para el primero, el último, el más largo, uno con ñ, uno con apóstrofe y uno con ü.
  - Los 5 nombres de más de 45 caracteres quedan dentro de su caja; `reporte.csv` no marca desbordes; el progreso se reporta por lotes.
  - Límites de peso en 11 variantes de plantilla: PDF horizontal y vertical, PNG y JPG horizontales y verticales, PNG pesado, PNG transparente, JPG con EXIF, PDF rotado y PDF recortado.
  - También: varios campos (código, columna), desborde marcado, transformación a Título y cancelación.
- `tests/integration/templates.test.ts`:
  - Tamaño, orientación, avisos, transparencia y errores esperados.
  - Cada variante (rotada, recortada, PNG, JPG, EXIF, pesada) se ve igual que la plantilla PDF horizontal: diferencia media de píxeles menor a 6/255.
- `tests/integration/fonts.test.ts`: glifos del español en las 5 fuentes y equivalencia entre recortada y completa.
- Unitarios del handler y del cliente del worker (cancelación cooperativa y forzada, errores, caída del worker), del proveedor de fuentes y del almacenamiento.
- `npm run check` ✅ (302 tests).

**Verificación visual** (`docs/verification/`, revisadas una por una)

| Archivo                           | Caso                                                       | Resultado                                                             |
| --------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `1-mas-largo(-zoom).png`          | "José Ignacio Rodríguez de la Fuente Echeverría Aranguren" | Reducido para entrar en la caja, centrado, tildes nítidas, sin cortes |
| `2-con-enie(-zoom).png`           | "Teresa Ibáñez Vázquez"                                    | ñ y tildes correctas, a tamaño máximo                                 |
| `3-con-apostrofe(-zoom).png`      | "Seán O'Connor"                                            | Apóstrofe y tilde correctos                                           |
| `4-normal(-zoom).png`             | "Elena Etxeberria"                                         | Centrado sobre la línea                                               |
| `5-vertical-mas-largo(-zoom).png` | El más largo en la plantilla vertical                      | Más pequeño, dentro del marco                                         |
| `6-caligrafica-guion(-zoom).png`  | "María-José López" en Great Vibes recortada                | Enlaces caligráficos y guion correctos                                |

**Métricas** (Node 24, 360 participantes, modo "ambos", mediana de 3 ejecuciones; en `docs/verification/metrics-node.json`)

| Plantilla      | Peso plantilla | Tiempo               | ZIP     | Promedio por PDF | PDF único |
| -------------- | -------------- | -------------------- | ------- | ---------------- | --------- |
| PDF horizontal | 11,6 KB        | 5,75 s               | 6,87 MB | 19,1 KB          | 139 KB    |
| PDF vertical   | 11,6 KB        | 5,66 s               | 6,87 MB | 19,1 KB          | 140 KB    |
| PNG horizontal | 128,5 KB       | 5,41 s               | 40,7 MB | 113,0 KB         | 233 KB    |
| JPG horizontal | 161,6 KB       | 5,34 s               | 60,5 MB | 168,0 KB         | 288 KB    |
| PNG pesado     | 7,09 MB        | 15,4 s (1 ejecución) | 2,42 GB | 6,71 MB          | 6,83 MB   |

- Límites de la "Definición de terminado":
  - PDF único ≤ plantilla + 10 MB ✅. El más pesado mide 6,83 MB, con una plantilla de 7,09 MB.
  - Cada PDF individual ≤ plantilla + 150 KB ✅. Por ejemplo: 19 KB con la plantilla PDF de 11,6 KB, y 169 KB con la JPG de 161,6 KB.
- El tiempo en el navegador se mide en los E2E (Fase 5).

**Pendientes**

- Ninguno de la fase.

---

## Fase 4 — Interfaz ✅

**Qué se hizo**

- **Asistente de 4 pasos** (`src/ui/App.tsx`):
  - Encabezado fijo con marca, indicador de progreso (`Stepper`, con pasos completados y bloqueados), exportar/importar configuración y selector de tema.
  - Pie fijo con Atrás / Continuar y la nota de privacidad.
  - Avisos (`aria-live`), enlace "Saltar al contenido" y un `h1` para lectores de pantalla.
  - Transición suave entre pasos.
- **Estado** con Zustand (`ui/store/app-store.ts`). Los adaptadores llegan por `ServicesProvider`/`useServices`; ningún componente importa pdf-lib, pdfjs, JSZip ni los parsers (lo impone ESLint).
- **Paso 1 – Plantilla:**
  - Zona de arrastrar y soltar con ilustración y miniatura (pdf.js para PDF, la imagen misma para PNG/JPG).
  - Tamaño en mm y pt, orientación, peso, píxeles y avisos (páginas extra, EXIF).
  - Imagen pesada → "Optimizar" (JPG 85 %); si hay transparencia, primero avisa y pide "Optimizar igual".
- **Paso 2 – Participantes:**
  - Contadores de válidos, vacías, repetidos y columnas; aviso de duplicados con el filtro "Ver repetidos".
  - Selector de la columna de nombre y casilla "La primera fila es el encabezado".
  - Tabla con búsqueda (sin tildes ni mayúsculas), paginación de 20 filas y edición rápida en línea (Enter guarda, Escape cancela, no admite nombres vacíos).
- **Paso 3 – Diseño:**
  - Lienzo SVG en puntos PDF sobre la plantilla, con el texto en la fuente real (FontFace con los mismos TTF del PDF).
  - Cajas que se arrastran y redimensionan (asas laterales); también con el teclado: flechas, Mayús para pasos grandes, Alt para el ancho.
  - Guías de centrado con snap (±1,2 %).
  - Panel lateral: campos (nombre, código correlativo, columna, texto fijo), fuente (incluidas + subir TTF/OTF), tamaño máximo/mínimo, color, alineación, transformación, posición y ancho en %, "Centrar en la página".
  - Selector de participante, "Ver los más largos" (los 3 de mayor ancho medido) y "Vista previa real" (el PDF generado por el worker, mostrado con pdf.js).
  - Desbordes marcados en rojo en el lienzo y listados antes de generar; aviso de caracteres que la fuente no tiene.
- **Paso 4 – Generar:**
  - Modo ZIP / PDF único / ambos y peso estimado (aviso si el ZIP supera 500 MB, con el botón "Optimizar plantilla").
  - Avisos de desbordes y de códigos con patrón inválido (este último bloquea la generación).
  - Progreso "123/360" con tiempo restante, fase "Empaquetando" y botón Cancelar.
  - Resumen al terminar, una descarga por archivo y "Generar de nuevo".
- **Configuración:**
  - Exportar/importar JSON (`configuracion-certificados.json`) con validación y avisos (fuente faltante → DM Serif Display; proporción distinta).
  - La última configuración se guarda en localStorage (con `try/catch`; solo la configuración) y se restaura al abrir.
- **Diseño visual:**
  - Tokens semánticos en `tokens.css`, con claro y oscuro por `data-theme` y la preferencia guardada.
  - Tipografía editorial (DM Serif Display en títulos), ilustraciones en los estados vacíos y microinteracciones: hover con elevación, arrastre que resalta la zona, barra de progreso animada, confirmación final.
  - `prefers-reduced-motion` respetado.
  - El lienzo usa tokens propios (`--c-canvas-*`), iguales en ambos temas, porque la plantilla siempre es un documento claro.
  - Probado a 1440, 1280, 1024 y 768 px.
- **Accesibilidad:**
  - Todos los controles tienen etiqueta; los grupos de opciones son `radiogroup`, los campos son pestañas y el diálogo es `<dialog>` nativo.
  - Las cajas del lienzo son enfocables y describen cómo moverlas.
  - Barra de progreso con `aria-valuenow`; los colores de texto cumplen contraste AA (se audita en la Fase 5).

**Decisiones**

- Los tests de componentes viven en `tests/ui/`, para poder usar adaptadores reales (el registro de parsers) sin romper la regla de capas de `src/ui`.
- Números con `es-PE` (punto decimal, coma de miles).
- Un patrón de código inválido mientras se escribe se muestra tal cual en el lienzo (no rompe la vista) y bloquea la generación; el caso de uso también lo rechaza (`code-pattern-invalid`).
- La estimación del PDF único usa el incremento entre muestras de 10 y 20 páginas. Con 1 y 5 páginas sobreestimaba ×2, porque el recorte de la fuente crece al principio.
- Las zonas de arrastre usan listeners nativos de `dragover`/`drop`; el control accesible sigue siendo el `<input type="file">`.
- Pasos completados: se marcan al avanzar más allá de ellos (o al generar, en el último).

**Pruebas que pasan**

- 36 tests de componentes en 6 archivos (`tests/ui/`):
  - `App`: navegación bloqueada hasta tener plantilla y lista, restauración de la configuración y tema.
  - `TemplateStep`: carga, datos, páginas extra, 3 errores en español, optimización con aviso de transparencia.
  - `ParticipantsStep`: contadores, paginación, búsqueda sin tildes, filtro de repetidos, edición rápida y validación, selector de columna y encabezado, formato no soportado y lista vacía.
  - `DesignStep`: geometría con snap y redimensionado, cambio de participante, teclado, panel de propiedades, código correlativo con validación del patrón, "Ver los más largos", desborde en rojo, vista previa real y fuente propia.
  - `GenerateStep`: estimación por modo, progreso "4/10 · quedan ~3 s", descargas, cancelar y regenerar, errores, aviso de desborde, ZIP enorme.
  - `ConfigMenu`: exportar (sin datos personales) e importar con aviso de fuente faltante.
- Recorrido manual con Playwright contra `vite preview`: flujo completo y 360 certificados en ambos modos en el navegador en unos 6,8 s, sin mensajes en la consola.
- `npm run check` ✅ (339 tests).

**Pendientes**

- Ninguno de la fase. Los E2E formales, axe y Lighthouse corresponden a la Fase 5.

---

## Fase 5 — E2E y pulido ✅

**Qué se hizo**

26 pruebas de Playwright (Chromium) contra el **build de producción** (`npm run build && npm run preview`), con los fixtures. El fixture automático `consoleGuard` hace fallar cualquier prueba ante un error o warning de consola, un `Warning:` de pdf.js o un error de página. Las descargas se validan desde Node con JSZip, pdf-lib y pdf.js.

| Archivo             | Qué cubre                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `full-flow.spec.ts` | **Plantilla PDF + TXT de 360**: arrastrar la caja con el mouse y soltarla junto al centro, donde se ajusta sola (snap a 50 %); ZIP + PDF único; **360 PDF + `reporte.csv`, 360 páginas**; texto exacto del primero, el último, el más largo y uno con ñ en ambos archivos; tiempo < 60 s; tareas largas del hilo principal < 200 ms.                                                                               |
| `formats.spec.ts`   | **PNG + XLSX eligiendo la columna "Nombre"** (cambia a "Correo" y vuelve); **plantillas verticales en PDF, PNG y JPG** (360 páginas, página vertical, nombre más largo correcto); **CSV Windows-1252**: los 360 nombres de `reporte.csv` son idénticos a la lista, con sus tildes, y el texto del PDF con ñ es correcto; JPG + DOCX con la "Vista previa real" (pdf.js en el navegador); CSV UTF-8 en ambos modos. |
| `config.spec.ts`    | **Importar una configuración JSON y generar sin tocar el diseño**: se ven la posición, la fuente, MAYÚSCULAS y el código `CERT-2026-002` en la página 2. Exportar → importar en una sesión nueva. Restaurar desde localStorage tras recargar.                                                                                                                                                                      |
| `cancel.spec.ts`    | **Cancelar a mitad** (progreso > 0/360), sin descargas, y **volver a generar** hasta las 360 páginas.                                                                                                                                                                                                                                                                                                              |
| `errors.spec.ts`    | **Errores esperados**: formato no soportado (GIF), **PDF dañado**, PDF protegido, **lista vacía**, lista JSON. "Continuar" queda bloqueado; un archivo válido corrige el error.                                                                                                                                                                                                                                    |
| `design.spec.ts`    | Desbordes marcados en rojo antes de generar, "Ver los más largos", aviso en el paso 4 y `sí (Nombre)` en `reporte.csv`. El diseño por defecto hace entrar a los 360 nombres. PNG pesado → JPG; PNG transparente → aviso y "Optimizar igual". Agregar un código correlativo.                                                                                                                                        |
| `a11y.spec.ts`      | **axe-core (WCAG 2.0/2.1 A y AA) en los 4 pasos** (plantilla vacía y cargada, participantes, diseño, generar, terminado), **en tema claro y oscuro**: 0 violaciones. Flujo completo solo con teclado (mover y redimensionar la caja).                                                                                                                                                                              |
| `smoke.spec.ts`     | Carga en español sin errores de consola.                                                                                                                                                                                                                                                                                                                                                                           |

**Lighthouse** (`docs/verification/lighthouse/`, Lighthouse 13.5 contra `vite preview`)

| Perfil     | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
| ---------- | ----------- | ------------- | ---------------- | --- |
| Escritorio | 100         | 100           | 100              | 100 |
| Móvil      | 98          | 100           | 100              | 100 |

- Escritorio: FCP 0,4 s · LCP 0,4 s · TBT 0 ms · CLS 0. Móvil (simulado): FCP 1,8 s · LCP 2,0 s · TBT 0 ms · CLS 0.
- Correcciones evidentes: `robots.txt` (el SEO pasó de 91 a 100) y `llms.txt`.

**Métricas en el navegador** (`docs/verification/metrics-e2e.json`)

- 360 certificados, modo "ambos", plantilla PDF: **8,1 s** desde el clic hasta el resumen; ZIP de 6,8 MB y PDF único de 139 KB; **0 tareas largas** (> 50 ms) en el hilo principal durante la generación.
- 360 en PDF único con plantilla PNG: 2,4 s.

**Decisiones**

- Playwright corre con 1 worker, para que los tiempos y la detección de tareas largas no dependan de pruebas en paralelo.
- No se agregó `ai-catalog.json` (la auditoría experimental "agentic browsing" de Lighthouse): es una especificación ajena al proyecto, y el servidor de preview devuelve `index.html` para rutas inexistentes.
- "Reduce unused JavaScript" (58 KiB del bundle principal) queda como mejora opcional (pasos con carga diferida): el rendimiento ya es 100/98.

**Pruebas que pasan**

- `npm run check` ✅ (339 tests) y `npm run test:e2e` ✅ (26 tests, unos 2 min).

**Pendientes**

- Ninguno de la fase.

---

## Fase 6 — Entrega ✅

**Qué se hizo**

- `README.md` en español, con:
  - qué hace y el uso paso a paso;
  - cómo reutilizar el diseño en otro evento;
  - recomendaciones de plantilla (exportar desde Canva como PDF estándar y dejar vacío el espacio del nombre; peso de la plantilla en el ZIP frente al PDF único);
  - formatos aceptados;
  - fuentes (incluidas, subir una propia, agregar una al proyecto);
  - scripts de desarrollo, arquitectura, despliegue en Vercel (panel y CLI) y compatibilidad.
- Capturas en `docs/screenshots/` (claro, oscuro y tablet), con `npm run screenshots`.
- `vercel.json`:
  - Framework Vite, `npm ci`, `npm run build` y salida en `dist`.
  - Cabeceras de seguridad: CSP estricta (`default-src 'self'`; `wasm-unsafe-eval` para los decodificadores de pdf.js), `nosniff`, `no-referrer`, `Permissions-Policy` y COOP.
  - Caché inmutable para `/assets` y de 7 días para `/fonts` y `/pdfjs`.
- `deploy/headers.ts`: las mismas cabeceras se aplican en `vite preview`, así los **27 E2E corren bajo la CSP de producción**. `tests/integration/deploy.test.ts` comprueba que `vercel.json` declare exactamente lo mismo, y el test de humo verifica la cabecera en la respuesta.
- **Prueba de volumen de 1000 participantes**:
  - nuevo fixture `participantes-1000.txt`;
  - `tests/integration/volume.test.ts` (Node): 1000 PDFs en el ZIP y 1000 páginas, en 15,6 s;
  - `tests/e2e/volume.spec.ts` (navegador): 14–20 s y 0 tareas largas.
- **Modo desarrollo**: `optimizeDeps.include` evita que Vite reoptimice pdf.js, pdf-lib y los parsers a mitad de la sesión (antes el primer uso daba "504 Outdated Optimize Dep"). Probado con el flujo completo en `npm run dev`: sin mensajes en consola.
- **Build de producción probado**: `npm run build` y `npm run preview` (el `webServer` de Playwright) recorriendo el flujo completo en los E2E, más un recorrido manual en modo desarrollo.

**Decisiones**

- No se despliega: no hay remoto ni cuenta configurados, y publicar es una acción hacia afuera. El proyecto queda listo para importarlo en Vercel.
- La CSP no permite `unsafe-inline` ni `unsafe-eval`. React aplica los estilos dinámicos por CSSOM, que la CSP no bloquea; se verificó con los E2E.
- La estimación del PDF único es conservadora: en el ejemplo de 360, ≈ 184 KB estimados frente a 136 KB reales. La del ZIP es precisa: ≈ 6,4 MB frente a 6,6 MB.

**Pruebas que pasan**

- `npm run check` ✅: lint, typecheck, **341 tests** en 34 archivos y build.
- `npm run test:e2e` ✅: **27 tests** en unos 2,2 min, con consola limpia y la CSP de producción.

---

## Definición de terminado — evidencia

| Criterio                                                                                                | Estado | Evidencia                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` y `npm run test:e2e` pasan sin errores                                                  | ✅     | 341 tests unitarios, de integración y de componentes + lint + typecheck + build; 27 E2E. Ninguna regla desactivada, ningún `skip`, ningún umbral bajado. Cobertura de `src/domain`: 99,37 % sentencias, 95,63 % ramas, 100 % funciones, 100 % líneas.                                                                       |
| Los 360 certificados se generan en menos de 60 s sin congelar la interfaz                               | ✅     | Navegador (E2E `full-flow`): **5,5–8,1 s** en modo "ambos" según la ejecución, **0 tareas largas** en el hilo principal (el test exige < 200 ms). Node: 5,7 s. Con 1000: 14–20 s en el navegador.                                                                                                                           |
| El PDF único pesa como máximo la plantilla + 10 MB                                                      | ✅     | `generation.test.ts`, en 11 variantes de plantilla. Ejemplos: plantilla PDF de 11,6 KB → 139 KB; PNG de 128,5 KB → 233 KB; JPG de 161,6 KB → 288 KB; PNG pesado de 7,09 MB → 6,83 MB (menos que la plantilla).                                                                                                              |
| Cada PDF individual pesa como máximo la plantilla + 150 KB                                              | ✅     | `generation.test.ts`, en las 11 variantes (máximo medido por variante). Ejemplos: PDF 11,6 KB → 19 KB; PNG 128,5 KB → 114 KB; JPG 161,6 KB → 169 KB; PNG pesado 7,09 MB → 6,72 MB.                                                                                                                                          |
| Tildes, ñ, ü, apóstrofes y guiones se ven bien (imágenes de `docs/verification/`)                       | ✅     | `1-mas-largo`, `2-con-enie`, `3-con-apostrofe`, `4-normal`, `5-vertical-mas-largo` y `6-caligrafica-guion` (página completa y recorte ampliado), revisadas una por una. Además, texto extraído idéntico en los tests y equivalencia píxel a píxel entre fuente recortada y completa en las 5 fuentes.                       |
| Ningún nombre del fixture se sale de su caja; los que no entran ni al mínimo se avisan antes de generar | ✅     | `generation.test.ts`: los 5 nombres de más de 45 caracteres quedan dentro de la caja y `reporte.csv` no marca desbordes en las 11 variantes. E2E `design`: "Todos los textos entran…" (360 revisados), y con una caja angosta se ven el aviso rojo, el campo marcado, el aviso del paso 4 y `sí (Nombre)` en `reporte.csv`. |
| Funciona con plantillas PDF, PNG y JPG, horizontales y verticales                                       | ✅     | E2E: PDF horizontal (`full-flow`), PNG horizontal (`formats` con XLSX, `cancel`), JPG horizontal (`formats` con DOCX), PDF/PNG/JPG verticales (`formats`). Integración: además rotada, recortada, EXIF, pesada y transparente.                                                                                              |
| Funciona con listas TXT, CSV (UTF-8 y Windows-1252), XLSX y DOCX                                        | ✅     | Integración: los 5 fixtures dan exactamente los 360 nombres de `expected.json`. E2E: TXT (`full-flow`), CSV UTF-8, CSV Windows-1252 (los 360 nombres de `reporte.csv` coinciden con tildes), XLSX eligiendo "Nombre" y DOCX.                                                                                                |
| Exportar e importar configuración funciona                                                              | ✅     | E2E `config`: importar JSON y generar sin tocar el diseño (posición, MAYÚSCULAS y `CERT-2026-002` verificados en el PDF); exportar → importar en otra sesión; restaurar desde localStorage. Tests de componentes y de dominio de la validación.                                                                             |
| Build de producción probado con el flujo completo                                                       | ✅     | Los 27 E2E corren contra `npm run build && npm run preview`, con las cabeceras de producción. Lighthouse sobre el build: escritorio 100/100/100/100 y móvil 98/100/100/100.                                                                                                                                                 |
| `README.md` completo y `PROGRESS.md` con el registro de todas las fases y sus métricas                  | ✅     | Este archivo (Fases 0–6) y `README.md`. Métricas en `docs/verification/metrics-node.json` y `docs/verification/metrics-e2e.json`.                                                                                                                                                                                           |
