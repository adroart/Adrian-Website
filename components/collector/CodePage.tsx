/**
 * The code, and the vault.
 *
 * Sixteen characters, shown as two rows of eight. An unbroken run of sixteen is
 * unreadable and, more importantly, unproofable: a person is copying it off the
 * underside of a physical object and needs to check their work by eye.
 *
 * The unlock is its own page, reached by pressing Begin. The rows, the dream and
 * the status give way; the field is what the page is for.
 *
 * THE LAST CHARACTER IS THE PRESS. No second button. The code is either true or
 * it is not, so there is nothing to confirm. But there is a deliberate pause
 * before it fires: at sixteen characters a mistype is likely, and firing the
 * instant the last character lands would reject someone mid-correction, before
 * they had seen what they typed.
 *
 * The motion, LOCKED and Adrian's spec: the characters resolve one at a time,
 * like tumblers finding their places, a pause, one soft click as the last one
 * seats. Then the screen itself opens like a vault and the light carries you
 * through to "The code is true". Being carried through is the reward. The whole
 * passage two to four seconds, never longer, and this is the biggest moment of
 * motion in the flow: nothing after it competes with its scale.
 *
 * IN THIS SHELL the piece's code is sixteen ones, and a code of sixteen nines
 * runs the wrong-code state. Nothing is checked against a server.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { C, F } from './tokens';
import { COPY, PIECE } from './copy';
import { Brass, Eyebrow, Ground, TLink } from './ui';

/** how long the piece waits after the sixteenth character before it answers */
const PAUSE_MS = 620;

type Props = {
  onTrue: () => void;
  onNoCode?: () => void;
  onGift?: () => void;
  onBack?: () => void;
};

