/**
 * The custody envelope ceremony: the one control that turns the standing
 * warning on the Succession desk (components/admin/Succession.tsx) into a
 * real file. No envelope has ever been made, because the only way to build
 * one was a Terminal script (~/.claude/commands/awcustody.md), and that
 * friction meant it never happened.
 *
 * Self-contained on purpose: Succession.tsx is under active, separate
 * development (new fields, new warnings) and this component is meant to
 * drop into it as one import and one render line, so the two files never
 * fight over the same lines in a merge. Everything the ceremony needs, its
 * own state, its own error copy, its own fetch, lives here.
 *
 * The flow:
 *   1. POST /api/admin/custody-keys (functions/api/admin/custody-keys.js),
 *      behind the registry step-up unlock already, so this component does
 *      not re-check that; it is only ever rendered from a page that already
 *      gates on it. The response is the bare `CustodyKeys` shape, no `ok`
 *      wrapper.
 *   2. Generate a fresh passphrase locally (utils/custodyPassphrase.ts,
 *      dynamically imported so its bundled wordlist is not paid for until
 *      this ceremony actually starts).
 *   3. Show the words once, the way a wallet shows a seed phrase.
 *   4. Ask him to retype two of them, chosen at random, so a passphrase
 *      nobody actually recorded cannot slip through.
 *   5. Encrypt with buildCustodyEnvelope (utils/custodyEnvelope.ts, only
 *      ever imported here, never modified) and save custody-envelope.json
 *      via a Blob download.
 *   6. Call onEnvelopeMade(date), if given, and stop. This component never
 *      writes to the succession settings itself; the caller decides where
 *      that date belongs.
 *
 * The passphrase and the keys never leave the browser: no fetch body, no
 * URL, no localStorage/sessionStorage, no log. Both are cleared from this
 * component's state the moment the envelope has been built and downloaded.
 */
import React, { useState } from 'react';
import { AdminSection, adminUI } from './AdminPage';
import AdminAside from './AdminAside';
import { buildCustodyEnvelope, validateCustodyKeys, type CustodyKeys } from '../../utils/custodyEnvelope';

const { Body, Brass, Field, Note, Quiet } = adminUI;

export type CustodyEnvelopeProps = {
  /**
   * Called once, right after custody-envelope.json has been built and
   * downloaded, with today's date as YYYY-MM-DD. Optional: a caller with
   * nowhere to put the date yet can simply omit it. This component never
   * reaches into any settings save itself.
   */
  onEnvelopeMade?: (date: string) => void;
};

