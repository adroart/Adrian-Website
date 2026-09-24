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
 * Adrian's ruling, 2026-08-20 (see collector-screen-wording.md §7): a tap on any
 * already-read box selects it, and typing there replaces just that character
 * and steps forward, keeping every other value — there is no more press on the
 * sixteenth keystroke. At sixteen the `{filled} / 16` readout becomes, in its
 * own slot, a quiet brass press that fires the answer.
 *
 * Every box, read or not, is a real button. An empty/future box has no
 * character of its own to correct, so tapping it simply hands focus back to
 * the ordinary append/paste path, same as tapping anywhere else on the plate
 * — it never sits inert.
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
import { COPY, PIECE, placeholder } from './copy';
import { Brass, Eyebrow, Ground, TLink } from './ui';

/**
 * What a wired submit resolved to. The vault fires ONLY on 'vault' — an
 * actual successful bind — never optimistically on code completion.
 *   vault    the bind answered bound; run the vault and carry through
 *   wrong    the code did not match this piece
 *   handled  the parent routed the journey elsewhere (account bridge, a
 *            pending passing, a quiet retry state); this page is leaving
 */
export type CodeSubmitOutcome =
  | { kind: 'vault' }
  | { kind: 'wrong' }
  | { kind: 'handled' };

type Props = {
  onTrue: () => void;
  onNoCode?: () => void;
  onInvitation?: () => void;
  onGift?: () => void;
  onBack?: () => void;
  /**
   * Wired: answer the completed code against the real registry. When absent,
   * the shell's demo check runs (sixteen ones true, anything else wrong).
   * The typed code goes nowhere but this call — never a URL, a query string,
   * a log, or any storage from this file.
   */
  onSubmit?: (typedCode: string) => Promise<CodeSubmitOutcome>;
  /** the real piece's name for the eyebrow; the demo shows the sample piece */
  pieceName?: string;
  /**
   * A code restored from the account bridge arrives already read: the cells
   * render filled and the existing pause fires the answer, so the vault has
   * its stage on the return passage too.
   */
  initialCode?: string;
  /** land directly on the wrong-code state (a mismatch after account creation) */
  initialWrong?: boolean;
};

