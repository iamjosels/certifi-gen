# Proyecto: Generador masivo de certificados

## Rol y forma de trabajo

Actúa como desarrollador senior frontend. Vas a construir este proyecto completo, por fases y de forma autónoma.

Reglas que debes seguir durante todo el proyecto:

1. Antes de escribir código, crea `PLAN.md` con la arquitectura, la estructura de carpetas y cada fase con sus criterios de salida. No esperes mi aprobación: continúa con la Fase 0.
2. Mantén `PROGRESS.md` actualizado al cerrar cada fase: qué se hizo, decisiones tomadas, pruebas que pasan, métricas y pendientes. Si la sesión se interrumpe, retoma exactamente desde ahí.
3. Una fase solo se cierra cuando pasan `lint`, `typecheck`, tests unitarios, tests de la fase y `build`, sin errores. Si algo falla, corrígelo antes de avanzar. Nunca desactives reglas, marques tests como `skip` ni bajes umbrales para que algo pase.
4. No me hagas preguntas entre fases. Si una decisión es ambigua, elige la opción más razonable, regístrala en `PROGRESS.md` y sigue. Detente solo si algo es imposible sin un dato mío.
5. Haz un commit al cerrar cada fase (conventional commits, en inglés).
6. No declares el proyecto terminado hasta cumplir toda la sección "Definición de terminado" al final de este documento, y muéstrame la evidencia.

## Qué hace la app

Una web que corre 100% en el navegador. Ningún archivo se sube a un servidor.

1. El usuario sube la plantilla del certificado sin nombres (PDF, PNG o JPG).
2. Sube la lista de participantes (.txt, .csv, .xlsx o .docx).
3. Ubica visualmente dónde va el nombre (y otros campos opcionales) y elige fuente, tamaño y color.
4. Revisa una vista previa y genera: un ZIP con un PDF por participante, un solo PDF con todos, o ambos.

Volumen objetivo: 360 participantes es el caso normal. Debe soportar al menos 1000.

## Stack

- Vite + React + TypeScript (modo strict) + Tailwind CSS
- `pdf-lib` + `@pdf-lib/fontkit` para generar PDFs con fuentes TTF/OTF (tildes, ñ, ü)
- `pdfjs-dist` para renderizar plantillas PDF en la vista previa (configura bien `GlobalWorkerOptions.workerSrc` con Vite)
- `JSZip` para el empaquetado
- `PapaParse` para CSV
- SheetJS para Excel. Instálalo según la forma recomendada en su documentación oficial, porque el paquete `xlsx` del registro npm está desactualizado.
- `mammoth` para extraer texto de .docx
- Vitest + Testing Library para unitarios e integración
- Playwright para E2E
- ESLint + Prettier

Interfaz en español. Código, nombres de variables y commits en inglés.

## Arquitectura

Separación por capas al estilo hexagonal, para poder cambiar librerías o agregar funciones sin reescribir:

```
src/
  domain/              Tipos y reglas puras. Sin React ni librerías de PDF.
    participant.ts       Participant, normalización de nombres, detección de duplicados
    field.ts             FieldConfig: posición relativa, fuente, tamaños, color, alineación, origen de datos
    template.ts          TemplateInfo: tipo, tamaño de página en puntos, orientación
    text-fit.ts          Algoritmo de ajuste de tamaño de fuente
    filename.ts          Sanitización de nombres de archivo
    code-pattern.ts      Códigos correlativos por patrón
  application/         Casos de uso. Dependen solo de domain y de interfaces.
    ports.ts             ParticipantParser, TemplateLoader, CertificateRenderer, FontProvider, Archiver
    parse-participants.ts
    build-preview.ts
    generate-certificates.ts
  infrastructure/      Adaptadores que implementan los puertos
    parsers/             txt, csv, xlsx, docx (uno por archivo)
    pdf/                 renderer con pdf-lib, carga de plantillas, vista previa con pdfjs
    fonts/               fuentes incluidas y fuentes subidas por el usuario
    archive/             ZIP con JSZip
  workers/
    generate.worker.ts   Generación fuera del hilo principal
  ui/
    components/  steps/  hooks/  store/
```

Reglas de dependencia: `domain` no importa nada de `application`, `infrastructure` ni `ui`. Los casos de uso reciben los adaptadores por parámetro. Ningún componente React llama directamente a pdf-lib, pdfjs ni JSZip.

## Modelo de campos

Diseña desde el inicio para N campos de texto, no solo el nombre. Cada campo tiene:

- `source`: una columna de la lista, un código correlativo con patrón (por ejemplo `CERT-2026-{n:000}`), o texto fijo
- Posición en coordenadas relativas (0 a 1) respecto al ancho y alto de la página, para no depender de la resolución
- Fuente, tamaño máximo, tamaño mínimo, color, alineación (izquierda, centro, derecha), ancho máximo y transformación (ninguna, Título, MAYÚSCULAS)

