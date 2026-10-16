import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';

export function FieldLabel({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

const INPUT =
  'h-9 w-full rounded-md border border-line-strong bg-surface px-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition placeholder:text-subtle hover:border-muted focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20';

export function TextInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <FieldLabel label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        className={`${INPUT} ${invalid ? 'border-danger' : ''}`}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </FieldLabel>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const id = useId();
  return (
    <FieldLabel label={label} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={`${INPUT} tabular-nums ${suffix ? 'pr-9' : ''}`}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : ''}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = Number.parseFloat(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
          }}
        />
        {suffix ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle"
          >
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldLabel>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  hint,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  hint?: ReactNode;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'>) {
  const id = useId();
  return (
    <FieldLabel label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        className={`${INPUT} cursor-pointer pr-8`}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <p id={id} className="text-xs font-semibold text-muted">
        {label}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="flex rounded-lg border border-line-strong bg-surface-2 p-0.5"
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={option.icon ? option.label : undefined}
              title={option.label}
              onClick={() => {
                onChange(option.value);
              }}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition duration-200 ${
                checked ? 'bg-surface text-ink shadow-soft' : 'text-muted hover:text-ink'
              }`}
            >
              {option.icon ?? option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <FieldLabel label={label} htmlFor={id}>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className="h-9 w-12 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
        />
        <span className="font-mono text-xs text-muted uppercase">{value}</span>
      </div>
    </FieldLabel>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="size-4 cursor-pointer accent-accent"
      />
      <label htmlFor={id} className="cursor-pointer text-sm text-ink">
        {label}
      </label>
    </div>
  );
}
