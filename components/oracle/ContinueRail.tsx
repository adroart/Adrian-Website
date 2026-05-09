import React from 'react';

/**
 * End-of-panel continuation rail, styled as a button card.
 *
 * Visual language matches the museum-plate cards used inside each panel:
 * - Rounded container with hairline border
 * - Top bronze accent line (becomes brighter on hover)
 * - Centered serif title with letterspaced eyebrow above
 * - Optional subtitle (keywords) beneath a short hairline rule
 *
 * The whole card is the click target. Hover/focus brightens the bronze
 * accent and lifts the title color.
 */
export const ContinueRail: React.FC<{
  variant: 'dark' | 'light';
  eyebrow: string;        // small caps, e.g. "Next" or "Next card"
  title: string;          // serif large, e.g. "Gene Keys" or the next card's name
  subtitle?: string;      // optional, e.g. "Shadow · Gift · Siddhi"
  onClick: () => void;
  ariaLabel?: string;
}> = ({ variant, eyebrow, title, subtitle, onClick, ariaLabel }) => {
  const isDark = variant === 'dark';

  // Tokens. Note: this site's color tokens auto-invert in dark mode via CSS
  // variables (src/index.css), so we never use `dark:` overrides here.
  const borderCls       = isDark ? 'border-stone-700/60'   : 'border-wood-200/70';
  const borderHoverCls  = isDark ? 'hover:border-bronze-400/60' : 'hover:border-bronze-500/60';
  const eyebrowCls      = isDark ? 'text-bronze-400/85'    : 'text-bronze-700/85';
  const titleCls        = isDark ? 'text-stone-100'        : 'text-wood-900';
  const titleHoverCls   = isDark ? 'group-hover:text-bronze-300' : 'group-hover:text-bronze-700';
  const subtitleCls     = isDark ? 'text-stone-400'        : 'text-wood-600';
  const ruleCls         = isDark ? 'bg-stone-700/70'       : 'bg-wood-300/60';
  const accentCls       = 'bg-bronze-500 group-hover:bg-bronze-400';
  const shadowHoverCls  = isDark
    ? 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.55),0_1px_0_rgba(255,255,255,0.04)]'
    : 'hover:shadow-[0_8px_28px_rgba(60,44,22,0.12),0_1px_3px_rgba(60,44,22,0.05)]';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `${eyebrow} — ${title}`}
      className={`group block w-full mt-12 sm:mt-14 rounded-xl border ${borderCls} ${borderHoverCls} overflow-hidden motion-safe:transition-all motion-safe:duration-200 ${shadowHoverCls} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze-500/50`}
    >
      {/* Top bronze accent — brightens on hover */}
      <div className={`h-[2px] w-full ${accentCls} motion-safe:transition-colors`} aria-hidden="true" />

      <div className="px-6 py-8 sm:py-10 text-center">
        <p className={`font-label text-[10px] uppercase tracking-[0.32em] ${eyebrowCls}`}>{eyebrow}</p>

        <h3 className={`font-serif text-[26px] sm:text-[30px] leading-[1.15] tracking-[-0.005em] mt-3 ${titleCls} ${titleHoverCls} motion-safe:transition-colors`}>
          {title}
        </h3>

        {subtitle && (
          <>
            <div className={`h-px w-12 ${ruleCls} mx-auto my-4`} aria-hidden="true" />
            <p className={`font-serif text-[15px] sm:text-[16px] leading-[1.55] ${subtitleCls}`}>{subtitle}</p>
          </>
        )}
      </div>
    </button>
  );
};

export default ContinueRail;