El campo "Nombre" viene creado por defecto. El usuario puede agregar otros (código, curso, fecha).

---

## Fases

### Fase 0: Setup

- Proyecto Vite + React + TS strict con Tailwind, ESLint, Prettier, Vitest y Playwright.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e` y `check` (corre lint, typecheck, test y build).
- Estructura de carpetas según la arquitectura.
- Fixtures de prueba generados por script (`scripts/generate-fixtures.ts`), no a mano:
  - Plantilla PDF horizontal A4 con marco y título, y la misma plantilla en PNG y JPG
  - Plantilla PDF vertical
  - Plantilla PNG pesada (más de 3 MB) para probar la optimización
  - `participantes-360.txt` con 360 nombres que incluyan tildes, ñ, ü, apóstrofes (O'Connor), guiones (María-José), nombres muy largos (más de 45 caracteres), duplicados exactos, líneas vacías, espacios dobles y mayúsculas mezcladas
  - La misma lista en CSV UTF-8, CSV Windows-1252 (como exporta Excel en Windows), XLSX con columnas Nombre, Correo y Curso, y DOCX

**Salida:** `npm run check` pasa con un test de humo.

### Fase 1: Dominio

- Normalización: trim, colapsar espacios, quitar BOM y caracteres invisibles, descartar líneas vacías.
- Transformación a Título respetando partículas en minúscula (de, del, la, las, los, y, e, da, van, von) salvo al inicio, y conservando correctamente O'Connor y María-José.
- Detección de duplicados comparando sin tildes ni mayúsculas. Se marcan, no se eliminan.
- `fitText`: recibe el texto, una función de medida, ancho máximo, tamaño máximo y mínimo. Devuelve el tamaño que entra o un flag de desborde si ni el mínimo entra.
- Conversión de coordenadas relativas a puntos PDF. En PDF el origen está abajo a la izquierda y en el canvas arriba a la izquierda: pruébalo explícitamente con casos de borde.
- Sanitización de nombres de archivo: `001_Maria_Jose_Lopez.pdf` (índice con ceros a la izquierda, sin tildes, sin caracteres inválidos en Windows o macOS, longitud máxima razonable). El índice garantiza nombres únicos aunque haya duplicados. Las tildes se quitan solo del nombre del archivo, nunca del certificado.
- Generador de códigos correlativos según patrón.

**Salida:** cobertura de tests de `domain` mayor a 90%.

### Fase 2: Lectura de participantes

- Un parser por formato detrás del puerto `ParticipantParser`.
- Detección de codificación: intentar UTF-8 estricto (`TextDecoder` con `fatal: true`) y, si falla, Windows-1252.
- CSV y XLSX: detectar si la primera fila es encabezado, listar las columnas y permitir elegir cuál es el nombre. Autodetectar columnas llamadas nombre, nombres, participante, name o full name.
- DOCX: un nombre por párrafo.
- Resultado: lista de participantes más un reporte (total válido, vacías descartadas, duplicados, columnas disponibles).

**Salida:** tests de integración que leen cada fixture y obtienen exactamente los mismos 360 registros válidos, con tildes correctas en todos los formatos, incluido el CSV Windows-1252.

### Fase 3: Motor de generación

- Carga de plantilla:
  - PDF: usar la primera página y avisar si tiene más. Error claro si está protegido o dañado.
  - PNG o JPG: crear una página PDF con la proporción de la imagen.
  - Soportar orientación horizontal y vertical y cualquier tamaño de página.
- Optimización: si la imagen pesa más de 1 MB, ofrecer convertirla a JPG calidad 0.85 desde un canvas, advirtiendo si tiene transparencia.
- Fuentes: incluir 4 o 5 fuentes con licencia OFL de Google Fonts en `public/fonts` (una serif elegante, una sans moderna, una caligráfica y una sans condensada), todas con soporte completo de español. Permitir subir TTF u OTF propias. Usar fontkit con subset; si alguna fuente muestra glifos rotos con subset, desactivarlo solo para esa fuente.
- Modo PDF único: incrustar la plantilla UNA sola vez (`embedPage`, `embedPng` o `embedJpg`) y reutilizarla en cada página para que el archivo quede liviano.
- Modo ZIP: un PDF por participante.
- La generación corre en un Web Worker, reporta progreso por lotes y se puede cancelar. La interfaz nunca se congela.
- Incluir dentro del ZIP un `reporte.csv` con índice, nombre, archivo, código y si hubo desborde.

**Salida:**

- Test de integración que genera los 360 en ambos modos y verifica: 360 archivos en el ZIP, 360 páginas en el PDF único, y que el texto extraído de muestras (el primero, el último, el nombre más largo y uno con ñ) coincide exactamente con la lista.
- Renderiza a PNG la primera página de 4 certificados generados (el nombre más largo, uno con ñ, uno con apóstrofe y uno normal), usando `pdftoppm` si está disponible o `pdfjs-dist` con `@napi-rs/canvas`. Revisa esas imágenes tú mismo y confirma que el texto está en la posición correcta, alineado, sin cortarse y con tildes bien dibujadas. Guárdalas en `docs/verification/`.
- Mide el tiempo de generación de 360 y el peso del ZIP y del PDF único. Regístralo en `PROGRESS.md`.

### Fase 4: Interfaz

Asistente de 4 pasos con indicador de progreso superior: Plantilla, Participantes, Diseño y Generar.

Diseño moderno, visual y cuidado, que no parezca una plantilla genérica de Tailwind: jerarquía tipográfica clara, buen espaciado, estados vacíos con ícono o ilustración, zonas de arrastrar y soltar, microinteracciones sutiles y modo claro y oscuro. Escritorio primero, usable en tablet. Define los colores y espaciados como tokens para poder cambiar el estilo después sin tocar componentes.

- **Paso 1, Plantilla:** arrastrar o elegir archivo, miniatura, tamaño de página, peso y botón de optimizar cuando aplique.
- **Paso 2, Participantes:** subir lista, selector de columna si aplica, tabla con búsqueda y paginación, contador de válidos, avisos de duplicados y vacías, y edición rápida de un nombre.
- **Paso 3, Diseño:** lienzo con la plantilla y una caja arrastrable y redimensionable por campo (el ancho de la caja es el ancho máximo del texto). Panel lateral con fuente, tamaño máximo y mínimo, color, alineación y transformación. Guías de centrado con snap. Vista previa con selector de participante y un botón "Ver los más largos" que muestra los 3 nombres de mayor ancho medido. Los nombres que desbordan se marcan en rojo antes de generar.
- **Paso 4, Generar:** elegir ZIP, PDF único o ambos; estimación de peso antes de generar; barra de progreso con conteo (por ejemplo 123/360) y tiempo restante estimado; botón cancelar; descarga y resumen al terminar.
- Exportar e importar la configuración (campos, posiciones, fuentes) como JSON para reutilizarla en otro evento. Guardar la última configuración en localStorage dentro de try/catch, solo la configuración y nunca los archivos.
- Mensajes de error claros en español para cada fallo esperado.
- Accesibilidad: navegación por teclado, labels en todos los controles y contraste AA.

**Salida:** tests de componentes para los pasos clave y `npm run check` en verde.

### Fase 5: E2E y pulido

Pruebas con Playwright del flujo completo usando los fixtures:

- Plantilla PDF + lista TXT de 360: ubicar el campo, generar ZIP y PDF único, descargar y validar contenido (cantidad de archivos, páginas y texto de muestras).
- Plantilla PNG + lista XLSX eligiendo la columna Nombre.
- Plantilla vertical.
- CSV Windows-1252 con tildes correctas en el resultado.
- Importar una configuración JSON y generar sin tocar el diseño.
- Cancelar a mitad de la generación y volver a generar.
- Errores esperados: archivo no soportado, PDF dañado y lista vacía.

Revisa que la consola del navegador quede sin errores ni warnings. Pasa una auditoría de Lighthouse y corrige lo evidente.

### Fase 6: Entrega

- `README.md` en español: qué hace, uso paso a paso, formatos aceptados, recomendaciones de plantilla (exportar desde Canva como PDF y dejar vacío el espacio del nombre), cómo agregar fuentes, cómo correr el proyecto y cómo desplegarlo.
- Lista para desplegar en Vercel como sitio estático.
- Probar el build de producción con `npm run build` y `npm run preview` recorriendo el flujo completo.

---

## Fuera de alcance

No lo implementes ahora, pero la arquitectura debe permitir agregarlo después sin reescribir. Documenta en `PLAN.md` dónde se conectaría cada uno:

- Código QR de verificación por certificado
- Envío por correo a cada participante
- Backend o base de datos

## Definición de terminado

No termines hasta que todo esto sea cierto. Al final, dame un resumen con la evidencia de cada punto:

- [ ] `npm run check` y `npm run test:e2e` pasan sin errores
- [ ] Los 360 certificados se generan en menos de 60 segundos sin congelar la interfaz
- [ ] El PDF único pesa como máximo el peso de la plantilla más 10 MB (prueba de que la plantilla se incrusta una sola vez)
- [ ] Cada PDF individual pesa como máximo el peso de la plantilla más 150 KB
- [ ] Tildes, ñ, ü, apóstrofes y guiones se ven bien en los PDFs, verificado con las imágenes de `docs/verification/`
- [ ] Ningún nombre del fixture se sale de su caja, y los que no entran ni al tamaño mínimo se avisan antes de generar
- [ ] Funciona con plantillas PDF, PNG y JPG, horizontales y verticales
- [ ] Funciona con listas TXT, CSV (UTF-8 y Windows-1252), XLSX y DOCX
- [ ] Exportar e importar configuración funciona
- [ ] Build de producción probado con el flujo completo
- [ ] `README.md` completo y `PROGRESS.md` con el registro de todas las fases y sus métricas
