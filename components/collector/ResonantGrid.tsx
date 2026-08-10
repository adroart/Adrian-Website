/**
 * The Resonant Grid: every registered piece, at city level, never an address.
 *
 * A flat world in hairlines on an equirectangular projection, so the viewBox is
 * the coordinate system itself: x = longitude + 180, y = 90 - latitude. Every
 * light therefore sits where it belongs with no projection maths.
 *
 * PLACEHOLDER GEOMETRY, and it is the one graphic in this shell that is not the
 * real thing. The design doc renders this from real coastline data: d3 plus
 * topojson plus world-atlas, loaded from a CDN inside an iframe. None of those
 * are dependencies here, and adding three to draw one map is a decision rather
 * than a detail. The coastlines below are hand-drawn at a coarse resolution to
 * hold the composition; the graticule, the light placement, and every style
 * value are the design doc's own.
 *
 * The privacy law this surface exists to keep: a light shows the city and
 * nothing finer, and where a place is too small to be anonymous it shows the
 * region instead.
 */

import React from 'react';

/** [longitude, latitude, lit] — lit lights are registered pieces. */
const LIGHTS: [number, number, 0 | 1][] = [
  [-122.8, 38.4, 1], // Sonoma County, this piece
  [-9.14, 38.72, 1], // Lisbon
  [5.32, 60.39, 1], // Bergen
  [135.77, 35.01, 1], // Kyoto
  [-74.0, 40.71, 0],
  [-0.13, 51.51, 0],
  [13.4, 52.52, 0],
  [-99.13, 19.43, 0],
  [-46.63, -23.55, 0],
  [18.42, -33.92, 0],
  [36.82, -1.29, 0],
  [55.27, 25.2, 0],
  [72.88, 19.08, 0],
  [103.82, 1.35, 0],
  [151.21, -33.87, 0],
  [174.76, -36.85, 0],
  [-123.12, 49.28, 0],
  [-70.65, -33.46, 0],
  [-21.94, 64.15, 0],
  [2.35, 48.86, 0],
  [-79.38, 43.65, 0],
  [116.4, 39.9, 0],
  [28.05, -26.2, 0],
  [-58.38, -34.6, 0],
];

/** coarse coastlines, in degrees, drawn straight into the projection */
const LAND = [
  // North America
  'M -168 66 L -156 71 L -128 70 L -95 74 L -80 73 L -61 68 L -56 51 L -66 45 L -76 35 L -81 26 L -97 26 L -110 23 L -117 32 L -124 40 L -125 49 L -135 58 L -150 61 L -163 59 Z',
  // Greenland
  'M -55 60 L -30 60 L -20 70 L -25 82 L -50 83 L -60 76 Z',
  // South America
  'M -81 8 L -60 11 L -50 0 L -35 -6 L -38 -22 L -48 -33 L -58 -40 L -66 -55 L -74 -52 L -72 -38 L -76 -18 L -81 -5 Z',
  // Europe and Asia
  'M -10 36 L 0 44 L 10 38 L 20 40 L 30 37 L 36 36 L 45 40 L 50 27 L 60 25 L 68 24 L 78 8 L 80 15 L 92 21 L 100 14 L 105 10 L 110 20 L 122 31 L 127 43 L 135 48 L 143 53 L 160 60 L 172 65 L 180 68 L 160 72 L 130 74 L 100 78 L 70 73 L 50 70 L 30 70 L 10 64 L 5 58 L 12 55 L 8 48 L -5 43 Z',
  // Africa
  'M -17 15 L 0 5 L 12 4 L 10 -1 L 14 -12 L 12 -18 L 18 -35 L 27 -34 L 33 -26 L 40 -15 L 43 -12 L 51 -1 L 43 11 L 40 15 L 34 30 L 20 32 L 10 37 L -6 36 L -16 22 Z',
  // Australia
  'M 113 -22 L 122 -18 L 130 -12 L 137 -11 L 143 -12 L 146 -18 L 151 -24 L 153 -30 L 150 -37 L 143 -39 L 135 -35 L 129 -32 L 118 -35 L 114 -28 Z',
];

type Props = { height?: number };

export const ResonantGrid: React.FC<Props> = ({ height = 231 }) => (
  <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 11', height: height ? undefined : height }}>
    <svg viewBox="0 0 360 180" width="100%" height="100%" style={{ display: 'block' }} aria-label="The Resonant Grid" role="img">
      {/* the graticule */}
      <g fill="none" stroke="rgba(237,233,226,.09)" strokeWidth={0.5}>
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`m${i}`} x1={i * 36} y1={0} x2={i * 36} y2={180} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`p${i}`} x1={0} y1={i * 30} x2={360} y2={i * 30} />
        ))}
      </g>

      {/* the land, in hairlines */}
      <g fill="none" stroke="rgba(237,233,226,.34)" strokeWidth={0.7} strokeLinejoin="round">
        {LAND.map((d, i) => (
          <path
            key={i}
            d={d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, lon: string, lat: string) =>
              `${Number(lon) + 180} ${90 - Number(lat)}`,
            )}
          />
        ))}
      </g>

      {/* the lights */}
      <g>
        {LIGHTS.map(([lon, lat, on], i) => (
          <circle
            key={i}
            cx={lon + 180}
            cy={90 - lat}
            r={on ? 2.6 : 1.7}
            fill="#f0d79a"
            opacity={on ? 1 : 0.5}
            style={on ? { filter: 'drop-shadow(0 0 5px rgba(240,215,154,.8))' } : undefined}
          />
        ))}
      </g>
    </svg>
  </div>
);