export const CodePage: React.FC<Props> = ({
  onTrue,
  onNoCode,
  onInvitation,
  onGift,
  onBack,
  onSubmit,
  pieceName,
  initialCode,
  initialWrong,
}) => {
  const [code, setCode] = useState(() =>
    (initialCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16),
  );
  const [wrong, setWrong] = useState(Boolean(initialWrong));
  const [vault, setVault] = useState(false);
  /* the box currently selected for per-character editing. Set by a tap on an
     already-read box; null is the ordinary append/paste mode. */
  const [editIndex, setEditIndex] = useState<number | null>(null);
  /* whether the hidden input currently holds focus, so the next box to be
     filled can carry a momentary lit treatment while typing is live there. */
  const [inputFocused, setInputFocused] = useState(true);
  const answering = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const filled = code.length;

  const answer = useCallback(
    (value: string) => {
      if (onSubmit) {
        /* wired: the registry answers. Quiet while it does — the tumbler
           readout already reads True; nothing spins. */
        if (answering.current) return;
        answering.current = true;
        void onSubmit(value)
          .then(outcome => {
            if (outcome.kind === 'vault') {
              setVault(true);
              /* the vault carries you through: no button press after the click */
              window.setTimeout(onTrue, 1300);
            } else if (outcome.kind === 'wrong') {
              setWrong(true);
              setEditIndex(null);
            }
            /* 'handled': the parent moved the journey; this page is leaving */
          })
          .catch(() => {
            /* the parent's submit routes its own failures; nothing to show here */
          })
          .finally(() => {
            answering.current = false;
          });
        return;
      }
      if (value === PIECE.code) {
        setVault(true);
        /* the vault carries you through: no button press after the click */
        window.setTimeout(onTrue, 1300);
      } else {
        setWrong(true);
        setEditIndex(null);
      }
    },
    [onSubmit, onTrue],
  );

  useEffect(() => {
    input.current?.focus();
  }, []);

  /* ordinary append/paste path. Only live while nothing is selected for
     per-character editing — a tap on a box owns the keystrokes until it is
     answered by onKeyDown below or the selection is cleared. */
  const type = (raw: string) => {
    if (wrong || editIndex !== null) return;
    setCode(raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16));
  };

  /* a tap on an already-read box: select it, and hand the hidden input's
     next keystroke to the splice-in-place path below. Boxes ahead of what
     has been read carry nothing to edit yet, so they stay inert. */
  const selectBox = (index: number) => {
    if (wrong || vault || index >= filled) return;
    setEditIndex(index);
    input.current?.focus();
  };

  /* a tap on an empty/future box: there is nothing there yet to edit, so it
     behaves like a tap anywhere else on the plate — leave per-character
     editing, if any was active, and hand focus back to the ordinary
     append/paste path at the end of what has been read. */
  const focusAppend = () => {
    if (wrong || vault) return;
    setEditIndex(null);
    input.current?.focus();
  };

  /* Adrian's ruling, 2026-08-20: while a box is selected, a single
     alphanumeric key replaces just that character (after the same A-Z0-9
     normalization the append path uses) and the selection steps forward one
     box, clamped to the last box and cleared once there is nothing further
     already read to continue into. Backspace clears the selected slot
     instead — the characters after it close the gap — and steps back;
     stepping back off the first box leaves editing. Every other key is left
     alone for the browser to handle normally. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (editIndex === null || wrong) return;
    const at = editIndex;
    if (e.key === 'Backspace') {
      e.preventDefault();
      setCode(prev => prev.slice(0, at) + prev.slice(at + 1));
      setEditIndex(at === 0 ? null : at - 1);
      return;
    }
    if (e.key.length !== 1) return;
    const upper = e.key.toUpperCase();
    if (!/^[A-Z0-9]$/.test(upper)) return;
    e.preventDefault();
    setCode(prev => prev.slice(0, at) + upper + prev.slice(at + 1));
    const advanced = at + 1;
    setEditIndex(advanced >= filled ? null : Math.min(advanced, 15));
  };

  const retry = () => {
    setWrong(false);
    setCode('');
    setEditIndex(null);
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
        <Eyebrow>{pieceName ?? PIECE.name}</Eyebrow>
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

          {/* the hidden input below sits absolutely over the whole plate so a
              tap anywhere still focuses it; the boxes now carry real buttons
              of their own, so they need to sit above that overlay in the
              stacking order or the invisible input would eat every tap. */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[rowOne, rowTwo].map((row, r) => (
              <div key={r} style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                {row.map((glyph, i) => {
                  const index = r * 8 + i;
                  const on = index < filled;
                  const selected = editIndex === index;
                  /* the next empty box, while the append path is live there,
                     borrows the same lit treatment as a selected box — a
                     quiet "type here next" without owning any edit state. */
                  const nextUp = !on && !wrong && !vault && editIndex === null && inputFocused && index === filled;
                  const lit = selected || nextUp;
                  const boxStyle: React.CSSProperties = {
                    flex: 1,
                    height: 44,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: wrong
                      ? 'rgba(196,90,60,.06)'
                      : lit
                        ? 'rgba(212,184,138,.1)'
                        : on
                          ? 'rgba(0,0,0,.42)'
                          : 'rgba(0,0,0,.3)',
                    boxShadow: wrong
                      ? `inset 0 0 0 1px ${C.wrongEdge}, inset 0 2px 4px rgba(0,0,0,.55)`
                      : lit
                        ? `inset 0 0 0 1.5px ${C.brassEdge}, inset 0 2px 4px rgba(0,0,0,.55), 0 0 8px rgba(212,184,138,.28)`
                        : on
                          ? 'inset 0 0 0 1px rgba(237,233,226,.22), inset 0 2px 4px rgba(0,0,0,.55)'
                          : 'inset 0 0 0 1px rgba(237,233,226,.1), inset 0 2px 4px rgba(0,0,0,.55)',
                  };
                  const glyphEl = (
                    <span
                      style={{
                        display: 'block',
                        fontFamily: F.mono,
                        fontSize: 17,
                        color: wrong ? C.wrong : selected ? C.brass : C.inkBody,
                        animation: on && !wrong ? 'tumble .22s cubic-bezier(.22,.61,.36,1) both' : undefined,
                      }}
                    >
                      {glyph.trim()}
                    </span>
                  );
                  /* every box is a real, tappable button. An already-read box
                     opens the per-character correction path (selectBox); an
                     empty/future box has no character to edit, so it simply
                     hands focus back to the append/paste path, the same as
                     tapping anywhere else on the plate. Either way the tap is
                     handled here rather than left to bubble, so a native
                     `disabled` state is never used — that would swallow it. */
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => (on ? selectBox(index) : focusAppend())}
                      aria-label={on ? `Edit character ${index + 1} of 16` : `Character ${index + 1} of 16, not yet entered`}
                      aria-pressed={selected}
                      style={{
                        ...boxStyle,
                        margin: 0,
                        border: 0,
                        borderRadius: 0,
                        padding: 0,
                        font: 'inherit',
                        appearance: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {glyphEl}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* the tumbler readout. It states how far the code has been read, not
              how close the person is or how many times they have tried. At
              sixteen it gives up its slot to the unlock press itself: Adrian's
              ruling, 2026-08-20, retires the auto-fire on the last keystroke.
              Same stacking note as the boxes above: the press needs to sit
              above the hidden input's overlay to receive its own tap. */}
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
            {filled === 16 && !wrong && !vault ? (
              <Brass full onClick={() => answer(code)}>
                {placeholder('Unlock')}
              </Brass>
            ) : (
              <>
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
              </>
            )}
          </div>

          <input
            ref={input}
            value={code}
            onChange={e => type(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            maxLength={16}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            /* the code goes nowhere: keep password managers from capturing and
               cloud-syncing it. autoComplete="off" alone is documented to be
               ignored by 1Password / LastPass / Bitwarden, so name each out. */
            data-lpignore="true"
            data-1p-ignore="true"
            data-bwignore="true"
            data-form-type="other"
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
                fontFamily: F.body,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: C.inkQuiet,
                maxWidth: '28ch',
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
            {onInvitation && <TLink onClick={onInvitation}>Invitation</TLink>}
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
