import './admin/StudioSalesControls.css';
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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminAlert, AdminPage } from './admin/AdminPage';
import { InternalInputs, SavedQuote, PricingConfig } from '../utils/pricing/types';
import {
  calculatePricing,
  calibrationInsights,
  formatMoney,
  formatDiameter,
  getLayerMultiplier,
  tieredMidpoint,
  inToCm,
  cmToIn,
} from '../utils/pricing/engine';
import { loadConfig, saveConfig, resetConfig, loadQuotes, saveQuotes } from '../utils/pricing/config';
import {
  readServerConfig,
  acceptQuote,
  PricingRequestError,
  type QuoteAcceptance,
  type NewQuote,
  pushConfig,
  fetchQuotes,
  createQuote as apiCreateQuote,
  updateQuote as apiUpdateQuote,
  deleteQuote as apiDeleteQuote,
} from '../utils/pricing/api';
import { inputsFromArtwork } from '../utils/pricing/derive';
import { FULL_ARCHIVE } from '../data/mockData';
import { Slider, Segmented, Toggle, MoneyInput, Label } from './pricing/controls';
import PricingSettings from './pricing/PricingSettings';
import { PAYMENT_TERM_LABELS } from './invoices/invoiceUtils';
import type { PaymentTermMode } from './invoices/invoiceTypes';

type View = 'calculator' | 'settings' | 'reference' | 'accept';

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
  hasCrating: false,
  crateCostOverride: null,
  hasProjectionMapping: false,
  designAdjustment: 0,
};

const PENDING_CONFIG = 'pricing:pending-model';

function pendingConfig(): PricingConfig | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(PENDING_CONFIG) ?? 'null');
    return value && Array.isArray(value.sizeAnchors) && Array.isArray(value.finishes) ? value : null;
  }
  catch { return null; }
}

function dollarStepMinimum(amount: number): number {
  return (Math.round(amount * 100) % 100) / 100;
}