type Stage = 'idle' | 'passphrase' | 'verify' | 'done';

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The handful of error codes /api/admin/custody-keys can actually return
 * (functions/api/admin/custody-keys.js: requireRegistryUnlock,
 * requireDb, the recovery-export-not-configured check, and its own audit
 * write), plus a fallback for any code shaped like a complete sentence
 * already (functions/api/_lib/keeper.js's migrationNotApplied returns one),
 * which is more useful shown as-is than hidden behind a generic message.
 */
function remedyForCustodyKeys(errorCode: string, fallback: string): string {
  if (errorCode === 'registry_recovery_export_not_configured') {
    return 'The encrypted archive is not configured yet. See docs/finish-setup.md for REGISTRY_RECOVERY_EXPORT_KEY and REGISTRY_RECOVERY_EXPORT_KEY_ID.';
  }
  if (errorCode === 'registry_locked') return 'Private registry access expired. Unlock it again.';
  if (errorCode === 'registry_unlock_not_configured') return 'Registry unlock is not configured on the server yet.';
  if (errorCode === 'audit_unavailable') return 'The audit log could not be written, so the keys were not returned. Nothing was exported.';
  if (errorCode && /[.!?]$/.test(errorCode.trim())) return errorCode;
  return fallback;
}

function downloadJsonBlob(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

const CustodyEnvelope: React.FC<CustodyEnvelopeProps> = ({ onEnvelopeMade }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [custodyKeys, setCustodyKeys] = useState<CustodyKeys | null>(null);
  const [words, setWords] = useState<string[] | null>(null);
  const [entropyBits, setEntropyBits] = useState<number | null>(null);
  const [verifyIndices, setVerifyIndices] = useState<[number, number] | null>(null);
  const [verifyInputA, setVerifyInputA] = useState('');
  const [verifyInputB, setVerifyInputB] = useState('');
  const [verifyError, setVerifyError] = useState('');

  const reset = () => {
    setStage('idle');
    setBusy(false);
    setError('');
    setCustodyKeys(null);
    setWords(null);
    setEntropyBits(null);
    setVerifyIndices(null);
    setVerifyInputA('');
    setVerifyInputB('');
    setVerifyError('');
  };

  /** Steps 1 and 2: read the keys, then generate a fresh passphrase. */
  const begin = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/custody-keys', { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorCode = typeof (data as { error?: unknown } | null)?.error === 'string'
          ? (data as { error: string }).error : '';
        throw new Error(remedyForCustodyKeys(errorCode, `Could not read the recovery keys (${response.status}).`));
      }
      let keys: CustodyKeys;
      try {
        validateCustodyKeys(data);
        keys = data as CustodyKeys;
      } catch {
        throw new Error('The recovery keys came back in a shape this page does not recognize.');
      }
      // Lazy-loaded here, and only here: the wordlist bundled inside
      // utils/custodyPassphrase.ts stays out of this component's own chunk
      // until a passphrase is actually being generated.
      const { generateCustodyPassphrase } = await import('../../utils/custodyPassphrase');
      const passphrase = generateCustodyPassphrase();
      setCustodyKeys(keys);
      setWords(passphrase.words);
      setEntropyBits(passphrase.entropyBits);
      setStage('passphrase');
    } catch (caught) {
      setError(messageFor(caught, 'Could not begin building the envelope.'));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Step 4: pick two of the six words at random and ask him to retype them.
   * A checkbox proves nothing; retyping two words proves the paper copy
   * exists and is legible. Two rather than one balances that proof against
   * turning the screen into a chore; six would just be reading the screen
   * back to itself.
   */
  const proceedToVerify = async () => {
    if (!words) return;
    const { randomWordlistIndex } = await import('../../utils/custodyPassphrase');
    const first = randomWordlistIndex(words.length);
    let second = randomWordlistIndex(words.length);
    while (second === first) second = randomWordlistIndex(words.length);
    setVerifyIndices(first < second ? [first, second] : [second, first]);
    setVerifyInputA('');
    setVerifyInputB('');
    setVerifyError('');
    setStage('verify');
  };

  const backToPassphrase = () => {
    setVerifyInputA('');
    setVerifyInputB('');
    setVerifyError('');
    setStage('passphrase');
  };

  /** Step 5: encrypt and download. Step 6: report the date, nothing else. */
  const confirmAndBuild = async () => {
    if (!words || !verifyIndices || !custodyKeys) return;
    const [first, second] = verifyIndices;
    const normalize = (value: string) => value.trim().toLowerCase();
    if (normalize(verifyInputA) !== words[first] || normalize(verifyInputB) !== words[second]) {
      setVerifyError("That doesn't match what you wrote down. Check the paper copy and try again.");
      return;
    }
    setVerifyError('');
    setBusy(true);
    setError('');
    try {
      const passphrase = words.join(' ');
      const envelope = await buildCustodyEnvelope({ passphrase, keys: custodyKeys });
      downloadJsonBlob('custody-envelope.json', envelope);
      const madeAt = new Date().toISOString().slice(0, 10);
      // The passphrase and the keys have done their one job. Drop them from
      // state now rather than let them sit around for the rest of the
      // session.
      setWords(null);
      setEntropyBits(null);
      setCustodyKeys(null);
      setVerifyIndices(null);
      setVerifyInputA('');
      setVerifyInputB('');
      setStage('done');
      onEnvelopeMade?.(madeAt);
    } catch (caught) {
      setError(messageFor(caught, 'Could not build the envelope.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection
      title="The custody envelope"
      description="The one file that lets a successor open the encrypted archive with no Cloudflare account at all."
    >
      {/* One raised sheet for the whole ceremony, brass ruled, so the four
          stages read as one act standing apart from the page around it
          rather than as more of the desk's prose. The panel is the same one
          the Succession desk draws its other acts with. */}
      <div className="admin-panel admin-panel-act">
      {stage === 'idle' && (
        <>
          <Body>
            One button. Six words on paper, and a file your browser saves without sending anything anywhere.
          </Body>
          {/* Both paragraphs are true and both need saying once. Folded, they
              stop standing between Adrian and the one act on this screen
              every time he passes it. */}
          <AdminAside label="What pressing it does">
            <Body size={14}>
              Pressing the button below asks this browser for the archive's internal keys, generates a fresh
              passphrase on the spot, and shows it to you once, the way a wallet shows a seed phrase, so you can
              write it on paper. The browser then locks the keys behind that passphrase and saves the result as
              custody-envelope.json. The passphrase and the keys are never sent anywhere from this screen, not in
              the request that fetches the keys, not afterward; they exist only in this browser tab, only until
              the file downloads.
            </Body>
            <Body size={14} top={10}>
              Tell the truth to yourself before you start: this is shown once, nobody, including you, can recover
              it afterward if it is lost, and the paper copy must never be kept in the same place as the envelope
              file.
            </Body>
          </AdminAside>
          <div className="mt-5">
            <Brass onClick={() => void begin()}>{busy ? 'Reading the keys' : 'Build the custody envelope'}</Brass>
          </div>
          {error && <Note top={12}>{error}</Note>}
        </>
      )}

      {stage === 'passphrase' && words && (
        <>
          <Body>
            This is shown once. Write the six words below on paper, in order, exactly as spelled. Once you
            leave this screen nothing here can show them to you again.
          </Body>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-6">
            {words.map((word, index) => (
              <div key={index} className="border border-bronze-500/60 bg-paper-50 px-4 py-3">
                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 mr-2">
                  {index + 1}
                </span>
                <span className="font-title text-2xl tracking-[0.03em] text-wood-900">{word}</span>
              </div>
            ))}
          </div>
          <Note>
            {Math.round((entropyBits ?? 0) * 10) / 10} bits. That is the entire security of this envelope;
            guessing it by chance is not a realistic risk.
          </Note>
          <Note top={8}>
            Write it down before pressing on, twice if you intend to keep two sealed copies. Keep the paper
            apart from custody-envelope.json once it downloads, always.
          </Note>
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <Brass onClick={() => void proceedToVerify()}>I have written this down</Brass>
            <Quiet onClick={reset}>Cancel</Quiet>
          </div>
        </>
      )}

      {stage === 'verify' && verifyIndices && (
        <>
          <Body>
            Type word {verifyIndices[0] + 1} and word {verifyIndices[1] + 1} exactly as you wrote them. This is
            the one check that a passphrase nobody actually recorded cannot slip through.
          </Body>
          <form
            onSubmit={(event) => { event.preventDefault(); void confirmAndBuild(); }}
            className="grid gap-6 max-w-sm mt-5"
          >
            <Field label={`Word ${verifyIndices[0] + 1}`} value={verifyInputA} onChange={setVerifyInputA} />
            <Field label={`Word ${verifyIndices[1] + 1}`} value={verifyInputB} onChange={setVerifyInputB} />
            <div className="flex flex-wrap items-center gap-4">
              <Brass onClick={() => void confirmAndBuild()}>
                {busy ? 'Encrypting' : 'Confirm and build the envelope'}
              </Brass>
              <Quiet onClick={backToPassphrase}>Show the words again</Quiet>
            </div>
            {verifyError && <Note top={4}>{verifyError}</Note>}
            {error && <Note top={4}>{error}</Note>}
          </form>
        </>
      )}

      {stage === 'done' && (
        <>
          <Body>
            custody-envelope.json has been saved by your browser, most likely to your downloads folder. Move it
            to wherever the archive folder lives, kept apart from the paper.
          </Body>
          <Note top={10}>
            One thing left: record today's date below, in the field that tracks when the envelope was made.
          </Note>
          <div className="mt-6">
            <Quiet onClick={reset}>Build another</Quiet>
          </div>
        </>
      )}
      </div>
    </AdminSection>
  );
};

export default CustodyEnvelope;
