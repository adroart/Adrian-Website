/**
 * The rehearsal rail (/admin/rehearsal) — chains the eight real screens of
 * the collector journey end to end against the live backend. Nothing here
 * is faked or mocked: each step's link opens the real screen, and each
 * step's "done" state is read back from the real API. Run it against a
 * piece marked as non-production.
 *
 * Chain identity {pieceId, publicCode, keeperPieceId, confirmedAt,
 * gatheringDone} lives in sessionStorage (admin-rehearsal-chain-v1) so a
 * reload keeps the rehearsal's place; "Start over" clears it.
 *
 * Steps 5 to 7 need the `livingLegacy` launch flag on (launchFlags.ts) —
 * this file only reads that flag, never writes it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage, AdminPageHeader } from './AdminPage';
import {
  errorMessage,
  formatDate,
  jsonRequest,
  titleFor,
  type PieceRow,
} from '../../utils/adminPieces';
import { getPublicRecord, stewardClaimDeepLink } from '../collector/api';
import { LAUNCH_FLAGS } from '../../launchFlags';

const CHAIN_KEY = 'admin-rehearsal-chain-v1';
const POLL_MS = 5000;

type RehearsalChain = {
  pieceId: string | null;
  publicCode: string | null;
  keeperPieceId: string | null;
  confirmedAt: string | null;
  gatheringDone: boolean;
};

const emptyChain: RehearsalChain = {
  pieceId: null,
  publicCode: null,
  keeperPieceId: null,
  confirmedAt: null,
  gatheringDone: false,
};

function loadChain(): RehearsalChain {
  try {
    const raw = window.sessionStorage.getItem(CHAIN_KEY);
    if (!raw) return emptyChain;
    const parsed = JSON.parse(raw) as Partial<RehearsalChain>;
    return {
      pieceId: typeof parsed.pieceId === 'string' ? parsed.pieceId : null,
      publicCode: typeof parsed.publicCode === 'string' ? parsed.publicCode : null,
      keeperPieceId: typeof parsed.keeperPieceId === 'string' ? parsed.keeperPieceId : null,
      confirmedAt: typeof parsed.confirmedAt === 'string' ? parsed.confirmedAt : null,
      gatheringDone: parsed.gatheringDone === true,
    };
  } catch {
    return emptyChain;
  }
}

async function fetchJsonStatus(url: string): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

type StepStatus = 'waiting' | 'current' | 'done' | 'disabled';

function statusLabel(status: StepStatus): string {
  if (status === 'done') return 'done';
  if (status === 'current') return 'this is next';
  if (status === 'disabled') return 'disabled';
  return 'waiting';
}

const buttonClass =
  'min-h-11 inline-block font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';
const quietButtonClass =
  'min-h-11 inline-block font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 border border-wood-300 px-4 py-2 hover:border-wood-500 hover:text-wood-900 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';
const dimLinkClass = 'inline-block font-sans text-sm text-wood-400 underline underline-offset-4 hover:text-wood-600';
const disabledLinkClass =
  'inline-block font-label text-[11px] uppercase tracking-[0.14em] text-wood-300 border border-wood-200 px-4 py-2 cursor-not-allowed';

function linkClassFor(status: StepStatus): string {
  if (status === 'current') return buttonClass;
  if (status === 'done') return quietButtonClass;
  if (status === 'disabled') return disabledLinkClass;
  return dimLinkClass;
}

const StepShell: React.FC<React.PropsWithChildren<{
  number: number;
  name: string;
  description: string;
  status: StepStatus;
}>> = ({ number, name, description, status, children }) => (
  <article
    className={`border p-5 ${
      status === 'current'
        ? 'border-bronze-500 bg-paper-50'
        : status === 'done'
          ? 'border-wood-200 bg-paper-50'
          : 'border-wood-200 bg-paper-50 opacity-70'
    }`}
  >
    <div className="flex items-baseline justify-between gap-4 flex-wrap">
      <h3
        className={`font-title text-lg ${
          status === 'current' ? 'text-wood-900' : status === 'done' ? 'text-wood-600' : 'text-wood-400'
        }`}
      >
        <span className="font-sans text-sm text-wood-500 mr-2">{number}.</span>
        {name}
      </h3>
      <span
        className={`font-label text-[10px] uppercase tracking-[0.15em] ${
          status === 'current' ? 'text-bronze-700' : status === 'done' ? 'text-wood-500' : 'text-wood-400'
        }`}
      >
        {statusLabel(status)}
      </span>
    </div>
    <p className={`font-serif text-sm mt-2 ${status === 'current' ? 'text-wood-700' : 'text-wood-500'}`}>
      {description}
    </p>
    {children && <div className="mt-4">{children}</div>}
  </article>
);

const Rehearsal: React.FC = () => {
  const [chain, setChain] = useState<RehearsalChain>(() => loadChain());
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [piecesError, setPiecesError] = useState('');
  const [plateSkipped, setPlateSkipped] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [step3Locked, setStep3Locked] = useState(false);
  const [step4Done, setStep4Done] = useState(false);
  const [exportClicked, setExportClicked] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(CHAIN_KEY, JSON.stringify(chain));
    } catch {
      // sessionStorage unavailable — the rail still works for this visit.
    }
  }, [chain]);

  const newestRow = pieces[0] ?? null;
  const confirmedRow = chain.keeperPieceId
    ? pieces.find((row) => row.id === chain.keeperPieceId) ?? null
    : null;
  const plateGenerated = Boolean(confirmedRow?.plateGeneratedAt);
  const plateResolved = plateGenerated || plateSkipped;
  const keeperBoundDone = Boolean(confirmedRow?.keeperBound);

  const completed: boolean[] = [
    Boolean(chain.confirmedAt),
    plateResolved,
    step3Done,
    step4Done,
    LAUNCH_FLAGS.livingLegacy && keeperBoundDone,
    LAUNCH_FLAGS.livingLegacy && chain.gatheringDone,
    LAUNCH_FLAGS.livingLegacy && keeperBoundDone,
    exportClicked,
  ];
  const rawCurrentIndex = completed.findIndex((done) => !done);

  const statusFor = (index: number): StepStatus => {
    if (completed[index]) return 'done';
    if ((index === 4 || index === 5 || index === 6) && !LAUNCH_FLAGS.livingLegacy) return 'disabled';
    return index === rawCurrentIndex ? 'current' : 'waiting';
  };

  const statuses = [0, 1, 2, 3, 4, 5, 6, 7].map(statusFor);

  // Step 1, 2, 5 detection all read the same admin pieces list.
  useEffect(() => {
    const needed = statuses[0] === 'current' || statuses[1] === 'current' || statuses[4] === 'current';
    if (!needed) return;
    let cancelled = false;
    const check = async () => {
      try {
        const data = await jsonRequest('/api/admin/pieces');
        if (!cancelled) {
          setPieces(Array.isArray(data.pieces) ? data.pieces : []);
          setPiecesError('');
        }
      } catch (error) {
        if (!cancelled) setPiecesError(errorMessage(error, 'Could not reach the registry.'));
      }
    };
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses[0], statuses[1], statuses[4]]);

  // Step 3 detection: the three fail-soft "add to this piece" GETs.
  useEffect(() => {
    if (statuses[2] !== 'current' || !chain.pieceId) return;
    let cancelled = false;
    const pieceId = chain.pieceId;
    const check = async () => {
      const [media, story, message] = await Promise.all([
        fetchJsonStatus(`/api/admin/artworks/${encodeURIComponent(pieceId)}/media`),
        fetchJsonStatus(`/api/admin/artworks/${encodeURIComponent(pieceId)}/story`),
        fetchJsonStatus(`/api/admin/artworks/${encodeURIComponent(pieceId)}/message`),
      ]);
      if (cancelled) return;
      const locked = [media, story, message].some(
        (result) => result.status === 403 && result.data?.error === 'registry_locked',
      );
      setStep3Locked(locked);
      const mediaCount = Array.isArray(media.data?.media) ? media.data.media.length : 0;
      const hasStory = typeof story.data?.story === 'string' && story.data.story.trim().length > 0;
      const hasMessage = Array.isArray(message.data?.instances)
        && message.data.instances.some((instance: { message: unknown }) => Boolean(instance?.message));
      setStep3Done(mediaCount > 0 || hasStory || hasMessage);
    };
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [statuses[2], chain.pieceId]);

  // Step 4 detection: the public record, read back the same way a collector would.
  useEffect(() => {
    if (statuses[3] !== 'current' || !chain.publicCode) return;
    let cancelled = false;
    const publicCode = chain.publicCode;
    const check = async () => {
      try {
        const outcome = await getPublicRecord(publicCode);
        if (!cancelled) setStep4Done(outcome.kind === 'html');
      } catch {
        // fail-soft: keep polling
      }
    };
    void check();
    const id = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [statuses[3], chain.publicCode]);

  const confirmRehearsalPiece = useCallback(() => {
    if (!newestRow) return;
    setChain({
      pieceId: newestRow.pieceId,
      publicCode: newestRow.publicCode,
      keeperPieceId: newestRow.id,
      confirmedAt: new Date().toISOString(),
      gatheringDone: false,
    });
  }, [newestRow]);

  const startOver = () => {
    setChain(emptyChain);
    setPieces([]);
    setPlateSkipped(false);
    setStep3Done(false);
    setStep3Locked(false);
    setStep4Done(false);
    setExportClicked(false);
    try {
      window.sessionStorage.removeItem(CHAIN_KEY);
    } catch {
      // nothing to clear
    }
  };

  const pieceId = chain.pieceId;
  const publicCode = chain.publicCode;
  const keeperPieceId = chain.keeperPieceId;
  const hasChain = Boolean(pieceId && publicCode && keeperPieceId);

  const workRecordHref = pieceId && publicCode
    ? `/works/${encodeURIComponent(pieceId)}?${new URLSearchParams({ instance: publicCode }).toString()}`
    : null;
  const caretakerHref = pieceId && publicCode
    ? `/works/${encodeURIComponent(pieceId)}?${new URLSearchParams({ instance: publicCode }).toString()}`
    : null;
  const claimHref = pieceId && publicCode ? stewardClaimDeepLink(pieceId, publicCode) : null;

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        title="The rehearsal"
        description="This walks one real piece through the whole system, start to end. Nothing here is faked or mocked: every link opens the real screen and every check reads the real backend. Use a piece marked as non-production."
        actions={
          <button type="button" className={quietButtonClass} onClick={startOver}>
            Start over
          </button>
        }
      />

      {hasChain && (
        <p className="font-sans text-sm text-wood-600 mb-6">
          Rehearsal piece: {titleFor(pieceId as string)} · {pieceId} · {publicCode}
        </p>
      )}

      <div className="grid gap-4">
        <StepShell
          number={1}
          name="Register a piece"
          description="Open the registration ceremony and register a real, non-production piece."
          status={statuses[0]}
        >
          <Link to="/admin/register" className={linkClassFor(statuses[0])}>
            Open registration
          </Link>
          <div className="mt-4">
            {chain.confirmedAt ? (
              <p className="font-sans text-sm text-wood-500">Confirmed {formatDate(chain.confirmedAt)}.</p>
            ) : piecesError ? (
              <p className="font-sans text-sm text-red-700" role="alert">{piecesError}</p>
            ) : newestRow ? (
              <div className="border border-wood-200 bg-paper-50 p-4">
                <p className="font-sans text-sm text-wood-700">
                  Newest registered row: {titleFor(newestRow.pieceId)} · {newestRow.pieceId} ·{' '}
                  {newestRow.publicCode || 'no public code yet'} · registered {formatDate(newestRow.registeredAt)}
                </p>
                <button
                  type="button"
                  className={`${buttonClass} mt-3`}
                  onClick={confirmRehearsalPiece}
                  disabled={!newestRow.publicCode}
                >
                  This is the rehearsal piece
                </button>
                {!newestRow.publicCode && (
                  <p className="font-sans text-xs text-wood-500 mt-2">Waiting for a public code.</p>
                )}
              </div>
            ) : (
              <p className="font-sans text-sm text-wood-500">Watching the registry for a new row…</p>
            )}
          </div>
        </StepShell>

        <StepShell
          number={2}
          name="Prepare its plate"
          description="Optional. Generate the plate files for the rehearsal piece."
          status={statuses[1]}
        >
          <Link
            to={keeperPieceId ? `/admin/pieces/wizard?keeperPieceId=${encodeURIComponent(keeperPieceId)}` : '/admin/pieces/wizard'}
            className={linkClassFor(statuses[1])}
          >
            Open the plate wizard
          </Link>
          {statuses[1] === 'current' && (
            <div className="mt-4">
              <button type="button" className={quietButtonClass} onClick={() => setPlateSkipped(true)}>
                Skip this step
              </button>
            </div>
          )}
          {plateGenerated && (
            <p className="font-sans text-sm text-wood-500 mt-3">
              Plate generated {formatDate(confirmedRow?.plateGeneratedAt ?? null)}.
            </p>
          )}
          {plateSkipped && !plateGenerated && (
            <p className="font-sans text-sm text-wood-500 mt-3">Skipped for this rehearsal.</p>
          )}
        </StepShell>

        <StepShell
          number={3}
          name="Add to the piece"
          description="Attach a photograph, story, or a message for its caretaker."
          status={statuses[2]}
        >
          <Link
            to={pieceId ? `/admin/artworks/${encodeURIComponent(pieceId)}/add` : '/admin/register'}
            className={linkClassFor(statuses[2])}
          >
            Open Add to this piece
          </Link>
          {step3Locked && statuses[2] === 'current' && (
            <p className="font-sans text-sm text-wood-500 mt-3">
              This cannot be checked while the private registry is locked. Unlock it from the registry desk to let this step detect completion.
            </p>
          )}
        </StepShell>

        <StepShell
          number={4}
          name="See its public record"
          description="Read the piece back the way a collector or a search engine would find it."
          status={statuses[3]}
        >
          {workRecordHref ? (
            <Link to={workRecordHref} target="_blank" rel="noreferrer" className={linkClassFor(statuses[3])}>
              Open the public record
            </Link>
          ) : (
            <span className={disabledLinkClass}>Open the public record</span>
          )}
        </StepShell>

        <StepShell
          number={5}
          name="Claim it as its collector"
          description="Walk the claim flow the way a collector would from a QR scan."
          status={statuses[4]}
        >
          {!LAUNCH_FLAGS.livingLegacy ? (
            <p className="font-sans text-sm text-wood-500">
              These steps need the preview flag on. Rehearse on a preview deployment or a dev server with livingLegacy enabled.
            </p>
          ) : claimHref ? (
            <Link to={claimHref} target="_blank" rel="noreferrer" className={linkClassFor(statuses[4])}>
              Open the claim screen
            </Link>
          ) : (
            <span className={disabledLinkClass}>Open the claim screen</span>
          )}
        </StepShell>

        <StepShell
          number={6}
          name="The gathering"
          description="Happens inside step 5's visit, right after the claim. No link of its own."
          status={statuses[5]}
        >
          {!LAUNCH_FLAGS.livingLegacy ? (
            <p className="font-sans text-sm text-wood-500">
              These steps need the preview flag on. Rehearse on a preview deployment or a dev server with livingLegacy enabled.
            </p>
          ) : (
            <label className="flex items-start gap-3 font-sans text-sm text-wood-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={chain.gatheringDone}
                onChange={(event) => setChain((current) => ({ ...current, gatheringDone: event.target.checked }))}
              />
              <span>
                I walked the gathering. The system cannot see this from the admin side, so this box is the only record of it.
              </span>
            </label>
          )}
        </StepShell>

        <StepShell
          number={7}
          name="See it as its caretaker"
          description="The same public record, revisited without the claim step. Shares step 5's detection signal, since the admin side cannot independently tell the two visits apart."
          status={statuses[6]}
        >
          {!LAUNCH_FLAGS.livingLegacy ? (
            <p className="font-sans text-sm text-wood-500">
              These steps need the preview flag on. Rehearse on a preview deployment or a dev server with livingLegacy enabled.
            </p>
          ) : caretakerHref ? (
            <Link to={caretakerHref} target="_blank" rel="noreferrer" className={linkClassFor(statuses[6])}>
              Open as caretaker
            </Link>
          ) : (
            <span className={disabledLinkClass}>Open as caretaker</span>
          )}
        </StepShell>

        <StepShell
          number={8}
          name="Save the archive"
          description="Export the offline record archive. The browser's download is the proof this step happened."
          status={statuses[7]}
        >
          <a
            href="/api/admin/records/export"
            className={linkClassFor(statuses[7])}
            onClick={() => setExportClicked(true)}
          >
            Download the archive
          </a>
          {exportClicked && <p className="font-sans text-sm text-wood-500 mt-3">Download navigation fired.</p>}
        </StepShell>
      </div>
    </AdminPage>
  );
};

export default Rehearsal;