export const CodePage: React.FC<Props> = ({ onTrue, onNoCode, onGift, onBack }) => {
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  const [vault, setVault] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const filled = code.length;

  const answer = useCallback(
    (value: string) => {
      if (value === PIECE.code) {
        setVault(true);
        /* the vault carries you through: no button press after the click */
        window.setTimeout(onTrue, 1300);
      } else {
        setWrong(true);
      }
    },
    [onTrue],
  );

  useEffect(() => {
    if (filled !== 16 || wrong || vault) return;
    const t = window.setTimeout(() => answer(code), PAUSE_MS);
    return () => window.clearTimeout(t);
  }, [code, filled, wrong, vault, answer]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const type = (raw: string) => {
    if (wrong) return;
    setCode(raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
  };

  const retry = () => {
    setWrong(false);
    setCode('');
    input.current?.focus();
  };

  const rowOne = code.slice(0, 8).padEnd(8, ' ').split('');
  const rowTwo = code.slice(8, 16).padEnd(8, ' ').split('');

  /* the readout is mechanical: how far the code has been read, never how close
     the person is and never how many times they have tried. On a wrong code it
     goes away entirely rather than repeating the headline back. */
  const lockState =
    filled === 16 ? COPY.code.stateTrue : filled > 0 ? COPY.code.stateReading : COPY.code.stateWaiting;

  return (
    <Ground light="j" pad="44px 30px 30px">
      {vault && <Vault />}

      {/* the piece's name, and the way back to its page. Pressing Begin is
          easy to do by accident, and nothing has happened yet. */}
      <div
        style={{
          position: 'relative',
          flex: 'none',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <Eyebrow>{PIECE.name}</Eyebrow>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'none',
            border: 0,
            cursor: 'pointer',
            fontFamily: F.body,
            fontSize: 13.5,
            color: C.inkQuiet,
            padding: 0,
          }}
        >
          Back
        </button>
      </div>
      <h1
        style={{
          position: 'relative',
          margin: '14px 0 0',
          flex: 'none',
          fontFamily: F.display,
          fontWeight: 300,
          fontSize: 31,
          lineHeight: 1.1,
          color: C.ink,
        }}
      >
        {wrong ? COPY.code.wrongHead : 'The code'}
      </h1>

      <div
        style={{
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 14,
            fontFamily: F.mono,
            fontSize: 9.5,
            letterSpacing: '.2em',
            textTransform: 'uppercase',
            color: C.inkQuiet,
            visibility: wrong ? 'hidden' : 'visible',
          }}
        >
          <span style={{ width: 22, height: 1, background: C.hairStrong, display: 'block' }} />
          <span>{lockState}</span>
          <span style={{ width: 22, height: 1, background: C.hairStrong, display: 'block' }} />
        </div>

        {/* the plate the code is read into. Tapping anywhere on it takes the
            cursor, because a person is holding a physical object in one hand. */}
        <div
          onClick={() => input.current?.focus()}
          style={{
            position: 'relative',
            flex: 'none',
            marginTop: 26,
            width: '100%',
            padding: '26px 16px 22px',
            boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.16)',
            background: 'linear-gradient(180deg,rgba(0,0,0,.34),rgba(0,0,0,.12))',
          }}
        >
          {[
            { left: 0, top: 0, bl: 'top', br: 'left' },
            { right: 0, top: 0 },
            { left: 0, bottom: 0 },
            { right: 0, bottom: 0 },
          ].map((corner, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                width: 11,
                height: 11,
                display: 'block',
                left: i === 0 || i === 2 ? 0 : undefined,
                right: i === 1 || i === 3 ? 0 : undefined,
                top: i < 2 ? 0 : undefined,
                bottom: i >= 2 ? 0 : undefined,
                borderTop: i < 2 ? '1px solid rgba(237,233,226,.42)' : undefined,
                borderBottom: i >= 2 ? '1px solid rgba(237,233,226,.42)' : undefined,
                borderLeft: i === 0 || i === 2 ? '1px solid rgba(237,233,226,.42)' : undefined,
                borderRight: i === 1 || i === 3 ? '1px solid rgba(237,233,226,.42)' : undefined,
              }}
            />
          ))}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[rowOne, rowTwo].map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {row.map((glyph, i) => {
                  const index = r * 8 + i;
                  const on = index < filled;
                  return (
                    <span
                      key={i}
                      style={{
                        flex: 1,
                        height: 44,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: wrong ? 'rgba(196,90,60,.06)' : on ? 'rgba(0,0,0,.42)' : 'rgba(0,0,0,.3)',
                        boxShadow: `inset 0 0 0 1px ${wrong ? C.wrongEdge : on ? 'rgba(237,233,226,.22)' : 'rgba(237,233,226,.1)'}, inset 0 2px 4px rgba(0,0,0,.55)`,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          fontFamily: F.mono,
                          fontSize: 17,
                          color: wrong ? C.wrong : C.inkBody,
                          animation: on && !wrong ? 'tumble .22s cubic-bezier(.22,.61,.36,1) both' : undefined,
                        }}
                      >
                        {glyph.trim()}
                      </span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>

          {/* the tumbler readout. It states how far the code has been read, not
              how close the person is or how many times they have tried. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
            <span
              style={{
                flex: 1,
                height: 3,
                background: 'rgba(0,0,0,.5)',
                boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.1)',
                overflow: 'hidden',
                display: 'block',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${(filled / 16) * 100}%`,
                  background: 'repeating-linear-gradient(90deg,rgba(237,233,226,.5) 0 3px,transparent 3px 6px)',
                }}
              />
            </span>
            <span style={{ fontFamily: F.mono, fontSize: 9.5, letterSpacing: '.14em', color: C.inkQuiet, flex: 'none' }}>
              {filled} / 16
            </span>
          </div>

          <input
            ref={input}
            value={code}
            onChange={e => type(e.target.value)}
            maxLength={16}
            autoComplete="off"
            spellCheck={false}
            aria-label="The code"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              background: 'none',
              border: 0,
              outline: 0,
              color: 'transparent',
              caretColor: 'transparent',
              WebkitTextFillColor: 'transparent',
              fontSize: 16,
              textIndent: -9999,
              cursor: 'text',
            }}
          />
        </div>

        {wrong ? (
          <p style={{ margin: '22px 0 0', fontFamily: F.body, fontSize: 13.5, lineHeight: 1.7, color: C.inkBody, maxWidth: '32ch' }}>
            {COPY.code.wrongBody}
          </p>
        ) : (
          <>
            <p style={{ margin: '22px 0 0', fontFamily: F.body, fontSize: 13, lineHeight: 1.66, color: C.inkBody, maxWidth: '30ch' }}>
              {COPY.code.help}
            </p>
            <p
              style={{
                margin: '9px 0 0',
                fontFamily: F.mono,
                fontSize: 10,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: C.inkQuiet,
                maxWidth: '30ch',
              }}
            >
              {COPY.code.warn}
            </p>
          </>
        )}
      </div>

      {/* the two doors off this page. Side by side they each wrap to three
          lines at 390, so before the code is answered they stack and centre,
          and only the wrong-code state pairs a link with the brass. */}
      <div
        style={{
          position: 'relative',
          flex: 'none',
          marginTop: 'auto',
          paddingTop: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: wrong ? 'space-between' : 'center',
          flexDirection: wrong ? 'row' : 'column',
          gap: wrong ? 16 : 2,
        }}
      >
        {wrong ? (
          <>
            <TLink onClick={onNoCode}>{COPY.code.contact}</TLink>
            <Brass onClick={retry}>{COPY.code.tryAgain}</Brass>
          </>
        ) : (
          <>
            <TLink onClick={onNoCode}>{COPY.code.noCode}</TLink>
            <TLink onClick={onGift ?? onBack}>{COPY.code.gift}</TLink>
          </>
        )}
      </div>
    </Ground>
  );
};

/**
 * The vault. The dark ground parts and warm light comes through the opening,
 * and the light carries you onto the next page.
 *
 * This is the one big motion in the flow. Reduced motion gets a gentle fade,
 * handled globally in `styles.tsx`.
 */
const Vault: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none' }}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 1,
        transform: 'translateY(-50%)',
        background: 'rgba(237,233,226,.75)',
        animation: 'seam .5s cubic-bezier(.22,.61,.36,1) forwards',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 70,
        transform: 'translateY(-50%)',
        opacity: 0,
        animation: 'vaultLight .8s cubic-bezier(.22,.61,.36,1) .1s forwards',
        background: 'linear-gradient(180deg,transparent,rgba(237,233,226,.14) 46%,rgba(237,233,226,.14) 54%,transparent)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 210,
        height: 210,
        transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.2)',
        opacity: 0,
        animation: 'ringTurn 1.1s cubic-bezier(.65,0,.35,1) forwards',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        height: '50%',
        background: C.ground,
        borderBottom: '1px solid rgba(237,233,226,.4)',
        boxShadow: '0 6px 20px rgba(0,0,0,.6)',
        animation: 'vaultTop 1.15s cubic-bezier(.65,0,.35,1) forwards',
      }}
    >
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 9, height: 1, background: 'rgba(237,233,226,.1)', display: 'block' }} />
      <span style={{ position: 'absolute', left: 24, bottom: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
      <span style={{ position: 'absolute', right: 24, bottom: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
    </div>
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%',
        background: C.ground,
        borderTop: '1px solid rgba(237,233,226,.4)',
        boxShadow: '0 -6px 20px rgba(0,0,0,.6)',
        animation: 'vaultBot 1.15s cubic-bezier(.65,0,.35,1) forwards',
      }}
    >
      <span style={{ position: 'absolute', left: 0, right: 0, top: 9, height: 1, background: 'rgba(237,233,226,.1)', display: 'block' }} />
      <span style={{ position: 'absolute', left: 24, top: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
      <span style={{ position: 'absolute', right: 24, top: 20, width: 44, height: 3, background: 'rgba(237,233,226,.16)', display: 'block' }} />
    </div>
  </div>
);
