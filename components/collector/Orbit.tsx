/**
 * The light.
 *
 * Two parts, and they never combine into a score:
 *   the long glow holds everything ever placed and never fades;
 *   the near light brightens when something is placed and dims over months of
 *   quiet. Nobody who was ever devoted looks abandoned.
 *
 * The rule the orbit draws: one star when the piece is registered, one body for
 * every thing placed in it, and a new ring only once the ring inside it is
 * full. Ring capacities run 3, 5, 7, 9, so a dozen placed reads as two full
 * rings and four on the third, exactly as the design doc shows it.
 *
 * There is no count, no bar, no percentage, and no line that asks. The size
 * itself is the record. Two caretakers can never compare and one feel behind,
 * because there is no shared scale: years held deepen the ground, what is
 * placed brightens the light, and neither is ahead of the other.
 *
 * PICK TO CONFIRM: the design doc offers three sizings (8a fills the band, 8b
 * held in from the edges, 8c grows with the piece). This implements 8c, whose
 * own caption argues for it: an empty piece is a pinpoint, a full one fills the
 * band, and the size itself is the record. The final section of the design file
 * would have settled it, but that section is past the read cap.
 */

import React from 'react';

/** how many bodies each ring holds before the next ring appears */
const capacity = (ring: number): number => 2 * ring + 3;

/** ring diameters as a percentage of the band, widening as rings are added */
const SIZES: Record<number, number[]> = {
  0: [],
  1: [26],
  2: [24, 52],
  3: [22, 46, 78],
  4: [20, 40, 64, 92],
};

const ringSizes = (n: number): number[] => {
  if (SIZES[n]) return SIZES[n];
  return Array.from({ length: n }, (_, i) => 18 + ((92 - 18) * (i + 1)) / n);
};

const HAIR = [0.26, 0.2, 0.15, 0.12];
const SPIN = ['spinSlow', 'spinRev', 'spinSlow', 'spinRev'];

/** Divide what has been placed into rings, filling from the inside out. */
const toRings = (placed: number): number[] => {
  const rings: number[] = [];
  let left = placed;
  let n = 0;
  while (left > 0 && n < 4) {
    const cap = capacity(n);
    rings.push(Math.min(left, cap));
    left -= cap;
    n += 1;
  }
  return rings;
};

type Props = {
  /** everything ever placed. The long glow: it never fades. */
  placed: number;
  /**
   * the near light, 0 to 1. Brightens when something is placed and dims over
   * months of quiet. It sets how fast the rings turn and how strongly the core
   * burns, and it never reaches zero.
   */
  near?: number;
};

export const Orbit: React.FC<Props> = ({ placed, near = 1 }) => {
  const rings = toRings(placed);
  /* a long-tended piece turns a little faster and burns a little brighter.
     The floor is deliberate: a quiet piece is still lit. */
  const pace = 1.6 - 0.6 * near;
  const core = 0.55 + 0.45 * near;
  const halo = 0.06 + 0.09 * near;

  return (
    <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', aspectRatio: '1 / 1', transform: 'translateX(-50%)' }}>
      {/* the long glow: everything ever placed, and it never fades */}
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '86%',
          aspectRatio: '1 / 1',
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          pointerEvents: 'none',
          background: `radial-gradient(circle,rgba(240,215,154,${halo}) 0%,rgba(240,215,154,${halo * 0.3}) 44%,transparent 72%)`,
        }}
      />

      {rings.map((bodies, i) => {
        const size = ringSizes(rings.length)[i];
        const seconds = Math.round((26 + i * 16) * pace);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${size}%`,
              aspectRatio: '1 / 1',
              transform: 'translate(-50%,-50%)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: `1px solid rgba(240,215,154,${HAIR[i] ?? 0.12})`,
                animation: `${SPIN[i % SPIN.length]} ${seconds}s linear infinite`,
              }}
            >
              {Array.from({ length: bodies }, (_, b) => (
                <div key={b} style={{ position: 'absolute', inset: 0, transform: `rotate(${(360 / bodies) * b}deg)` }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: 0,
                      width: i === 0 ? 5 : 4,
                      height: i === 0 ? 5 : 4,
                      borderRadius: '50%',
                      background: '#f0d79a',
                      boxShadow: '0 0 12px 4px rgba(240,215,154,.42)',
                      transform: 'translate(-50%,-50%)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* the star: it lights the moment the piece is registered, and it is the
          one body that is there before anything has been placed */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '6%',
          aspectRatio: '1 / 1',
          transform: 'translate(-50%,-50%)',
          opacity: core,
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: '-130%',
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background:
              'radial-gradient(circle,rgba(240,215,154,.16) 0%,rgba(240,215,154,.07) 20%,rgba(240,215,154,.025) 38%,rgba(240,215,154,0) 64%)',
            filter: 'blur(5px)',
            animation: `fed ${Math.round(5.2 * pace)}s ease-in-out infinite`,
          }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            mixBlendMode: 'screen',
            background:
              'radial-gradient(circle,#fffaf0 0%,#fdf3d9 16%,rgba(240,215,154,.6) 36%,rgba(240,215,154,.22) 56%,rgba(240,215,154,.06) 76%,rgba(240,215,154,0) 94%)',
            animation: `fed ${Math.round(5.2 * pace)}s ease-in-out infinite`,
          }}
        />
      </div>
    </div>
  );
};

/** The single star, on its own: ignition, and the empty piece. */
export const Star: React.FC<{ size?: number }> = ({ size = 230 }) => (
  <div style={{ position: 'relative', width: size, height: size, display: 'grid', placeItems: 'center', animation: 'ignite 2.6s cubic-bezier(.22,.61,.36,1) both' }}>
    <span
      style={{
        position: 'absolute',
        width: size * 0.96,
        height: size * 0.96,
        borderRadius: '50%',
        mixBlendMode: 'screen',
        background:
          'radial-gradient(circle,rgba(240,215,154,.16) 0%,rgba(240,215,154,.07) 20%,rgba(240,215,154,.025) 38%,rgba(240,215,154,0) 64%)',
        filter: 'blur(5px)',
        animation: 'fed 5.2s ease-in-out infinite',
      }}
    />
    <span
      style={{
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: '50%',
        mixBlendMode: 'screen',
        background:
          'radial-gradient(circle,#fffaf0 0%,#fdf3d9 16%,rgba(240,215,154,.6) 36%,rgba(240,215,154,.22) 56%,rgba(240,215,154,.06) 76%,rgba(240,215,154,0) 94%)',
        animation: 'fed 5.2s ease-in-out infinite',
      }}
    />
  </div>
);
