/** Small decorative illustrations for empty states (aria-hidden). */

export function CertificateIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className} fill="none">
      <rect x="34" y="22" width="104" height="74" rx="6" className="fill-surface-3" />
      <rect
        x="22"
        y="14"
        width="104"
        height="74"
        rx="6"
        className="fill-surface stroke-line-strong"
        strokeWidth="1.5"
      />
      <rect
        x="29"
        y="21"
        width="90"
        height="60"
        rx="3"
        className="stroke-gold"
        strokeWidth="1.2"
        strokeDasharray="0"
      />
      <rect x="52" y="30" width="44" height="6" rx="3" className="fill-accent/80" />
      <rect
        x="44"
        y="44"
        width="60"
        height="9"
        rx="2"
        className="fill-accent-soft stroke-accent"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      <rect x="58" y="60" width="32" height="3" rx="1.5" className="fill-line-strong" />
      <circle cx="74" cy="72" r="5" className="fill-gold-soft stroke-gold" strokeWidth="1.2" />
      <circle cx="126" cy="84" r="15" className="fill-accent" />
      <path
        d="M126 77v14m-7-7 7-7 7 7"
        className="stroke-accent-ink"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ListIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" aria-hidden className={className} fill="none">
      <rect
        x="30"
        y="16"
        width="92"
        height="88"
        rx="8"
        className="fill-surface stroke-line-strong"
        strokeWidth="1.5"
      />
      {[0, 1, 2, 3, 4].map((row) => (
        <g key={row}>
          <circle
            cx="46"
            cy={34 + row * 15}
            r="4"
            className={row === 1 ? 'fill-gold' : 'fill-accent-soft'}
          />
          <rect
            x="56"
            y={31 + row * 15}
            width={row % 2 ? 40 : 52}
            height="6"
            rx="3"
            className="fill-surface-3"
          />
        </g>
      ))}
      <circle cx="122" cy="88" r="15" className="fill-accent" />
      <path
        d="M122 81v14m-7-7 7-7 7 7"
        className="stroke-accent-ink"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={className} fill="none">
      <circle cx="60" cy="60" r="44" className="fill-success-soft" />
      <path
        d="M40 61l13 13 27-29"
        className="stroke-success"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M96 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-gold" />
      <path d="M22 86l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" className="fill-gold" />
    </svg>
  );
}
