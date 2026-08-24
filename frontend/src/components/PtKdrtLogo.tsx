import React from 'react';

interface PtKdrtLogoProps {
  variant?: 'full' | 'horizontal' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
}

const LOGO_SRC = '/assets/logo-pt-kdrt.png';

const MARK_DIMENSION: Record<NonNullable<PtKdrtLogoProps['size']>, number> = {
  xs: 24,
  sm: 30,
  md: 38,
  lg: 48,
  xl: 64,
};

const WORDMARK_CLASS: Record<NonNullable<PtKdrtLogoProps['size']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
};

/**
 * Brand lockup. The emblem is always the real PNG asset supplied by the client
 * (never redrawn), paired with a chrome "PT.KDRT" wordmark for sidebar/header.
 */
export const PtKdrtLogo: React.FC<PtKdrtLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showSubtitle = true,
}) => {
  const dimension = MARK_DIMENSION[size];

  const Mark = (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-cyan-400/25 bg-[#050A14]"
      style={{ width: dimension, height: dimension }}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,229,255,0.28),transparent_70%)]" />
      <img
        src={LOGO_SRC}
        alt="PT KDRT"
        className="h-full w-full scale-[1.35] object-contain"
        loading="eager"
        decoding="async"
      />
    </span>
  );

  const Wordmark = (
    <span className="flex min-w-0 flex-col leading-none">
      <span
        className={`font-display font-extrabold tracking-[0.06em] text-transparent ${WORDMARK_CLASS[size]}`}
        style={{
          backgroundImage: 'linear-gradient(180deg,#FFFFFF 0%,#CFE9F5 45%,#6FD8EE 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          textShadow: '0 0 18px rgba(0,229,255,0.35)',
        }}
      >
        PT.KDRT
      </span>
      {showSubtitle && (
        <span className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.22em] text-cyan-300/60">
          Kantor Management
        </span>
      )}
    </span>
  );

  if (variant === 'icon') {
    return <span className={`inline-flex ${className}`}>{Mark}</span>;
  }

  if (variant === 'full') {
    return (
      <span className={`inline-flex flex-col items-center gap-3 ${className}`}>
        <img
          src={LOGO_SRC}
          alt="PT KDRT"
          className="w-full max-w-[280px] rounded-2xl object-contain"
          loading="eager"
        />
        {Wordmark}
      </span>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      {Mark}
      {Wordmark}
    </span>
  );
};
