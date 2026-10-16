import { FileDown, FileUp } from 'lucide-react';
import { useId } from 'react';
import { serializeConfig } from '../../domain/config';
import { downloadText } from '../files';
import { useApplyConfig, useCurrentConfig } from '../hooks/use-config';
import { errorMessage } from '../messages';
import { useAppStore } from '../store/app-store';
import { Button } from './Button';

export const CONFIG_FILE_NAME = 'configuracion-certificados.json';

/** Export / import of the reusable configuration (fields, positions, fonts). */
export function ConfigMenu() {
  const currentConfig = useCurrentConfig();
  const applyConfig = useApplyConfig();
  const setNotice = useAppStore((state) => state.setNotice);
  const inputId = useId();

  async function importFile(file: File) {
    try {
      const warnings = applyConfig(await file.text());
      setNotice(
        warnings.length > 0
          ? { kind: 'warning', text: `Configuración importada. ${warnings.join(' ')}` }
          : {
              kind: 'success',
              text: 'Configuración importada: campos, posiciones y fuentes listos.',
            },
      );
    } catch (error) {
      setNotice({ kind: 'warning', text: errorMessage(error) });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        icon={<FileDown aria-hidden className="size-4" />}
        title="Guardar campos, posiciones y fuentes para reutilizarlos en otro evento"
        onClick={() => {
          downloadText(serializeConfig(currentConfig()), CONFIG_FILE_NAME, 'application/json');
          setNotice({ kind: 'success', text: 'Configuración exportada.' });
        }}
      >
        <span className="hidden lg:inline">Exportar</span>
        <span className="sr-only lg:hidden">Exportar configuración</span>
      </Button>
      <label
        htmlFor={inputId}
        title="Cargar una configuración guardada (.json)"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted transition hover:bg-surface-2 hover:text-ink focus-within:ring-3 focus-within:ring-accent/25"
      >
        <FileUp aria-hidden className="size-4" />
        <span className="hidden lg:inline">Importar</span>
        <span className="sr-only lg:hidden">Importar configuración</span>
        <input
          id={inputId}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}
