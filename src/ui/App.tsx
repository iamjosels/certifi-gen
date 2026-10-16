import { ArrowLeft, ArrowRight, Lock, X } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './components/Button';
import { ConfigMenu } from './components/ConfigMenu';
import { Stepper } from './components/Stepper';
import { ThemeToggle } from './components/ThemeToggle';
import { useConfigPersistence } from './hooks/use-config';
import { useMeasurementsSync } from './hooks/use-measurements';
import { reachableSteps, STEPS, useAppStore, type StepIndex } from './store/app-store';
import { DesignStep } from './steps/DesignStep';
import { GenerateStep } from './steps/GenerateStep';
import { ParticipantsStep } from './steps/ParticipantsStep';
import { TemplateStep } from './steps/TemplateStep';

const NEXT_HINT = [
  'Sube una plantilla para continuar',
  'Sube la lista de participantes para continuar',
  '',
  '',
];

function Notice() {
  const notice = useAppStore((state) => state.notice);
  const setNotice = useAppStore((state) => state.setNotice);

  useEffect(() => {
    if (!notice || notice.kind === 'warning') return;
    const timer = setTimeout(() => {
      setNotice(null);
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, [notice, setNotice]);

  const tone = {
    info: 'border-accent/30 bg-surface text-ink',
    success: 'border-success/40 bg-surface text-ink',
    warning: 'border-warning/40 bg-warning-soft text-ink',
  };
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      {notice ? (
        <div
          role="status"
          className={`pointer-events-auto flex max-w-xl animate-[toast-in_0.3s_ease-out] items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lift ${tone[notice.kind]}`}
        >
          <p className="flex-1">{notice.text}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => {
              setNotice(null);
            }}
            className="rounded p-0.5 text-muted hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" aria-hidden className="size-9 shrink-0">
        <rect width="64" height="64" rx="14" className="fill-accent" />
        <rect
          x="13"
          y="16"
          width="38"
          height="28"
          rx="3"
          fill="none"
          className="stroke-gold-soft"
          strokeWidth="3"
        />
        <path
          d="M22 27h20M26 33h12"
          className="stroke-accent-ink"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="44" cy="46" r="8" className="fill-gold-soft" />
      </svg>
      <div className="leading-tight">
        <p className="font-display text-xl text-ink">Certifica</p>
        <p className="hidden text-xs text-muted lg:block">Certificados masivos en PDF</p>
      </div>
    </div>
  );
}

export function App() {
  useConfigPersistence();
  useMeasurementsSync();
  const step = useAppStore((state) => state.step);
  const setStep = useAppStore((state) => state.setStep);
  const template = useAppStore((state) => state.template);
  const participants = useAppStore((state) => state.participants);
  const running = useAppStore((state) => state.generation.status === 'running');
  const generated = useAppStore((state) => state.generation.status === 'done');
  const reachable = reachableSteps({ template, participants }).map((ok) => ok && !running);
  // A step counts as completed once the user moved past it (or generated, for the last one).
  const completed = [step > 0, step > 1, step > 2, generated];
  const canGoNext = step < 3 && reachable[step + 1] === true;

  const go = (index: number) => {
    if (reachable[index]) {
      setStep(index as StepIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 md:grid-cols-[auto_1fr_auto]">
          <Brand />
          <div className="order-last col-span-2 min-w-0 overflow-x-auto md:order-none md:col-span-1">
            <Stepper
              steps={STEPS}
              current={step}
              reachable={reachable}
              completed={completed}
              onSelect={go}
            />
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <ConfigMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-7xl px-4 pt-8 pb-32 sm:px-6 lg:pt-10">
        <h1 className="sr-only">Generador masivo de certificados</h1>
        <div key={step} className="animate-[step-in_0.35s_cubic-bezier(0.22,1,0.36,1)]">
          {step === 0 ? <TemplateStep /> : null}
          {step === 1 ? <ParticipantsStep /> : null}
          {step === 2 ? <DesignStep /> : null}
          {step === 3 ? <GenerateStep /> : null}
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            icon={<ArrowLeft aria-hidden className="size-4" />}
            disabled={step === 0 || running}
            onClick={() => {
              go(step - 1);
            }}
          >
            Atrás
          </Button>
          <p className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
            <Lock aria-hidden className="size-3.5 text-success" />
            Tus archivos nunca salen de tu navegador
          </p>
          {step < 3 ? (
            <Button
              variant="primary"
              disabled={!canGoNext}
              title={canGoNext ? undefined : NEXT_HINT[step]}
              onClick={() => {
                go(step + 1);
              }}
            >
              Continuar
              <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : (
            <span className="w-24" />
          )}
        </div>
      </footer>
      <Notice />
    </div>
  );
}
