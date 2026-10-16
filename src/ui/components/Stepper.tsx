import { Check } from 'lucide-react';

export function Stepper({
  steps,
  current,
  reachable,
  completed,
  onSelect,
}: {
  steps: readonly string[];
  current: number;
  reachable: readonly boolean[];
  completed: readonly boolean[];
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Pasos" className="mx-auto w-max">
      <ol className="flex items-center gap-1 sm:gap-1.5">
        {steps.map((label, index) => {
          const isCurrent = index === current;
          const isDone = completed[index] === true && !isCurrent;
          const enabled = reachable[index] === true;
          return (
            <li key={label} className="flex items-center gap-1 sm:gap-2">
              {index > 0 ? (
                <span
                  aria-hidden
                  className={`h-px w-4 transition-colors sm:w-6 2xl:w-10 ${
                    reachable[index] ? 'bg-accent/60' : 'bg-line-strong'
                  }`}
                />
              ) : null}
              <button
                type="button"
                disabled={!enabled}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => {
                  onSelect(index);
                }}
                className={`group flex items-center gap-2 rounded-full p-1 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed xl:pr-3 ${
                  isCurrent
                    ? 'bg-accent-soft text-accent-soft-ink'
                    : enabled
                      ? 'text-ink hover:bg-surface-2'
                      : 'text-subtle'
                }`}
              >
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-xs transition duration-300 ${
                    isCurrent
                      ? 'bg-accent text-accent-ink shadow-soft'
                      : isDone
                        ? 'bg-success text-accent-ink'
                        : 'border border-line-strong bg-surface text-muted'
                  }`}
                >
                  {isDone ? <Check aria-hidden className="size-4" strokeWidth={3} /> : index + 1}
                </span>
                <span className="hidden xl:inline">{label}</span>
                <span className="sr-only xl:hidden">{label}</span>
                {isDone ? <span className="sr-only"> (completado)</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
