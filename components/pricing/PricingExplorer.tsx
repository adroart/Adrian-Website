/**
 * Customer-facing Pricing Explorer — a quiet doorway, not a configurator.
 *
 * It answers one question: "What's possible for me here?" Three or four
 * gentle choices, a price range rather than a number, and two ways forward.
 * It shares the exact same engine and config as the internal calculator, so
 * the moment Adrian tunes a value, this moves with it.
 *
 * SEO note: this lives in the Multidimensional Art context. No "oracle"
 * framing, no "wall art" — these are multi-dimensional wooden sculptures.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerInputs } from '../../utils/pricing/types';
import { customerRange, formatMoney } from '../../utils/pricing/engine';
import { loadConfig } from '../../utils/pricing/config';
import { Segmented } from './controls';

const SIZE_OPTIONS_IMPERIAL = [
  { value: 'small' as const, label: 'Small · 6 to 12"' },
  { value: 'medium' as const, label: 'Medium · 12 to 24"' },
  { value: 'large' as const, label: 'Large · 24 to 36"' },
  { value: 'statement' as const, label: 'Statement · 36"+' },
];

const SIZE_OPTIONS_METRIC = [
  { value: 'small' as const, label: 'Small · 15 to 30 cm' },
  { value: 'medium' as const, label: 'Medium · 30 to 60 cm' },
  { value: 'large' as const, label: 'Large · 60 to 90 cm' },
  { value: 'statement' as const, label: 'Statement · 90 cm+' },
];

const PricingExplorer: React.FC = () => {
  // Read the tuned config if present; otherwise the shared defaults.
  const config = useMemo(() => loadConfig(), []);
  const [inputs, setInputs] = useState<CustomerInputs>({
    sizeCategory: 'medium',
    complexity: 'layered',
    finishId: config.finishes[1]?.id ?? config.finishes[0]?.id ?? 'painted',
    illumination: 'none',
  });

  const range = useMemo(() => customerRange(inputs, config), [inputs, config]);
  const set = <K extends keyof CustomerInputs>(key: K, value: CustomerInputs[K]) =>
    setInputs((p) => ({ ...p, [key]: value }));

  const sizeOptions =
    config.measurementUnit === 'metric' ? SIZE_OPTIONS_METRIC : SIZE_OPTIONS_IMPERIAL;

  return (
    <section className="bg-paper-100 border border-wood-200 px-6 py-10 md:px-12 md:py-14 max-w-3xl mx-auto">
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
        Explore pricing
      </p>
      <h2 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Find your range</h2>
      <p className="font-sans text-wood-600 leading-relaxed mb-10 max-w-xl">
        Every piece is made to its own dimensions and depth. Choose what calls to you and see the
        range it tends to fall in. A starting point for a conversation, not a final price.
      </p>

      <div className="space-y-7">
        <Segmented
          label="Size"
          value={inputs.sizeCategory}
          options={sizeOptions}
          onChange={(v) => set('sizeCategory', v)}
        />
        <Segmented
          label="Complexity"
          value={inputs.complexity}
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'layered', label: 'Layered' },
            { value: 'intricate', label: 'Intricate' },
          ]}
          onChange={(v) => set('complexity', v)}
        />
        <Segmented
          label="Finish"
          value={inputs.finishId}
          options={config.finishes.map((f) => ({ value: f.id, label: f.label }))}
          onChange={(v) => set('finishId', v)}
        />
        <Segmented
          label="Illumination"
          value={inputs.illumination}
          options={[
            { value: 'none', label: 'None' },
            { value: 'simple', label: 'Lit from within' },
            { value: 'custom', label: 'Custom light programming' },
          ]}
          onChange={(v) => set('illumination', v)}
        />
      </div>

      <div className="mt-10 pt-8 border-t border-wood-200">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 font-semibold mb-2">
          Typical range
        </p>
        <p className="font-serif text-4xl md:text-5xl text-wood-900 tabular-nums mb-3">
          {formatMoney(range.low)} to {formatMoney(range.high)}
        </p>
        <p className="font-sans text-sm text-wood-500 leading-relaxed max-w-lg">
          An estimate. The final price is confirmed once the specific design, dimensions, and
          details are settled together.
        </p>

        <div className="flex flex-wrap gap-4 mt-8">
          <Link
            to="/creations/multidimensional-art"
            className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold px-6 py-3 bg-wood-900 text-paper-50 hover:bg-wood-700 transition-colors"
          >
            Browse pieces
          </Link>
          <Link
            to="/inquire"
            className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold px-6 py-3 border border-wood-300 text-wood-900 hover:border-bronze-400 transition-colors"
          >
            Start a conversation
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PricingExplorer;