const PricingCalculator: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('quoteId');
  const linkedQuoteId = requested && /^[1-9]\d*$/.test(requested) ? requested : null;
  const [view, setView] = useState<View>(linkedQuoteId ? 'reference' : 'calculator');
  useEffect(() => { if (linkedQuoteId) setView('reference'); }, [linkedQuoteId]);
  const [config, setConfigState] = useState<PricingConfig>(() => pendingConfig() || loadConfig());
  const [modelStatus, setModelStatus] = useState<'checking' | 'saved' | 'pending' | 'failed'>(() => pendingConfig() ? 'pending' : 'checking');
  const [savingModel, setSavingModel] = useState(false);
  const configVersion = useRef(0);
  const quoteVersion = useRef(0);
  const [selection, setSelection] = useState<SavedQuote | null>(null);
  const [artworkId, setArtworkId] = useState('');
  const [inputs, setInputs] = useState<InternalInputs>(DEFAULT_INPUTS);
  const [quotes, setQuotesState] = useState<SavedQuote[]>(loadQuotes);
  const quotePending = useRef(false);
  const quoteRetry = useRef<(() => Promise<void>) | null>(null);
  const modelPending = useRef(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    if (!pendingConfig()) {
      void readServerConfig().then((next) => {
        if (!alive || configVersion.current !== 0) return;
        setConfigState(next);
        setModelStatus('saved');
        saveConfig(next);
      }).catch(() => { if (alive && configVersion.current === 0) setModelStatus('failed'); });
    }
    void fetchQuotes().then(server => {
      if (!alive || quoteVersion.current !== 0) return;
      const combined = [...server, ...loadQuotes().filter(q => q.id.startsWith('local-'))];
      setQuotesState(combined);
      saveQuotes(combined);
    }).catch(() => {
      if (alive && quoteVersion.current === 0) setMessage({
        error: true, text: 'Studio quotes could not be loaded. Any visible references are a copy from this device.',
      });
    });
    return () => { alive = false; };
  }, []);

  const setConfig = (next: PricingConfig) => {
    configVersion.current++;
    setConfigState(next);
    setModelStatus('pending');
    try { window.localStorage.setItem(PENDING_CONFIG, JSON.stringify(next)); }
    catch { /* Saving to Studio is still available. */ }
  };

  const persistModel = async () => {
    if (modelPending.current) return;
    modelPending.current = true;
    const version = configVersion.current;
    setSavingModel(true);
    try {
      await pushConfig(config);
      if (version === configVersion.current) {
        try { window.localStorage.removeItem(PENDING_CONFIG); } catch { /* storage unavailable */ }
        setModelStatus('saved');
      }
    } catch {
      if (version === configVersion.current) setModelStatus('failed');
    } finally { modelPending.current = false; setSavingModel(false); }
  };

  const persistQuotes = (update: (previous: SavedQuote[]) => SavedQuote[]) => {
    setQuotesState(previous => {
      const next = update(previous);
      saveQuotes(next);
      return next;
    });
  };

  const mutateQuote = async (action: () => Promise<void>) => {
    if (quotePending.current) return;
    quotePending.current = true;
    quoteVersion.current++;
    quoteRetry.current = action;
    setQuoteBusy(true);
    setMessage(null);
    try { await action(); quoteRetry.current = null; }
    catch { setMessage({ error: true, text: 'The quote change was not confirmed by Studio. Please retry.' }); }
    finally { quotePending.current = false; setQuoteBusy(false); }
  };

  const setQuoteActual = (id: string, actualPrice: number | null) => mutateQuote(async () => {
    const updated = await apiUpdateQuote(id, { actualPrice });
    persistQuotes(previous => previous.map(q => q.id === id ? { ...q, actualPrice: updated.actualPrice } : q));
  });

  const removeQuote = (id: string) => mutateQuote(async () => {
    if (!id.startsWith('local-')) await apiDeleteQuote(id);
    persistQuotes(previous => previous.filter(q => q.id !== id));
  });

  const syncLocalQuote = (quote: SavedQuote) => mutateQuote(async () => {
    const stored = await apiCreateQuote(quote);
    persistQuotes(previous => previous.map(q => q.id === quote.id ? stored : q));
  });

  const openAcceptance = (quote: SavedQuote) => {
    setMessage(null);
    setSelection(quote);
    setView('accept');
  };

  const confirmAcceptance = async (agreement: QuoteAcceptance) => {
    if (!selection || quotePending.current) return;
    quotePending.current = true;
    setQuoteBusy(true);
    setMessage(null);
    try {
      const invoiceId = await acceptQuote(selection.id, agreement);
      navigate(`/admin/invoices?invoiceId=${invoiceId}`);
    } catch (error) {
      if (error instanceof PricingRequestError && error.invoiceId && error.message === 'quote_already_accepted') {
        persistQuotes(previous => previous.map(q => q.id === selection.id ? { ...q, invoiceId: error.invoiceId } : q));
        setView('reference');
        setMessage({ error: true, text: 'This quote already has a draft with confirmed terms. Open it from Reference.' });
      } else {
        setMessage({ error: true, text: error instanceof PricingRequestError && error.message === 'invalid_conversation_url'
          ? 'Use an HTTPS conversation link or a plain reference such as “Email, 17 November”.'
          : 'Studio could not confirm this quote. Check the agreement and try again.' });
      }
    } finally { quotePending.current = false; setQuoteBusy(false); }
  };

  // Recenter the model on reality: scale the size base by the calibration
  // factor drawn from saved actual-vs-suggested prices.
  const applyScale = (factor: number) => {
    const next: PricingConfig = {
      ...config,
      sizeAnchors: config.sizeAnchors.map((a) => ({ ...a, price: Math.round(a.price * factor) })),
    };
    setConfig(next);
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
  const crateSuggested = tieredMidpoint(config.crateRanges, inputs.diameterIn);

  // Sculpture pieces, so the calculator can price any existing work directly.
  const pieces = useMemo(
    () =>
      FULL_ARCHIVE.filter(
        (a) => a.category === 'Multidimensional Art' || a.series === 'Universal Language'
      ).sort((a, b) => a.title.localeCompare(b.title)),
    []
  );
  const loadPiece = (id: string) => {
    const art = pieces.find((p) => p.id === id);
    if (art) { setInputs(inputsFromArtwork(art, config)); setArtworkId(art.id); }
  };

  const [pendingQuote, setPendingQuote] = useState<NewQuote | null>(null);
  const saveCurrentQuote = (continueToAgreement = false) => {
    if (quotePending.current) return;
    const name = pendingQuote?.name ?? window.prompt('Name this piece (for your reference)', pieces.find(piece => piece.id === artworkId)?.title || '');
    if (!name?.trim()) return;
    void mutateQuote(async () => {
      const configuration = [
        formatDiameter(inputs.diameterIn, config), `${inputs.layerCount} layers`, finish?.label,
        inputs.lightingType !== 'none' ? config.lighting.find(item => item.id === inputs.lightingType)?.label : '',
        inputs.hasFrame ? 'Frame' : '', inputs.hasClimateProtection ? 'Climate protection' : '',
        inputs.hasCrating ? 'Crating' : '', inputs.hasProjectionMapping ? 'Projection mapping' : '',
      ].filter(Boolean).join(' · ');
      const draft = pendingQuote ?? {
        name: name.trim(), inputs: { ...inputs }, suggestedRetail: breakdown.suggestedRetail,
        quote: breakdown.quote, configuration, artworkId,
      };
      setPendingQuote(draft);
      const created = await apiCreateQuote(draft);
      persistQuotes(previous => [created, ...previous]);
      setPendingQuote(null);
      setMessage({ error: false, text: 'Quote saved to Studio.' });
      if (continueToAgreement) openAcceptance(created);
    });
  };

  return (
    <AdminPage width="narrow">
      <div className="studio-sales-controls">
        <div className="max-w-2xl mx-auto">
          <p className="font-label text-label uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
            Admin
          </p>
          <h1 className="font-title text-4xl md:text-5xl text-wood-900 mb-2">Pricing</h1>
          <p className="font-body text-wood-500 mb-8 leading-relaxed">
            Your private compass for pricing a piece. Set the variables, see the production
            baseline, add the design value only you can feel, and arrive at a quote.
          </p>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-wood-200 mb-8">
            {(['calculator', 'settings', 'reference'] as View[]).map((v) => (
              <button
                key={v}
                aria-current={view === v ? 'page' : undefined}
                type="button"
                onClick={() => { if (linkedQuoteId) setSearchParams({}, { replace: true }); setView(v); }}
                className={`font-label text-label uppercase tracking-[0.2em] font-semibold px-4 py-3 -mb-px border-b-2 transition-colors capitalize ${
                  view === v
                    ? 'border-bronze-500 text-wood-900'
                    : 'border-transparent text-wood-400 hover:text-wood-700'
                }`}
              >
                {v === 'reference' ? `Reference${quotes.length ? ` · ${quotes.length}` : ''}` : v}
              </button>
            ))}
          </div>

          {message && <div className="mb-5"><AdminAlert tone={message.error ? 'error' : 'success'} live={message.error}>{message.text}{message.error && quoteRetry.current && <button type="button" className="ml-3 underline" disabled={quoteBusy}
            onClick={() => { if (quoteRetry.current) void mutateQuote(quoteRetry.current); }}>Try again</button>}</AdminAlert></div>}
          {view === 'calculator' && (modelStatus === 'pending' || modelStatus === 'failed') && (
            <p className="mb-4 font-body text-sm text-wood-700">Using the model on this device. Save it in Settings to update Studio.</p>
          )}

          {view === 'accept' && selection && <AcceptQuoteForm key={selection.id} quote={selection} busy={quoteBusy}
            onBack={() => setView('reference')} onConfirm={confirmAcceptance} />}

          {view === 'calculator' && (
            <div className="bg-paper-50 border border-wood-200">
              {/* Inputs */}
              <div className="px-5 py-6 md:px-7 md:py-7 space-y-6">
                {pieces.length > 0 && (
                  <div>
                    <Label className="block mb-2">Start from a piece</Label>
                    <select
                      value={artworkId}
                      onChange={(e) => e.target.value ? loadPiece(e.target.value) : setArtworkId('')}
                      className="font-body text-sm text-wood-900 w-full py-2.5 px-3 border border-wood-200 bg-paper-50 focus:border-bronze-400 outline-none transition-colors"
                    >
                      <option value="">Choose a piece to load its dimensions…</option>
                      {pieces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                          {p.dimensions ? ` · ${p.dimensions}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

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

                <div className="space-y-3">
                  <Toggle
                    label="Crating / shipping prep"
                    value={inputs.hasCrating}
                    onChange={(v) =>
                      setInputs((p) => ({ ...p, hasCrating: v, crateCostOverride: null }))
                    }
                  />
                  {inputs.hasCrating && (
                    <MoneyInput
                      value={inputs.crateCostOverride}
                      onChange={(v) => setInput('crateCostOverride', v)}
                      placeholder={`${Math.round(crateSuggested)} suggested`}
                      allowNull
                    />
                  )}
                </div>

                <Toggle
                  label="Projection mapping"
                  value={inputs.hasProjectionMapping}
                  onChange={(v) => setInput('hasProjectionMapping', v)}
                />
                {inputs.hasProjectionMapping && (
                  <p className="font-body text-sm text-wood-500 leading-relaxed -mt-3">
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
                      <span className="font-body text-sm text-wood-600">
                        {line.label}
                        {line.detail && (
                          <span className="text-wood-400"> · {line.detail}</span>
                        )}
                      </span>
                      <span className="font-body text-sm text-wood-900 tabular-nums">
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
                  <span className="font-label text-label uppercase tracking-[0.2em] text-bronze-300 font-semibold">
                    Quote · {Math.round(config.marginPercent * 100)}% margin
                  </span>
                  <span className="font-serif text-3xl tabular-nums">{formatMoney(breakdown.quote)}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  <button
                    type="button"
                    onClick={() => saveCurrentQuote()}
                    disabled={quoteBusy}
                    className="font-label text-label uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold"
                  >
                    Save this piece to reference
                  </button>
                  <button
                    type="button"
                    onClick={() => saveCurrentQuote(true)}
                    disabled={quoteBusy}
                    className="font-label text-label uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold"
                  >
                    Save quote and review for invoice
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === 'settings' && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button className="studio-sales-primary" type="button" disabled={savingModel || modelStatus === 'checking' || modelStatus === 'saved'}
                  onClick={() => void persistModel()}>{savingModel ? 'Saving model…' : 'Save model to Studio'}</button>
                <p className="font-body text-sm text-wood-700" role="status">{{
                  checking: 'Checking the Studio model…', saved: 'Using the model from Studio.',
                  pending: 'These changes are pending on this device.', failed: 'Studio did not confirm the model. Check the settings before retrying.',
                }[modelStatus]}</p>
              </div>
              <PricingSettings
              config={config}
              onChange={setConfig}
              onReset={() => setConfig(resetConfig())}
              />
            </>
          )}

          {view === 'reference' && (
            <ReferenceTab
              quotes={linkedQuoteId ? quotes.filter(q => q.id === linkedQuoteId) : quotes}
              onSetActual={setQuoteActual}
              onRemove={removeQuote}
              onApplyScale={applyScale}
              busy={quoteBusy}
              onSync={syncLocalQuote}
              onAccept={openAcceptance}
            />
          )}
        </div>
      </div>
    </AdminPage>
  );
};

const ReferenceTab: React.FC<{
  quotes: SavedQuote[];
  onSetActual: (id: string, actualPrice: number | null) => void;
  onRemove: (id: string) => void;
  onApplyScale: (factor: number) => void;
  onAccept: (quote: SavedQuote) => void;
  busy: boolean;
  onSync: (quote: SavedQuote) => void;
}> = ({ quotes, onSetActual, onRemove, onApplyScale, busy, onSync, onAccept }) => {
  const insight = calibrationInsights(quotes);
  if (quotes.length === 0) {
    return (
      <div className="bg-paper-50 border border-wood-200 px-6 py-10 text-center">
        <p className="font-body text-wood-500 leading-relaxed">
          No saved pieces yet. Price a piece on the Calculator tab and save it here, then enter
          what you actually charged. Over time this shows where the formula tracks your intuition
          and where it drifts, so you can tune the model.
        </p>
      </div>
    );
  }

  const applySuggestion = () => {
    if (!insight) return;
    const factor = insight.medianRatio;
    const ok = window.confirm(
      `Scale every size base price by ×${factor.toFixed(2)} to recenter the model on your actual prices? You can fine-tune or reset afterward in Settings.`
    );
    if (ok) onApplyScale(factor);
  };

  return (
    <div className="space-y-3">
      {insight && (
        <div className="bg-paper-50 border border-bronze-300 px-5 py-5">
          <Label className="block mb-3">Calibration · {insight.calibratedCount} pieces</Label>
          <p className="font-body text-sm text-wood-600 leading-relaxed mb-4">
            On the pieces you've priced, the formula sits within an average of{' '}
            <span className="text-wood-900">{insight.meanAbsVariancePct}%</span> of what you charged
            {insight.biasPct === 0 ? (
              ', with no consistent lean.'
            ) : (
              <>
                , and tends to run{' '}
                <span className="text-wood-900">
                  {Math.abs(insight.biasPct)}% {insight.biasPct > 0 ? 'low' : 'high'}
                </span>
                .
              </>
            )}
          </p>
          {Math.abs(insight.biasPct) >= 5 && (
            <button
              type="button"
              onClick={applySuggestion}
              className="font-label text-label uppercase tracking-[0.2em] text-bronze-700 hover:text-bronze-900 transition-colors font-semibold border-b border-bronze-400 pb-0.5"
            >
              Recenter base prices ×{insight.medianRatio.toFixed(2)}
            </button>
          )}
        </div>
      )}
      {quotes.map((q) => {
        const startingActual = q.actualPrice ?? q.suggestedRetail;
        const variance =
          q.actualPrice != null && q.suggestedRetail > 0
            ? Math.round(((q.actualPrice - q.suggestedRetail) / q.suggestedRetail) * 100)
            : null;
        return (
          <div key={q.id} className="bg-paper-50 border border-wood-200 px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <h3 className="font-serif text-lg text-wood-900 font-medium">{q.name}</h3>
              <button
                type="button"
                onClick={() => onRemove(q.id)}
                disabled={busy || Boolean(q.invoiceId)}
                className="font-label text-label uppercase tracking-[0.15em] text-wood-300 hover:text-wood-700 transition-colors font-semibold"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 items-end">
              <div>
                <Label className="block mb-1">Suggested</Label>
                <span className="font-serif text-lg text-wood-900 tabular-nums">
                  {formatMoney(q.suggestedRetail)}
                </span>
              </div>
              <div>
                <Label className="block mb-1">Actual</Label>
                <input key={`${q.actualPrice}:${startingActual}`} type="number" min={dollarStepMinimum(startingActual)} step="1" inputMode="decimal"
                  aria-label={`Actual price for ${q.name}`} className="w-full min-w-0 border border-wood-300 bg-paper-50 px-2 py-2 font-body text-sm text-wood-900" defaultValue={startingActual}
                  disabled={busy || q.id.startsWith('local-')}
                  onChange={event => {
                    const input = event.currentTarget;
                    const draft = input.valueAsNumber;
                    input.min = String(dollarStepMinimum(Number.isFinite(draft) && draft >= 0 ? draft : startingActual));
                  }}
                  onKeyDown={event => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    const input = event.currentTarget;
                    if (q.actualPrice == null && input.valueAsNumber === startingActual) onSetActual(q.id, startingActual);
                    input.blur();
                  }}
                  onBlur={event => {
                    const input = event.currentTarget;
                    const actual = input.valueAsNumber;
                    if (input.value === '' || !Number.isFinite(actual) || actual < 0) {
                      if (q.actualPrice != null && input.value === '' && !input.validity.badInput) { onSetActual(q.id, null); return; }
                      input.value = String(startingActual);
                      return;
                    }
                    if (actual !== startingActual) onSetActual(q.id, actual);
                  }} />
              </div>
              <div>
                <Label className="block mb-1">Variance</Label>
                <span
                  className={`font-serif text-lg tabular-nums ${
                    variance == null
                      ? 'text-wood-700'
                      : Math.abs(variance) <= 10
                        ? 'text-wood-900'
                        : 'text-bronze-700'
                  }`}
                >
                  {variance == null ? 'Not recorded' : `${variance > 0 ? '+' : ''}${variance}%`}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-wood-200 pt-3">
              <p className="font-body text-sm text-wood-700">Estimate {formatMoney(q.quote)}{q.id.startsWith('local-') ? ' · On this device only' : ''}</p>
              {q.invoiceId ? <Link className="min-h-[var(--control-h)] inline-flex items-center font-label text-sm text-bronze-800 underline"
                to={`/admin/invoices?invoiceId=${q.invoiceId}`}>Open exact invoice</Link>
                : q.id.startsWith('local-')
                  ? <button type="button" className="studio-sales-primary" disabled={busy} onClick={() => onSync(q)}>Save to Studio</button>
                  : <button type="button" className="studio-sales-primary" disabled={busy} onClick={() => onAccept(q)}>Review for invoice</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

function AcceptQuoteForm({ quote, busy, onBack, onConfirm }: {
  quote: SavedQuote; busy: boolean; onBack: () => void; onConfirm: (agreement: QuoteAcceptance) => void;
}) {
  const [buyerName, setBuyerName] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [artworkTitle, setArtworkTitle] = useState(quote.name);
  const [configuration, setConfiguration] = useState(quote.configuration || (
    quote.inputs.diameterIn ? `${Math.round(inToCm(quote.inputs.diameterIn))} cm · ${quote.inputs.layerCount} layers` : ''
  ));
  const [amount, setAmount] = useState(String(quote.quote));
  const [termMode, setTermMode] = useState<PaymentTermMode>('single');
  const [conversation, setConversation] = useState('');
  return (
    <form className="space-y-4 border border-wood-200 bg-paper-50 p-5 sm:p-7" onSubmit={event => {
      event.preventDefault();
      onConfirm({ clientName: buyerName, clientEmail: buyerEmail, artworkTitle, configuration,
        amountCents: Math.round(Number(amount) * 100), termMode, conversation });
    }}>
      <div>
        <h2 className="font-serif text-2xl text-wood-900">Confirm the buyer’s agreement</h2>
        <p className="font-body text-sm text-wood-700">Use the agreed price, size and edition from the original conversation. Confirming saves one invoice draft. You can add shipping and payment details there.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="font-label text-sm text-wood-800">Buyer name
          <input className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" required value={buyerName} onChange={e => setBuyerName(e.target.value)} maxLength={160} />
        </label>
        <label className="font-label text-sm text-wood-800">Buyer email (optional)
          <input className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" type="email" value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} maxLength={240} />
        </label>
        <label className="font-label text-sm text-wood-800 sm:col-span-2">Artwork title on invoice
          <input className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" required value={artworkTitle} onChange={e => setArtworkTitle(e.target.value)} maxLength={180} />
        </label>
        <label className="font-label text-sm text-wood-800 sm:col-span-2">Agreed size, edition and configuration
          <textarea className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" required value={configuration} onChange={e => setConfiguration(e.target.value)} maxLength={360} rows={2} />
        </label>
        <label className="font-label text-sm text-wood-800">Agreed artwork price (USD)
          <input className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" required type="number" min="0.01" step="0.01" max="1000000" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <label className="font-label text-sm text-wood-800">Agreed payment plan
          <select className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" value={termMode} onChange={e => setTermMode(e.target.value as PaymentTermMode)}>
            {Object.entries(PAYMENT_TERM_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="font-label text-sm text-wood-800 sm:col-span-2">Original conversation (private)
          <input className="w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-body text-sm text-wood-900" value={conversation} onChange={e => setConversation(e.target.value)} maxLength={800}
            placeholder="HTTPS link or short reference, e.g. Email, 17 November" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="studio-sales-primary" type="submit" disabled={busy}>{busy ? 'Confirming…' : 'Confirm agreement and create draft'}</button>
        <button className="min-h-[var(--control-h)] px-3 font-label text-sm text-bronze-800 underline" type="button" onClick={onBack} disabled={busy}>Back to quotes</button>
      </div>
    </form>
  );
}

export default PricingCalculator;
