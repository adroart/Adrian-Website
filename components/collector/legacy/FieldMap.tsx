import { useId } from 'react';

import type { FieldItem, FilteredFieldItem } from './FieldExperience';

const REGISTERED_OPACITY = 0.88;
const UNREGISTERED_OPACITY_LIMIT = 0.27;
const RECEDED_SCALE = 0.2;
const FIELD_LIGHT_COLOR = '#c4aa7c';

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

export function markerPresentation(item: FieldItem, matches: boolean) {
  const registered = item.identity.status !== 'unregistered';
  const restingOpacity = registered
    ? REGISTERED_OPACITY
    : Math.min(UNREGISTERED_OPACITY_LIMIT, clamp(item.identity.brightness, 0.12, 1));
  return {
    opacity: restingOpacity * (matches ? 1 : RECEDED_SCALE),
    radius: clamp(item.identity.markerSize, 3, 12),
  };
}

function locationPoint(lat: number, lng: number, visibleRadius: number) {
  const safeLat = clamp(lat, -90, 90);
  const safeLng = clamp(lng, -180, 180);
  const latitudeRadians = safeLat * (Math.PI / 180);
  const usableRadiusX = 438 - visibleRadius;
  const usableRadiusY = 175 - visibleRadius;
  return {
    x: 500 + (safeLng / 180) * usableRadiusX * Math.cos(latitudeRadians),
    y: 215 - (safeLat / 90) * usableRadiusY,
  };
}

function privatePoint(index: number, total: number) {
  const columns = Math.min(48, Math.max(1, total));
  const rows = Math.ceil(total / columns);
  return {
    x: columns === 1 ? 500 : 78 + (index % columns) * (844 / (columns - 1)),
    y: rows === 1 ? 510 : 494 + Math.floor(index / columns) * (32 / (rows - 1)),
  };
}

function formatPlace(city: NonNullable<FieldItem['identity']['city']>) {
  const countrySuffix = `, ${city.country}`;
  return city.label.toLocaleLowerCase().endsWith(countrySuffix.toLocaleLowerCase())
    ? city.label
    : `${city.label}${countrySuffix}`;
}

function markerLabel(item: FieldItem) {
  const publicCity = item.identity.status === 'registered' ? item.identity.city : null;
  const place = publicCity
    ? formatPlace(publicCity)
    : 'place private or not recorded';
  const ordinal = item.identity.ordinal === null ? '' : `, Founding Light ${item.identity.ordinal}`;
  return `${item.title}, ${item.identity.editionLabel ?? 'Catalog work'}, ${place}${ordinal}`;
}

export default function FieldMap({ items }: { items: readonly FilteredFieldItem[] }) {
  const componentId = useId();
  const titleId = `${componentId}-collector-field-map-title`;
  const descriptionId = `${componentId}-collector-field-map-description`;
  const worldId = `${componentId}-collector-field-world`;
  const worldClipId = `${componentId}-collector-field-world-clip`;
  let privateIndex = 0;
  const privateTotal = items.filter(({ item }) => (
    item.identity.status !== 'registered' || !item.identity.city
  )).length;
  return (
    <figure className="collector-field__stage">
      <svg
        className="collector-field__map"
        viewBox="0 0 1000 580"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>Collector world field</title>
        <desc id={descriptionId}>
          Recorded public places appear on the world grid. Private and unrecorded places rest on a separate horizon below it.
        </desc>
        <defs>
          <radialGradient id={worldId} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#332a20" stopOpacity="0.74" />
            <stop offset="76%" stopColor="#18130f" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#0f0d0b" stopOpacity="0.3" />
          </radialGradient>
          <clipPath id={worldClipId}>
            <ellipse cx="500" cy="215" rx="438" ry="175" />
          </clipPath>
        </defs>
        <ellipse cx="500" cy="215" rx="438" ry="175" fill={`url(#${worldId})`} className="collector-field__graticule" />
        <g clipPath={`url(#${worldClipId})`} className="collector-field__graticule">
          <path d="M62 98 Q500 208 938 98 M62 156 Q500 214 938 156 M62 215 H938 M62 274 Q500 216 938 274 M62 332 Q500 222 938 332" />
          <path d="M208 40 Q355 215 208 390 M354 40 Q428 215 354 390 M500 40 V390 M646 40 Q572 215 646 390 M792 40 Q645 215 792 390" />
          <path className="collector-field__equator" d="M62 215 H938" />
        </g>
        <text x="62" y="36" className="collector-field__map-label">Recorded public place</text>
        <rect x="62" y="438" width="876" height="102" rx="2" className="collector-field__horizon" />
        <text x="74" y="472" className="collector-field__map-label">Place private or not recorded</text>
        {items.map(({ item, matches }) => {
          const visual = markerPresentation(item, matches);
          const publicCity = item.identity.status === 'registered' ? item.identity.city : null;
          const position = publicCity
            ? locationPoint(publicCity.lat, publicCity.lng, visual.radius + 6)
            : privatePoint(privateIndex++, privateTotal);
          const color = FIELD_LIGHT_COLOR;
          return (
            <g
              key={item.key}
              className="collector-field__marker"
              data-field-key={item.key}
              data-field-match={String(matches)}
              opacity={visual.opacity}
              style={{ color }}
            >
              <title>{markerLabel(item)}</title>
              <circle cx={position.x} cy={position.y} r={visual.radius + 6} fill={color} opacity="0.12" />
              <circle
                className="collector-field__marker-core"
                cx={position.x}
                cy={position.y}
                r={visual.radius}
                fill={color}
                stroke="#fff6e8"
                strokeOpacity="0.65"
                strokeWidth="0.8"
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="collector-field__map-legend collector-field__state-line">
        <span>Recorded public place</span>
        <span>Private or unrecorded place</span>
      </figcaption>
    </figure>
  );
}
