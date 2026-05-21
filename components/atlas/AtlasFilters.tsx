import React from 'react';

export type AtlasStatusFilter = 'all' | 'placed' | 'seeking';

export interface AtlasFiltersProps {
  series: readonly string[];        // available series for the dropdown
  selectedSeries: string;            // 'all' or a specific series name
  onSeriesChange: (next: string) => void;
  status: AtlasStatusFilter;
  onStatusChange: (next: AtlasStatusFilter) => void;
  placedCount: number;
  seekingCount: number;
}

const btnBase =
  'font-label text-[11px] uppercase tracking-[0.18em] px-4 min-h-[44px] border transition-colors duration-200 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';
const active = 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative';
const inactive =
  'text-wood-700 border-wood-400 hover:text-wood-900 hover:border-wood-700 bg-transparent';

const STATUS_OPTIONS: ReadonlyArray<{ value: AtlasStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'seeking', label: 'Seeking ground' },
];

const AtlasFilters: React.FC<AtlasFiltersProps> = ({
  series,
  selectedSeries,
  onSeriesChange,
  status,
  onStatusChange,
  placedCount,
  seekingCount,
}) => {
  const total = placedCount + seekingCount;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Series filter — native select keeps it light and accessible. */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="atlas-series"
          className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700"
        >
          Series
        </label>
        <div className="relative">
          <select
            id="atlas-series"
            value={selectedSeries}
            onChange={(e) => onSeriesChange(e.target.value)}
            className="appearance-none bg-transparent border border-wood-400 focus:border-bronze-700 text-wood-900 font-sans text-sm pl-3 pr-10 py-2.5 min-h-[44px] outline-none focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors duration-200"
          >
            <option value="all">All series</option>
            {series.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-label text-[10px] uppercase tracking-[0.18em] text-wood-600"
          >
            ▾
          </span>
        </div>
      </div>

      {/* Status filter — segmented buttons matching site convention. */}
      <div className="flex flex-col gap-2 sm:items-end">
        <div role="group" aria-label="Status filter" className="flex items-center">
          {STATUS_OPTIONS.map((opt, i) => {
            const isActive = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => onStatusChange(opt.value)}
                className={`${btnBase} ${i > 0 ? '-ml-px' : ''} ${
                  isActive ? active : inactive
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p
          className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600"
          aria-live="polite"
        >
          {total} {total === 1 ? 'piece' : 'pieces'} · {placedCount} placed ·{' '}
          {seekingCount} seeking ground
        </p>
      </div>
    </div>
  );
};

export default AtlasFilters;
