export function ProgressBar({ value, label }: { value: number; label: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="relative h-3 overflow-hidden rounded-full bg-surface-3"
    >
      <div
        className="progress-fill h-full rounded-full bg-accent transition-[width] duration-300 ease-out-soft"
        style={{ width: `${String(percent)}%` }}
      />
    </div>
  );
}
