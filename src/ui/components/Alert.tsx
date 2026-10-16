import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'danger';

const TONES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: {
    box: 'border-accent/25 bg-accent-soft text-accent-soft-ink',
    icon: <Info aria-hidden className="size-5 shrink-0" />,
  },
  success: {
    box: 'border-success/30 bg-success-soft text-success',
    icon: <CheckCircle2 aria-hidden className="size-5 shrink-0" />,
  },
  warning: {
    box: 'border-warning/30 bg-warning-soft text-warning',
    icon: <AlertTriangle aria-hidden className="size-5 shrink-0" />,
  },
  danger: {
    box: 'border-danger/30 bg-danger-soft text-danger',
    icon: <XCircle aria-hidden className="size-5 shrink-0" />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className = '',
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex animate-[fade-in_0.25s_ease-out] gap-3 rounded-lg border px-4 py-3 text-sm ${box} ${className}`}
    >
      {icon}
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-ink/85 dark:text-ink/90">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
