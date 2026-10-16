import { isAppError, type AppErrorCode } from '../domain/errors';

/** User-facing Spanish message for every expected failure. */
export const ERROR_MESSAGES: Readonly<Record<AppErrorCode, string>> = {
  'template-unsupported':
    'Ese archivo no es una plantilla válida. Sube un PDF, PNG o JPG con el diseño del certificado.',
  'template-pdf-encrypted':
    'El PDF está protegido con contraseña o tiene restricciones. Expórtalo de nuevo sin protección (en Canva: Compartir → Descargar → PDF estándar).',
  'template-pdf-damaged':
    'No se pudo leer el PDF: parece estar dañado o incompleto. Vuelve a exportarlo e inténtalo otra vez.',
  'template-pdf-empty': 'El PDF no tiene páginas.',
  'template-image-damaged':
    'No se pudo leer la imagen: parece estar dañada o incompleta. Prueba exportarla otra vez.',
  'list-unsupported':
    'Formato de lista no soportado. Usa un archivo .txt, .csv, .xlsx o .docx con un nombre por línea o fila.',
  'list-empty':
    'La lista no tiene ningún nombre. Revisa que el archivo tenga un participante por línea o fila.',
  'list-damaged': 'No se pudo leer la lista: el archivo parece dañado.',
  'list-no-columns': 'No se encontraron columnas en la hoja de cálculo.',
  'font-invalid': 'No se pudo leer la fuente. Sube un archivo TTF u OTF válido.',
  'font-unsupported': 'Solo se aceptan fuentes TTF u OTF.',
  'config-invalid': 'El archivo no es una configuración válida de Certifica.',
  'config-version': 'Esta configuración es de otra versión de Certifica y no se puede importar.',
  'code-pattern-invalid':
    'El patrón del código no es válido. Debe incluir {n}, por ejemplo CERT-2026-{n:000}.',
  'generation-failed': 'Ocurrió un error al generar los certificados. Inténtalo de nuevo.',
  'generation-cancelled': 'Generación cancelada.',
  'worker-unavailable':
    'El motor de generación no respondió. Recarga la página e inténtalo de nuevo.',
  'storage-unavailable': 'El navegador no permite guardar la configuración.',
};

export function errorMessage(error: unknown): string {
  if (isAppError(error)) return ERROR_MESSAGES[error.code];
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
