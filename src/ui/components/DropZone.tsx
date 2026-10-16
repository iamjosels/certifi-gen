import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface DropZoneProps {
  /** Accessible label of the hidden file input. */
  label: string;
  title: string;
  hint: ReactNode;
  accept: string;
  illustration: ReactNode;
  busy?: boolean;
  busyText?: string;
  compact?: boolean;
  onFile: (file: File) => void;
}

/** Drag-and-drop area that is also a keyboard-accessible file picker. */
export function DropZone({
  label,
  title,
  hint,
  accept,
  illustration,
  busy = false,
  busyText = 'Leyendo archivo…',
  compact = false,
  onFile,
}: DropZoneProps) {
  const inputId = useId();
  const zoneRef = useRef<HTMLLabelElement>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ busy, onFile });

  useEffect(() => {
    latest.current = { busy, onFile };
  });

  // Native listeners: the drop target is the label of the file input (the input stays the
  // accessible control; dropping is an extra for mouse users).
  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const over = (event: DragEvent) => {
      event.preventDefault();
      setDragging(true);
    };
    const leave = () => {
      setDragging(false);
    };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && !latest.current.busy) latest.current.onFile(file);
    };
    zone.addEventListener('dragover', over);
    zone.addEventListener('dragleave', leave);
    zone.addEventListener('drop', drop);
    return () => {
      zone.removeEventListener('dragover', over);
      zone.removeEventListener('dragleave', leave);
      zone.removeEventListener('drop', drop);
    };
  }, []);

  return (
    <label
      ref={zoneRef}
      htmlFor={inputId}
      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition duration-300 ease-out-soft focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 ${
        compact ? 'px-6 py-6' : 'px-6 py-12'
      } ${
        dragging
          ? 'scale-[1.01] border-accent bg-accent-soft'
          : 'border-line-strong bg-surface-2/60 hover:border-accent hover:bg-accent-soft/50'
      } ${busy ? 'pointer-events-none opacity-80' : ''}`}
    >
      <div
        className={`transition duration-300 ease-out-soft group-hover:-translate-y-1 ${compact ? 'w-20' : 'w-36'}`}
      >
        {illustration}
      </div>
      <div className="space-y-1">
        <p className="text-base font-semibold text-ink">{busy ? busyText : title}</p>
        <p className="text-sm text-muted">{hint}</p>
      </div>
      {busy ? (
        <Loader2 aria-hidden className="absolute top-4 right-4 size-5 animate-spin text-accent" />
      ) : null}
      <input
        id={inputId}
        type="file"
        accept={accept}
        aria-label={label}
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}
