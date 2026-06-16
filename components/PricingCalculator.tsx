/**
 * Internal Pricing Calculator — Adrian's private quoting engine, at
 * /admin/pricing behind the same auth as the rest of the control panel.
 *
 * Three tabs: the compact Calculator (the daily driver), Settings (the
 * control room, where most of the screen lives), and Reference (priced
 * pieces saved over time, so the formula can be checked against what was
 * actually charged). All three read and write one shared PricingConfig.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import AdminLayout from './AdminLayout';
import { InternalInputs, SavedQuote, PricingConfig } from '../utils/pricing/types';
import {
  calculatePricing,
  formatMoney,
  formatDiameter,
  getLayerMultiplier,
  tieredMidpoint,
  inToCm,
  cmToIn,
} from '../utils/pricing/engine';
import { loadConfig, saveConfig, resetConfig, loadQuotes, saveQuotes } from '../utils/pricing/config';
import {
  fetchConfig,
  pushConfig,
  fetchQuotes,
  createQuote as apiCreateQuote,
  updateQuote as apiUpdateQuote,
  deleteQuote as apiDeleteQuote,
} from '../utils/pricing/api';
import { Slider, Segmented, Toggle, MoneyInput, Label } from './pricing/controls';
import PricingSettings from './pricing/PricingSettings';

type View = 'calculator' | 'settings' | 'reference';

const DEFAULT_INPUTS: InternalInputs = {
  diameterIn: 24,
  layerCount: 5,
  finishId: 'painted',
  crystalBudget: 0,
  lightingType: 'none',
  hasFrame: false,
  frameCostOverride: null,
  hasClimateProtection: false,
  climateCostOverride: null,
  hasProjectionMapping: false,
  designAdjustment: 0,
};

const PricingCalculator: React.FC = () => {
  const [view, setView] = useState<View>('calculator');
  // Render instantly from the local cache (or defaults), then hydrate from
  // the authoritative server copy once it arrives.
  const [config, setConfigState] = useState<PricingConfig>(loadConfig);
  const [inputs, setInputs] = useState<InternalInputs>(DEFAULT_INPUTS);
  const [quotes, setQuotesState] = useState<SavedQuote[]>(loadQuotes);
  const pushTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetchConfig().then((c) => alive && setConfigState(c));
    fetchQuotes().then((q) => alive && setQuotesState(q));
    return () => {
      alive = false;
    };
  }, []);

  // Cache locally at once; push to the server debounced so dragging a value
  // doesn't fire a request per pixel.
  const setConfig = (next: PricingConfig) => {
    setConfigState(next);
    saveConfig(next);
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => pushConfig(next), 600);
  };

  const setQuoteActual = (id: string, actualPrice: number | null) => {
    setQuotesState((prev) => {
      const next = prev.map((q) => (q.id === id ? { ...q, actualPrice } : q));
      saveQuotes(next);
      return next;
    });
    apiUpdateQuote(id, { actualPrice });
  };

  const removeQuote = (id: string) => {
    setQuotesState((prev) => {
      const next = prev.filter((q) => q.id !== id);
      saveQuotes(next);
      return next;
    });
    apiDeleteQuote(id);
  };

  const breakdown = useMemo(() => calculatePricing(inputs, config), [inputs, config]);
  const setInput = <K extends keyof InternalInputs>(key: K, value: InternalInputs[K]) =>
    setInputs((prev) => ({ ...prev, [key]: value }));

  const finish = config.finishes.find((f) => f.id === inputs.finishId) ?? config.finishes[0];
  const metric = config.measurementUnit === 'metric';

  // Diameter slider works in the chosen unit, but state always holds inches.
  const sliderMin = metric ? 15 : 6;
  const sliderMax = metric ? 152 : 60;
  const sliderValue = metric ? Math.round(inToCm(inputs.diameterIn)) : Math.round(inputs.diameterIn);
  const onSlideDiameter = (v: number) => setInput('diameterIn', metric ? cmToIn(v) : v);

  const frameSuggested = tieredMidpoint(config.frameRanges, inputs.diameterIn);
  const climateSuggested = tieredMidpoint(config.climateRanges, inputs.diameterIn);

  const saveCurrentQuote = async () => {
    const name = window.prompt('Name this piece (for your reference)');
    if (!name) return;
    const created = await apiCreateQuote({
      name: name.trim(),
      inputs: { ...inputs },
      suggestedRetail: breakdown.suggestedRetail,
      quote: breakdown.quote,
    });
    setQuotesState((prev) => {
      const next = [created, ...prev];
      saveQuotes(next);
      return next;
    });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-paper-50 px-5 py-12 md:px-6 md:py-16">
        <div className="max-w-2xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
            Admin
          </p>
          <h1 className="font-title text-4xl md:text-5xl text-wood-900 mb-2">Pricing</h1>
          <p className="font-sans text-wood-500 mb-8 leading-relaxed">
            Your private compass for pricing a piece. Set the variables, see the production
            baseline, add the design value only you can feel, and arrive at a quote.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-wood-200 mb-8">
            {(['calculator', 'settings', 'reference'] as View[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`font-label text-[11px] uppercase tracking-[0.2em] font-semibold px-4 py-3 -mb-px border-b-2 transition-colors capitalize ${
                  view === v
                    ? 'border-bronze-500 text-wood-900'
                    : 'border-transparent text-wood-400 hover:text-wood-700'
                }`}
              >
                {v === 'reference' ? `Reference${quotes.length ? ` · ${quotes.length}` : ''}` : v}
              </button>
            ))}
          </div>

          {view === 'calculator' && (
            <div className="bg-white border border-wood-200">
              {/* Inputs */}
              <div className="px-5 py-6 md:px-7 md:py-7 space-y-6">
                <Slider
                  label="Diameter"
                  value={sliderValue}
                  min={sliderMin}
                  max={sliderMax}
                  step={1}
                  onChange={onSlideDiameter}
                  formatValue={() => formatDiameter(inputs.diameterIn, config)}
                />

                <Slider
                  label="Layer count"
                  value={inputs.layerCount}
                  min={1}
                  max={20}
                  step={1}
                  onChange={(v) => setInput('layerCount', v)}
                  formatValue={(v) => `${v} · ×${getLayerMultiplier(v, config).toFixed(2)}`}
                />

                <Segmented
                  label="Finish"
                  value={inputs.finishId}
                  onChange={(v) => setInput('finishId', v)}
                  options={config.finishes.map((f) => ({ value: f.id, label: f.label }))}
                />

                {finish?.usesCrystals && (
                  <MoneyInput
                    label="Crystal budget"
                    value={inputs.crystalBudget}
                    onChange={(v) => setInput('crystalBudget', v ?? 0)}
                    placeholder="0"
                  />
                )}

                <Segmented
                  label="Lighting"
                  value={inputs.lightingType}
                  onChange={(v) => setInput('lightingType', v)}
                  options={config.lighting.map((l) => ({ value: l.id, label: l.label }))}
                />

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-3">
                    <Toggle
                      label="Frame"
                      value={inputs.hasFrame}
                      onChange={(v) =>
                        setInputs((p) => ({ ...p, hasFrame: v, frameCostOverride: null }))
                      }
                    />
                    {inputs.hasFrame && (
                      <MoneyInput
                        value={inputs.frameCostOverride}
                        onChange={(v) => setInput('frameCostOverride', v)}
                        placeholder={`${Math.round(frameSuggested)} suggested`}
                        allowNull
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <Toggle
                      label="Climate protection"
                      value={inputs.hasClimateProtection}
                      onChange={(v) =>
                        setInputs((p) => ({
                          ...p,
                          hasClimateProtection: v,
                          climateCostOverride: null,
                        }))
                      }
                    />
                    {inputs.hasClimateProtection && (
                      <MoneyInput
                        value={inputs.climateCostOverride}
                        onChange={(v) => setInput('climateCostOverride', v)}
                        placeholder={`${Math.round(climateSuggested)} suggested`}
                        allowNull
                      />
                    )}
                  </div>
                </div>

                <Toggle
                  label="Projection mapping"
                  value={inputs.hasProjectionMapping}
                  onChange={(v) => setInput('hasProjectionMapping', v)}
                />
                {inputs.hasProjectionMapping && (
                  <p className="font-sans text-sm text-wood-500 leading-relaxed -mt-3">
                    Quoted separately, starting at {formatMoney(config.projectionStartingPrice)}. Not
                    included in the total below.
                  </p>
                )}
              </div>

              {/* Receipt */}
              <div className="border-t border-wood-200 bg-paper-50 px-5 py-6 md:px-7 md:py-7">
                <div className="space-y-1.5 mb-5">
                  {breakdown.lines.map((line, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-4">
                      <span className="font-sans text-sm text-wood-600">
                        {line.label}
                        {line.detail && (
                          <span className="text-wood-400"> · {line.detail}</span>
                        )}
                      </span>
                      <span className="font-sans text-sm text-wood-900 tabular-nums">
                        {formatMoney(line.amount)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-baseline justify-between gap-4 pt-3 border-t border-wood-200">
                  <Label>Production baseline</Label>
                  <span className="font-serif text-lg text-wood-900 tabular-nums">
                    {formatMoney(breakdown.productionBaseline)}
                  </span>
                </div>

                <div className="mt-4">
                  <MoneyInput
                    label="Design value"
                    value={inputs.designAdjustment}
                    onChange={(v) => setInput('designAdjustment', v ?? 0)}
                    placeholder="0"
                  />
                </div>

                <div className="flex items-baseline justify-between gap-4 mt-5 pt-4 border-t border-wood-200">
                  <Label>Suggested retail</Label>
                  <span className="font-serif text-2xl text-wood-900 tabular-nums">
                    {formatMoney(breakdown.suggestedRetail)}
                  </span>
                </div>

                <div className="mt-4 bg-wood-900 text-paper-50 px-5 py-4 flex items-baseline justify-between gap-4">
                  <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-300 font-semibold">
                    Quote · {Math.round(config.marginPercent * 100)}% margin
                  </span>
                  <span className="font-serif text-3xl tabular-nums">{formatMoney(breakdown.quote)}</span>
                </div>

                <button
                  type="button"
                  onClick={saveCurrentQuote}
                  className="mt-5 font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold"
                >
                  Save this piece to reference
                </button>
              </div>
            </div>
          )}

          {view === 'settings' && (
            <PricingSettings
              config={config}
              onChange={setConfig}
              onReset={() => setConfig(resetConfig())}
            />
          )}

          {view === 'reference' && (
            <ReferenceTab quotes={quotes} onSetActual={setQuoteActual} onRemove={removeQuote} />
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

const ReferenceTab: React.FC<{
  quotes: SavedQuote[];
  onSetActual: (id: string, actualPrice: number | null) => void;
  onRemove: (id: string) => void;
}> = ({ quotes, onSetActual, onRemove }) => {
  if (quotes.length === 0) {
    return (
      <div className="bg-white border border-wood-200 px-6 py-10 text-center">
        <p className="font-sans text-wood-500 leading-relaxed">
          No saved pieces yet. Price a piece on the Calculator tab and save it here, then enter
          what you actually charged. Over time this shows where the formula tracks your intuition
          and where it drifts, so you can tune the model.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
        const variance =
          q.actualPrice != null && q.suggestedRetail > 0
            ? Math.round(((q.actualPrice - q.suggestedRetail) / q.suggestedRetail) * 100)
            : null;
        return (
          <div key={q.id} className="bg-white border border-wood-200 px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h3 className="font-serif text-lg text-wood-900 font-medium">{q.name}</h3>
              <button
                type="button"
                onClick={() => onRemove(q.id)}
                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-300 hover:text-wood-700 transition-colors font-semibold"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <div>
                <Label className="block mb-1">Suggested</Label>
                <span className="font-serif text-lg text-wood-900 tabular-nums">
                  {formatMoney(q.suggestedRetail)}
                </span>
              </div>
              <div>
                <Label className="block mb-1">Actual</Label>
                <MoneyInput
                  value={q.actualPrice}
                  onChange={(v) => onSetActual(q.id, v)}
                  placeholder="—"
                  allowNull
                />
              </div>
              <div>
                <Label className="block mb-1">Variance</Label>
                <span
                  className={`font-serif text-lg tabular-nums ${
                    variance == null
                      ? 'text-wood-300'
                      : Math.abs(variance) <= 10
                        ? 'text-wood-900'
                        : 'text-bronze-700'
                  }`}
                >
                  {variance == null ? '—' : `${variance > 0 ? '+' : ''}${variance}%`}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PricingCalculator;
