/**
 * Small form primitives for the pricing tools, styled to the site's design
 * system (paper / wood / stone / bronze, Karla labels, no icons or badges).
 * Kept here so the calculator and the explorer share one visual language.
 */

import React from 'react';

export const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <span
    className={`font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 font-semibold ${className}`}
  >
    {children}
  </span>
);

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}) => (
  <div>
    <div className="flex items-baseline justify-between mb-2">
      <Label>{label}</Label>
      <span className="font-serif text-lg text-wood-900 tabular-nums">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-bronze-600 cursor-pointer"
      aria-label={label}
    />
  </div>
);

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div>
      {label && <Label className="block mb-2">{label}</Label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`font-sans text-sm px-3 py-2 border transition-colors ${
                active
                  ? 'border-bronze-500 bg-bronze-50 text-wood-900'
                  : 'border-wood-200 bg-white text-wood-500 hover:border-bronze-300 hover:text-wood-900'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ label, value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex items-center justify-between w-full px-4 py-3 border transition-colors text-left ${
      value
        ? 'border-bronze-500 bg-bronze-50'
        : 'border-wood-200 bg-white hover:border-bronze-300'
    }`}
    aria-pressed={value}
  >
    <span className="font-sans text-sm text-wood-900">{label}</span>
    <span
      className={`font-label text-[11px] uppercase tracking-[0.15em] font-semibold ${
        value ? 'text-bronze-700' : 'text-wood-400'
      }`}
    >
      {value ? 'On' : 'Off'}
    </span>
  </button>
);

interface MoneyInputProps {
  label?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  allowNull?: boolean;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  allowNull,
}) => (
  <div>
    {label && <Label className="block mb-2">{label}</Label>}
    <div className="flex items-center border border-wood-200 bg-white focus-within:border-bronze-400 transition-colors">
      <span className="font-sans text-wood-400 pl-3 pr-1 select-none">$</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(allowNull ? null : 0);
          } else {
            onChange(Number(raw));
          }
        }}
        className="font-sans text-wood-900 w-full py-2.5 pr-3 bg-transparent outline-none tabular-nums"
      />
    </div>
  </div>
);

/** A bare number field for editing config tables (anchors, multipliers). */
export const NumberField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  step?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, onChange, step = 1, prefix, suffix, className = '' }) => (
  <div
    className={`flex items-center border border-wood-200 bg-white focus-within:border-bronze-400 transition-colors ${className}`}
  >
    {prefix && <span className="font-sans text-wood-400 pl-2 pr-0.5 text-sm select-none">{prefix}</span>}
    <input
      type="number"
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="font-sans text-sm text-wood-900 w-full py-1.5 px-2 bg-transparent outline-none tabular-nums"
    />
    {suffix && <span className="font-sans text-wood-400 pr-2 pl-0.5 text-sm select-none">{suffix}</span>}
  </div>
);
