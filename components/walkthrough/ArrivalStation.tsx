/**
 * The one arrival station for the guided walkthrough: mounts the built
 * vault arrival (`components/collector/vaultArrival.tsx`) inside its own
 * 390 x 844 espresso frame, with a quiet replay control, since Adrian will
 * watch it repeatedly. It carries `WALK.codetrue` itself — the demo's own
 * sample piece, "Earth's Breath" — the same screen the demo shell and a
 * real unlock both dress, never a copy of it.
 *
 * Continue and the fork question are inert here: there is no shell behind
 * this study to point anywhere, so pressing either admits as much in a
 * quiet line rather than doing nothing silently.
 *
 * Simplified from the three-variant study (`ArrivalVariant` a/b/c) once
 * Adrian's ruling settled on the one true arrival: the glowing dot, not a
 * vector, not a ring, not a light bar (2026-08-20). The chapter that mounts
 * this (components/walkthrough/chapters.ts, id 'arrival-choose') now names
 * exactly one station, so `ArrivalVariant` narrows to a single literal
 * rather than disappearing outright — Walkthrough.tsx (owned elsewhere)
 * still reads `chapter.stations[stationIndex].variant` to pass it through.
 */

import React, { useState } from 'react';
import { C, F } from '../collector/tokens';
import { MARKS_DEFAULT, PLACEHOLDERS } from '../collector/copy';
import { CeremonyStyles } from '../ceremony/styles';
import { WALK } from '../collector/walk';
import { VaultArrival } from '../collector/vaultArrival';

export type ArrivalVariant = 'true';

/** the walk.tsx idiom: unwritten copy, registered so it can never reach
 *  Adrian disguised as finished words. T3-COPY: hoist into copy.ts. */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/** what an inert Continue or fork press admits to being, in this study
 *  alone: there is no shell behind it to send anywhere */
const PH_CONTINUE_LINE = ph('The walk would continue from here.');

const ArrivalStation: React.FC<{ variant: ArrivalVariant }> = () => {
  const [run, setRun] = useState(0);
  const [pressed, setPressed] = useState(false);
  const replay = () => {
    setPressed(false);
    setRun(r => r + 1);
  };

  return (
    <div
      className="collector-root"
      data-marks={MARKS_DEFAULT ? '1' : '0'}
      style={{ display: 'flex', justifyContent: 'center' }}
    >
      <CeremonyStyles />
      <div
        style={{
          position: 'relative',
          width: 390,
          height: 844,
          maxWidth: '100%',
          boxSizing: 'border-box',
          borderRadius: 34,
          overflow: 'hidden',
          background: C.ground,
          border: `1px solid ${C.hairStrong}`,
        }}
      >
        <div key={run} style={{ position: 'absolute', inset: 0 }}>
          <VaultArrival play onGo={() => setPressed(true)} screen={WALK.codetrue} />
        </div>

        {pressed && (
          <div
            style={{
              position: 'absolute',
              left: 30,
              right: 30,
              bottom: 10,
              textAlign: 'right',
              fontFamily: F.body,
              fontStyle: 'italic',
              fontSize: 11.5,
              color: C.inkGhost,
              pointerEvents: 'none',
            }}
          >
            {PH_CONTINUE_LINE}
          </div>
        )}

        <button
          type="button"
          onClick={replay}
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            zIndex: 9,
            background: 'none',
            border: 0,
            cursor: 'pointer',
            padding: '4px 2px',
            fontFamily: F.label,
            fontSize: 9,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: C.inkGhost,
          }}
        >
          Replay
        </button>
      </div>
    </div>
  );
};

export default ArrivalStation;
