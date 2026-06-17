/**
 * The control room. Every multiplier, anchor, and range in the pricing model
 * is editable here, and the bulk of the screen real estate lives in this tab
 * by design — the calculator stays minimal, the tuning happens here. Changes
 * are lifted to the parent, which persists them.
 */

import React from 'react';
import { PricingConfig, SizeTieredCost, MeasurementUnit } from '../../utils/pricing/types';
import { inToCm } from '../../utils/pricing/engine';
import { Label, NumberField } from './controls';

interface Props {
  config: PricingConfig;
  onChange: (next: PricingConfig) => void;
  onReset: () => void;
}

const Section: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({
  title,
  hint,
  children,
}) => (
  <section className="bg-white border border-wood-200 px-5 py-5 md:px-6 md:py-6">
    <h3 className="font-serif text-xl text-wood-900 font-medium mb-1">{title}</h3>
    {hint && <p className="font-sans text-sm text-wood-500 leading-relaxed mb-4">{hint}</p>}
    {!hint && <div className="mb-4" />}
    {children}
  </section>
);

const sizeLabel = (inches: number, unit: MeasurementUnit) =>
  unit === 'metric' ? `${Math.round(inToCm(inches))}cm` : `${inches}"`;

const PricingSettings: React.FC<Props> = ({ config, onChange, onReset }) => {
  const update = (patch: Partial<PricingConfig>) => onChange({ ...config, ...patch });

  const renderTieredTable = (
    tiers: SizeTieredCost[],
    onTiers: (next: SizeTieredCost[]) => void
  ) => (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
        <Label>Size</Label>
        <Label className="text-right w-20">Low</Label>
        <Label className="text-right w-20">High</Label>
      </div>
      {tiers.map((t, i) => (
        <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
          <span className="font-sans text-sm text-wood-600">
            {sizeLabel(t.minSizeIn, config.measurementUnit)} to {sizeLabel(t.maxSizeIn, config.measurementUnit)}
          </span>
          <NumberField
            className="w-20"
            prefix="$"
            value={t.min}
            onChange={(v) => onTiers(tiers.map((x, j) => (j === i ? { ...x, min: v } : x)))}
          />
          <NumberField
            className="w-20"
            prefix="$"
            value={t.max}
            onChange={(v) => onTiers(tiers.map((x, j) => (j === i ? { ...x, max: v } : x)))}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* General */}
      <Section title="General">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <Label className="block mb-2">Measurement unit</Label>
            <div className="flex gap-1.5">
              {(['imperial', 'metric'] as MeasurementUnit[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => update({ measurementUnit: u })}
                  className={`font-sans text-sm px-3 py-2 border transition-colors capitalize ${
                    config.measurementUnit === u
                      ? 'border-bronze-500 bg-bronze-50 text-wood-900'
                      : 'border-wood-200 bg-white text-wood-500 hover:border-bronze-300'
                  }`}
                >
                  {u === 'imperial' ? 'Inches' : 'Centimeters'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="block mb-2">Negotiation margin</Label>
            <NumberField
              suffix="%"
              step={1}
              value={Math.round(config.marginPercent * 100)}
              onChange={(v) => update({ marginPercent: v / 100 })}
            />
          </div>
          <div>
            <Label className="block mb-2">Round prices to nearest</Label>
            <NumberField prefix="$" step={5} value={config.roundTo} onChange={(v) => update({ roundTo: v })} />
          </div>
          <div>
            <Label className="block mb-2">Customer range spread</Label>
            <NumberField
              suffix="%"
              step={5}
              value={Math.round(config.designSpreadPercent * 100)}
              onChange={(v) => update({ designSpreadPercent: v / 100 })}
            />
          </div>
          <div>
            <Label className="block mb-2">Projection mapping, starting at</Label>
            <NumberField
              prefix="$"
              step={50}
              value={config.projectionStartingPrice}
              onChange={(v) => update({ projectionStartingPrice: v })}
            />
          </div>
        </div>
      </Section>

      {/* Size anchors */}
      <Section
        title="Size anchors"
        hint="Base price by diameter. Sizes between anchors interpolate smoothly. These are the backbone of every price."
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <Label>Diameter</Label>
            <Label className="text-right w-24">Base price</Label>
          </div>
          {config.sizeAnchors.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <span className="font-sans text-sm text-wood-600">
                {sizeLabel(a.diameterIn, config.measurementUnit)}
              </span>
              <NumberField
                className="w-24"
                prefix="$"
                value={a.price}
                onChange={(v) =>
                  update({
                    sizeAnchors: config.sizeAnchors.map((x, j) => (j === i ? { ...x, price: v } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Layer tiers */}
      <Section
        title="Layer multipliers"
        hint="The factor applied to the size base for each layer-count band. More depth, more weight."
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <Label>Layers</Label>
            <Label className="text-right w-24">Multiplier</Label>
          </div>
          {config.layerTiers.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <span className="font-sans text-sm text-wood-600">
                {t.minLayers} to {t.maxLayers}
              </span>
              <NumberField
                className="w-24"
                prefix="×"
                step={0.1}
                value={t.multiplier}
                onChange={(v) =>
                  update({
                    layerTiers: config.layerTiers.map((x, j) => (j === i ? { ...x, multiplier: v } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Finishes */}
      <Section
        title="Finishes"
        hint="Each finish adds a percentage of the post-layer subtotal. Crystals are added on top as a manual budget."
      >
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <Label>Finish</Label>
            <Label className="text-right w-24">Addition</Label>
          </div>
          {config.finishes.map((f, i) => (
            <div key={f.id} className="grid grid-cols-[1fr_auto] gap-2 items-center">
              <span className="font-sans text-sm text-wood-600">
                {f.label}
                {f.usesCrystals ? ' · + crystal budget' : ''}
              </span>
              <NumberField
                className="w-24"
                suffix="%"
                step={5}
                value={Math.round(f.percent * 100)}
                onChange={(v) =>
                  update({
                    finishes: config.finishes.map((x, j) => (j === i ? { ...x, percent: v / 100 } : x)),
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Lighting */}
      {config.lighting
        .filter((l) => l.id !== 'none')
        .map((option) => (
          <Section key={option.id} title={`Lighting · ${option.label}`}>
            {renderTieredTable(option.tiers, (next) =>
              update({
                lighting: config.lighting.map((l) =>
                  l.id === option.id ? { ...l, tiers: next } : l
                ),
              })
            )}
          </Section>
        ))}

      {/* Frame */}
      <Section title="Frame costs" hint="Suggested range by size. You can override the actual figure per piece in the calculator.">
        {renderTieredTable(config.frameRanges, (next) => update({ frameRanges: next }))}
      </Section>

      {/* Climate */}
      <Section
        title="Climate protection"
        hint="Humid-weather finish. Suggested range by size, overridable per piece."
      >
        {renderTieredTable(config.climateRanges, (next) => update({ climateRanges: next }))}
      </Section>

      {/* Crating */}
      <Section
        title="Crating / shipping prep"
        hint="Cost to crate and prepare a piece for safe transit. Suggested range by size, overridable per piece."
      >
        {renderTieredTable(config.crateRanges ?? [], (next) => update({ crateRanges: next }))}
      </Section>

      <div className="pt-2">
        <button
          type="button"
          onClick={onReset}
          className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 hover:text-wood-900 transition-colors font-semibold"
        >
          Reset all values to defaults
        </button>
      </div>
    </div>
  );
};

export default PricingSettings;
