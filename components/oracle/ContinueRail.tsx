import React from 'react';

/**
 * End-of-panel continuation rail. Invites the reader to flow into the next
 * system, or, on the last system, into the next card.
 *
 * Visual: a hairline divider then a serif label + chevron. Hover/focus
 * deepens the bronze. No pills, no rounded backgrounds — letterforms only.
 */
export const ContinueRail: React.FC<{
  variant: 'dark' | 'light';
  label: string;          // small-caps section above the heading, e.g. "NEXT — GENE KEYS"
  heading: string;        // serif heading, e.g. "Dislocation · Orientation · Unity"
  onClick: () => void;
  ariaLabel?: string;
}> = ({ variant, label, heading, onClick, ariaLabel }) => {
  const isDark = variant === 'dark';
  const ruleCls = isDark ? 'border-stone-700/60' : 'border-wood-200/50';
  const labelCls = isDark ? 'text-stone-500' : 'text-wood-500';
  const labelHoverCls = isDark ? 'group-hover:text-bronze-400' : 'group-hover:text-bronze-600';
  const headingCls = isDark ? 'text-stone-100 group-hover:text-bronze-300' : 'text-wood-900 group-hover:text-bronze-700';
  const chevronCls = isDark ? 'text-bronze-400/80 group-hover:text-bronze-300' : 'text-bronze-500/80 group-hover:text-bronze-700';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${label} — ${heading}`}
      className={`group block w-full text-left border-t ${ruleCls} -mx-4 sm:-mx-7 px-4 sm:px-7 pt-7 sm:pt-9 pb-4 mt-12 sm:mt-14 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/40`}
    >
      <p className={`font-label text-[10px] uppercase tracking-[0.28em] ${labelCls} ${labelHoverCls} transition-colors`}>{label}</p>
      <div className="mt-2 flex items-baseline justify-between gap-4">
        <span className={`font-serif text-[20px] sm:text-[22px] leading-[1.25] tracking-[-0.005em] ${headingCls} transition-colors`}>{heading}</span>
        <span className={`font-serif text-[22px] leading-none ${chevronCls} transition-colors`} aria-hidden="true">→</span>
      </div>
    </button>
  );
};

export default ContinueRail;
