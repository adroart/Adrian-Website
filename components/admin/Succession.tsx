/**
 * Succession desk (/admin/succession): the one place that makes the
 * succession plan visible. Today the encrypted recovery archive, the piece
 * records archive, and the Successor's Handbook exist but nothing in the
 * interface says whether they are in good order. This page reads what can
 * honestly be read, admits what cannot, and lets Adrian fill the handbook's
 * three blanks so it can do its job.
 *
 * Registry-wide operations here (reading and saving the blanks, downloading
 * the encrypted archive, syncing the records archive to Drive) sit behind
 * the same registry step-up unlock every other sensitive desk uses
 * (components/AdminPieces.tsx has the canonical unlock ceremony; this page
 * repeats the same cookie-backed /api/admin/registry-unlock calls rather
 * than importing from that file, since the two desks should not be coupled
 * by a shared unlock component).
 *
 * How the page is organised, and why it is organised at all: this is the
 * longest desk on the site, and read as one column of equal sections it was
 * a wall. It now runs in four named parts, and the organisation is carried
 * by material and colour rather than by a ladder of font sizes. The desk
 * still reads at two sizes only, the 11px Karla label and the Lora body.
 *
 *   Part one    what stands, split into what the server truly reads and
 *               what only Adrian can say. Never interleaved again.
 *   Part two    the only writing on this page: the envelope ceremony and
 *               the record it produces, under one Save.
 *   Part three  the two archives, the never-share one kept visibly apart.
 *   Part four   the handbook, folded away until it is wanted, and the rule.
 *
 * The left rule on a panel carries the one meaning: brass is something to
 * do, the error tone is the copy that must never be shared, hairline is
 * something to read. Nothing is ever said by colour alone; the word beside
 * it always says the same thing.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAlert, AdminPage, AdminPageHeader, AdminSection, adminUI } from './AdminPage';
import AdminAside from './AdminAside';
import CustodyEnvelope from './CustodyEnvelope';
import {
  emptySuccessionRecord,
  fillHandbookBlanks,
  sanitizeSuccessionField,
  successionFieldsComplete,
  successionReadiness,
  type SuccessionRecord,
} from '../../utils/adminSuccession';
import { HANDBOOK_SOURCE, renderHandbookMarkdown } from '../../functions/api/_lib/successorHandbook.js';

const { Body, Brass, Field, Ledger, Note, Quiet, State } = adminUI;

const handbookProseClass = [
  'font-serif text-[15px] leading-relaxed text-wood-700 max-w-[46rem]',
  '[&_h1]:font-title [&_h1]:text-2xl [&_h1]:text-wood-900 [&_h1]:mb-4',
  '[&_h2]:font-title [&_h2]:text-xl [&_h2]:text-wood-900 [&_h2]:mt-9 [&_h2]:mb-2',
  '[&_h3]:italic [&_h3]:text-wood-800 [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_p]:mb-3', '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3', '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3',
  '[&_li]:mb-1', '[&_strong]:font-semibold [&_strong]:text-wood-900',
  '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-wood-100 [&_code]:px-1 [&_code]:break-all',
  '[&_pre]:bg-wood-100 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_pre_code]:bg-transparent [&_pre_code]:break-normal',
].join(' ');

type StateTone = 'quiet' | 'warm' | 'brass' | 'wrong';

/** One part of the desk, standing on its own darker ground. The band is
 *  what makes a page this long readable as four blocks instead of one run:
 *  the two grounds alternate, and both are darker than the desk, so every
 *  raised panel inside a band reads as raised. */
const Band: React.FC<React.PropsWithChildren<{ count: string; name: string; deep?: boolean }>> = ({
  count,
  name,
  deep = false,
  children,
}) => (
  <section className={deep ? 'admin-band admin-band-deep' : 'admin-band'}>
    <p className="admin-part">
      <span>{count}</span>
      <span>{name}</span>
    </p>
    {children}
  </section>
);

/** A raised sheet holding one group of work. `tone` decides its left rule:
 *  brass for something to do, the error tone for something never shared. */
const Panel: React.FC<React.PropsWithChildren<{ label: string; tone?: 'act' | 'warn' }>> = ({
  label,
  tone,
  children,
}) => (
  <div className={tone ? `admin-panel admin-panel-${tone}` : 'admin-panel'}>
    <span className="admin-eyebrow">{label}</span>
    {children}
  </div>
);

/** One line of standing: the label, the state word, and the honest note
 *  underneath saying what this page does and does not actually know. */
const Standing: React.FC<{ label: string; word: string; tone: StateTone; children: React.ReactNode }> = ({
  label,
  word,
  tone,
  children,
}) => (
  /* The line itself is the control. Three of these stacked, each with its
     own labelled disclosure underneath, was a column of switches; opening
     the line that already carries the label and the state word costs no
     extra row at all. The state word alone still tells the whole truth, so
     nothing is hidden by leaving every one of them closed. */
  <details className={`admin-status admin-status-${tone}`}>
    <summary>
      <span className="admin-eyebrow">{label}</span>
      <State tone={tone}>{word}</State>
    </summary>
    <Note top={7}>{children}</Note>
  </details>
);

type ConfigStatus = {
  recoveryExportConfigured: boolean;
  recordsBucketConfigured: boolean;
  driveConfigured: boolean;
};

const emptyConfigStatus: ConfigStatus = {
  recoveryExportConfigured: false,
  recordsBucketConfigured: false,
  driveConfigured: false,
};

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const RECOVERY_EXPORT_REMEDY = [
  'The encrypted archive is not configured yet. Set two Cloudflare secrets, the same way',
  'REGISTRY_STEP_UP_SECRET was set (docs/finish-setup.md):',
  '',
  'openssl rand -base64 32',
  'npx wrangler pages secret put REGISTRY_RECOVERY_EXPORT_KEY --project-name adrian-website',
  '',
  'Then a short plaintext label for that key version, for example rk1:',
  '',
  'npx wrangler pages secret put REGISTRY_RECOVERY_EXPORT_KEY_ID --project-name adrian-website',
  '',
  'Redeploy afterward. Pages Functions only read new values on a fresh deployment.',
].join('\n');

const CUSTODY_ENVELOPE_COMMAND = 'bash ~/builds/adrian-website-custody.sh';

const RECORDS_BUCKET_REMEDY = 'The R2 backup bucket is not bound yet. See docs/finish-setup.md, Step 4, to create adrian-artwork-registry-backup and bind it as ARTWORK_REGISTRY_BACKUP.';
const DRIVE_REMEDY = 'Google Drive sync is not configured yet. See docs/finish-setup.md for GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN, and the optional GOOGLE_DRIVE_FOLDER_ID.';

function remedyFor(errorCode: string, fallback: string): string {
  if (errorCode === 'registry_recovery_export_not_configured') return RECOVERY_EXPORT_REMEDY;
  if (errorCode === 'records_bucket_not_configured') return RECORDS_BUCKET_REMEDY;
  if (errorCode === 'drive_not_configured') return DRIVE_REMEDY;
  if (errorCode === 'registry_locked') return 'Private registry access expired. Unlock it again.';
  return fallback;
}

/** Fetch a file endpoint and save it as a blob, so a non-200 response (a 503
 *  with a JSON remedy body, most often) is read and surfaced as a message
 *  instead of opening as raw JSON in a new browser tab. */
async function downloadViaBlob(url: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    let errorCode = '';
    try {
      const data = await response.json();
      errorCode = typeof data?.error === 'string' ? data.error : '';
    } catch {
      // not JSON; fall through to the generic message
    }
    throw new Error(remedyFor(errorCode, `Download failed (${response.status}).`));
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match ? match[1] : fallbackFilename;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

const Succession: React.FC = () => {
  const [checkingUnlock, setCheckingUnlock] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockSecret, setUnlockSecret] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [fields, setFields] = useState<SuccessionRecord>(emptySuccessionRecord);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [config, setConfig] = useState<ConfigStatus>(emptyConfigStatus);

  const [draft, setDraft] = useState<SuccessionRecord>(emptySuccessionRecord);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [recordsBusy, setRecordsBusy] = useState(false);
  const [recordsError, setRecordsError] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState('');

  const readiness = successionReadiness(unlocked, config.recoveryExportConfigured);

  const loadState = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/succession');
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(remedyFor(data?.error, `Could not load the succession state (${response.status}).`));
      }
      const loadedFields: SuccessionRecord = {
        passkeySealedAt: data.fields?.passkeySealedAt || '',
        passkeySecondCopyAt: data.fields?.passkeySecondCopyAt || '',
        familyContact: data.fields?.familyContact || '',
        technicalHelper: data.fields?.technicalHelper || '',
        custodyEnvelopeMadeAt: data.fields?.custodyEnvelopeMadeAt || '',
        custodyDrillLastRunAt: data.fields?.custodyDrillLastRunAt || '',
      };
      setFields(loadedFields);
      setDraft(loadedFields);
      setSavedAt(data.fields?.updatedAt || null);
      setConfig({
        recoveryExportConfigured: Boolean(data.recoveryExportConfigured),
        recordsBucketConfigured: Boolean(data.recordsBucketConfigured),
        driveConfigured: Boolean(data.driveConfigured),
      });
    } catch (error) {
      setLoadError(messageFor(error, 'Could not load the succession state.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCheckingUnlock(true);
    fetch('/api/admin/registry-unlock')
      .then((response) => response.json().catch(() => ({})))
      .then((data) => setUnlocked(data?.unlocked === true))
      .catch(() => setUnlocked(false))
      .finally(() => setCheckingUnlock(false));
  }, []);

  useEffect(() => {
    if (unlocked) void loadState();
  }, [unlocked, loadState]);

  const unlock = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const secret = unlockSecret;
    if (!secret) return;
    setUnlockBusy(true);
    setUnlockError('');
    setUnlockSecret('');
    try {
      const response = await fetch('/api/admin/registry-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) throw new Error(data?.error || 'Unlock failed.');
      setUnlocked(true);
    } catch (error) {
      setUnlocked(false);
      setUnlockError(messageFor(error, 'Could not unlock the registry.'));
    } finally {
      setUnlockBusy(false);
    }
  };

  const lock = async () => {
    setUnlockBusy(true);
    setUnlockError('');
    try {
      await fetch('/api/admin/registry-unlock', { method: 'DELETE' });
    } finally {
      setUnlocked(false);
      setUnlockBusy(false);
    }
  };

  const saveDraft = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSaveBusy(true);
    setSaveError('');
    setSaveSuccess('');
    try {
      const response = await fetch('/api/admin/succession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(remedyFor(data?.error, `Could not save (${response.status}).`));
      }
      const savedFields: SuccessionRecord = {
        passkeySealedAt: data.fields?.passkeySealedAt || '',
        passkeySecondCopyAt: data.fields?.passkeySecondCopyAt || '',
        familyContact: data.fields?.familyContact || '',
        technicalHelper: data.fields?.technicalHelper || '',
        custodyEnvelopeMadeAt: data.fields?.custodyEnvelopeMadeAt || '',
        custodyDrillLastRunAt: data.fields?.custodyDrillLastRunAt || '',
      };
      setFields(savedFields);
      setDraft(savedFields);
      setSavedAt(data.fields?.updatedAt || null);
      setSaveSuccess('Saved. The handbook below now carries these.');
    } catch (error) {
      setSaveError(messageFor(error, 'Could not save.'));
    } finally {
      setSaveBusy(false);
    }
  };

  const downloadArchive = async () => {
    setArchiveBusy(true);
    setArchiveError('');
    try {
      await downloadViaBlob('/api/admin/registry-recovery-export', 'registry-private-recovery.json');
    } catch (error) {
      setArchiveError(messageFor(error, 'Could not download the encrypted archive.'));
    } finally {
      setArchiveBusy(false);
    }
  };

  const downloadRecords = async () => {
    setRecordsBusy(true);
    setRecordsError('');
    try {
      await downloadViaBlob('/api/admin/records/export', 'piece-records.zip');
    } catch (error) {
      setRecordsError(messageFor(error, 'Could not download the piece records archive.'));
    } finally {
      setRecordsBusy(false);
    }
  };

  const syncRecordsToDrive = async () => {
    setDriveBusy(true);
    setDriveStatus('');
    try {
      const response = await fetch('/api/admin/records/export', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.ok) {
        throw new Error(remedyFor(data?.error, `Sync failed (${response.status}).`));
      }
      setDriveStatus(data.updated ? 'Piece records archive synced to Google Drive.' : 'Piece records archive created in Google Drive.');
    } catch (error) {
      setDriveStatus(messageFor(error, 'Could not sync to Google Drive.'));
    } finally {
      setDriveBusy(false);
    }
  };

  const filledHandbook = fillHandbookBlanks(HANDBOOK_SOURCE, fields);
  const handbookHtml = renderHandbookMarkdown(filledHandbook);

  /* The save bar the two written panels share. One record, one Save; the
     page used to draw this twice and ask which one you had pressed. */
  const saveBar = (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-4">
        <Brass onClick={() => void saveDraft()}>{saveBusy ? 'Saving' : 'Save'}</Brass>
        {savedAt && <Note>Last saved {new Date(savedAt).toLocaleString()}</Note>}
      </div>
      {saveError && <AdminAlert tone="error" live>{saveError}</AdminAlert>}
      {saveSuccess && <AdminAlert tone="success" live>{saveSuccess}</AdminAlert>}
    </>
  );

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Continuity"
        title="Succession"
        description="The encrypted copy of the private registry: what lets a museum or a family member continue it if you cannot. Three exports exist and they are easy to confuse, so the page opens by keeping them apart."
      />

      {/* The three exports, told apart by standing beside each other rather
          than by a paragraph explaining that they differ. The one that can
          rebuild everything wears the error rule, because that is the one
          that must never be shared. */}
      <div className="admin-board">
        <Panel label="The offline ledger">
          <Body size={14}>
            It proves the public lineage chain, and it is taken on the{' '}
            <Link to="/admin/pieces" className="underline underline-offset-4">Plate registry desk</Link>.
          </Body>
          <Note top={10}><State tone="quiet">Safe to share</State></Note>
        </Panel>
        <Panel label="The piece records archive">
          <Body size={14}>Every public record page. Taken in part three, below.</Body>
          <Note top={10}><State tone="quiet">Safe to share</State></Note>
        </Panel>
        <Panel label="This encrypted archive" tone="warn">
          <Body size={14}>The only one of the three that can rebuild the whole private registry from nothing.</Body>
          <Note top={10}><State tone="wrong">Never share</State></Note>
        </Panel>
      </div>

      {checkingUnlock ? (
        <AdminSection title="Private registry access">
          <Body>Checking the registry unlock.</Body>
        </AdminSection>
      ) : readiness === 'locked' ? (
        <AdminSection
          title="Private registry access"
          description="Everything below concerns the private registry, so it stays behind the same step-up unlock as the plate registry desk."
        >
          <form onSubmit={unlock} className="grid gap-5 max-w-sm">
            <Field
              label="Registry unlock secret"
              type="password"
              value={unlockSecret}
              onChange={setUnlockSecret}
            />
            <Brass onClick={() => void unlock()}>{unlockBusy ? 'Unlocking' : 'Unlock the registry'}</Brass>
            {unlockError && <Note>{unlockError}</Note>}
          </form>
        </AdminSection>
      ) : (
        <>
          {/* Unlocked, this is one settled line, not a section of its own. */}
          <div className="admin-panel mt-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="admin-eyebrow">Private registry access</span>
              <Body size={14} top={6}>Unlocked for this session.</Body>
            </div>
            <Quiet onClick={() => void lock()}>{unlockBusy ? 'Locking' : 'Lock again'}</Quiet>
          </div>

          {loading && (
            <AdminSection title="The state of the succession">
              <Body>Reading the succession state.</Body>
            </AdminSection>
          )}
          {loadError && <AdminAlert tone="error" live>{loadError}</AdminAlert>}

          {!loading && !loadError && (
            <>
              <Band count="Part one of four" name="Where it stands">
              {!fields.custodyEnvelopeMadeAt && (
                <AdminAlert tone="warning" live>
                  <Body size={14}>
                    No custody envelope has been recorded. Build it in part two below.
                  </Body>
                  {/* The full consequence is the reason this warning exists, and
                      it is a paragraph. It stands folded so the warning itself
                      stays one line every time it is passed. */}
                  <AdminAside label="What is lost without it">
                    <Body size={14}>
                      The envelope is the one file that carries the
                      encrypted archive's keys out of Cloudflare, and Cloudflare can never hand those keys back
                      once they leave. Without it, if this Cloudflare account were ever lost, the encrypted
                      archive could never be opened again: the private layer of the registry, who holds each
                      piece and every collector's Ownership Code, would be gone. The permanent records and the
                      public history would still survive. Only the private layer depends on this one file.
                    </Body>
                    <Note top={12}>It can also be built from a terminal, away from this page.</Note>
                    <pre className="admin-code">{CUSTODY_ENVELOPE_COMMAND}</pre>
                  </AdminAside>
                </AdminAlert>
              )}

              <AdminSection
                title="The state of the succession, honestly"
                description="Real reads from this server on the left. What only your own word can settle on the right."
              >
                <div className="admin-board admin-board-top">
                  <Panel label="Read from this server">
                    <Ledger
                      label="Encrypted archive"
                      value={
                        <State tone={config.recoveryExportConfigured ? 'warm' : 'wrong'}>
                          {config.recoveryExportConfigured ? 'Configured' : 'Not configured'}
                        </State>
                      }
                    />
                    <Ledger
                      label="Piece records storage"
                      value={
                        <State tone={config.recordsBucketConfigured ? 'warm' : 'wrong'}>
                          {config.recordsBucketConfigured ? 'Configured' : 'Not configured'}
                        </State>
                      }
                    />
                    <Ledger
                      label="Google Drive mirror"
                      value={
                        <State tone={config.driveConfigured ? 'warm' : 'quiet'}>
                          {config.driveConfigured ? 'Configured' : 'Not configured'}
                        </State>
                      }
                    />
                    <Ledger
                      label="Handbook blanks"
                      value={
                        <State tone={successionFieldsComplete(fields) ? 'warm' : 'brass'}>
                          {successionFieldsComplete(fields) ? 'All filled' : 'Waiting on you'}
                        </State>
                      }
                    />
                  </Panel>

                  <Panel label="What only you can say">
                    <Standing label="When the archive was last taken" word="Not known here" tone="quiet">
                      The server keeps no record of when the encrypted archive was last downloaded. The only
                      record is the timestamp inside the filename of whichever copy you are holding,
                      registry-private-recovery-&lt;timestamp&gt;.json.
                    </Standing>
                    <Standing
                      label="Custody envelope"
                      word={fields.custodyEnvelopeMadeAt ? `Recorded, ${fields.custodyEnvelopeMadeAt}` : 'Not recorded'}
                      tone={fields.custodyEnvelopeMadeAt ? 'warm' : 'wrong'}
                    >
                      The envelope is a file you hold offline, apart from this archive. This interface never
                      receives it and has no way to check whether it exists or which archive it opens.
                      {fields.custodyEnvelopeMadeAt
                        ? ' The date above is only your own record that you built it, not something this page verified.'
                        : ' Nothing has been recorded yet.'}
                    </Standing>
                    <Standing
                      label="Yearly drill"
                      word={fields.custodyDrillLastRunAt ? `Recorded, ${fields.custodyDrillLastRunAt}` : 'Not recorded'}
                      tone={fields.custodyDrillLastRunAt ? 'warm' : 'brass'}
                    >
                      Nothing here can watch a drill happen.
                      {fields.custodyDrillLastRunAt
                        ? ' The date above is only your own record that you walked it, not something this page verified.'
                        : ' Record the date in part two once you have walked the drill described at the foot of this page.'}
                    </Standing>
                  </Panel>
                </div>
              </AdminSection>

              </Band>

              <Band count="Part two of four" name="What only you can write" deep>

              {/* Making the envelope sits directly above the record it
                  produces, so the act and its date are one motion. The date
                  is filled in for you when it finishes, and still has to be
                  saved, since the page never records an act on your behalf. */}
              <CustodyEnvelope
                onEnvelopeMade={(date) => setDraft((current) => ({
                  ...current,
                  custodyEnvelopeMadeAt: sanitizeSuccessionField(date),
                }))}
              />

              <AdminSection
                title="Your own record"
                description="Nothing here can read any of these. They are your handwriting and your word that an act happened."
              >
                <form onSubmit={saveDraft}>
                  <div className="admin-board admin-board-top">
                    <Panel label="The three blanks" tone="act">
                      <AdminAside label="What these four lines are for">
                        <Note>
                          The handbook in part four has lines waiting for your own handwriting. Type them here and
                          they travel into the rendered handbook. The physical act, paper and seal, still happens
                          away from any screen.
                        </Note>
                      </AdminAside>
                      <div className="grid gap-6 mt-5">
                        <Field
                          label="Written and sealed at"
                          value={draft.passkeySealedAt}
                          onChange={(value) => setDraft((current) => ({ ...current, passkeySealedAt: sanitizeSuccessionField(value) }))}
                          hint="Where the first sealed paper copy is kept"
                        />
                        <Field
                          label="A second sealed copy at"
                          value={draft.passkeySecondCopyAt}
                          onChange={(value) => setDraft((current) => ({ ...current, passkeySecondCopyAt: sanitizeSuccessionField(value) }))}
                          hint="Where the second sealed paper copy is kept, somewhere else entirely"
                        />
                        <Field
                          label="Family contact for the registry"
                          value={draft.familyContact}
                          onChange={(value) => setDraft((current) => ({ ...current, familyContact: sanitizeSuccessionField(value) }))}
                          hint="Who to reach first"
                        />
                        <Field
                          label="Technical helper who knows this system"
                          value={draft.technicalHelper}
                          onChange={(value) => setDraft((current) => ({ ...current, technicalHelper: sanitizeSuccessionField(value) }))}
                          hint="Who can follow the restore steps"
                        />
                      </div>
                    </Panel>

                    <Panel label="The two dates" tone="act">
                      <AdminAside label="Where these dates come from">
                        <Note>
                          When the envelope was last built, and when the yearly restore drill was last walked
                          against a scratch database. Building an envelope above fills the first of these in for
                          you, and it still has to be saved.
                        </Note>
                      </AdminAside>
                      <div className="grid gap-6 mt-5">
                        <Field
                          label="Custody envelope last built"
                          type="date"
                          value={draft.custodyEnvelopeMadeAt}
                          onChange={(value) => setDraft((current) => ({ ...current, custodyEnvelopeMadeAt: sanitizeSuccessionField(value) }))}
                          hint="When scripts/custody-envelope.ts was last run to make it"
                        />
                        <Field
                          label="Yearly restore drill last run"
                          type="date"
                          value={draft.custodyDrillLastRunAt}
                          onChange={(value) => setDraft((current) => ({ ...current, custodyDrillLastRunAt: sanitizeSuccessionField(value) }))}
                          hint="When you last walked the drill described at the foot of this page"
                        />
                      </div>
                    </Panel>
                  </div>
                  {saveBar}
                </form>
              </AdminSection>

              </Band>

              <Band count="Part three of four" name="Take the folder">

              <AdminSection title="Take the folder">
                <div className="admin-board">
                  <Panel label="The encrypted archive" tone="warn">
                    <Body size={14}>
                      It travels with the custody envelope, and the two rest in different places, always.
                    </Body>
                    <div className="mt-6">
                      <Brass onClick={() => void downloadArchive()}>
                        {archiveBusy ? 'Preparing' : 'Download encrypted archive'}
                      </Brass>
                    </div>
                    {archiveError && <Note top={12}>{archiveError}</Note>}
                  </Panel>

                  <Panel label="The piece records archive">
                    <Body size={14}>Safe to keep in Google Drive, unlike the archive beside it.</Body>
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <Quiet onClick={() => void downloadRecords()}>
                        {recordsBusy ? 'Preparing' : 'Download'}
                      </Quiet>
                      <Quiet onClick={() => void syncRecordsToDrive()}>
                        {driveBusy ? 'Syncing' : 'Sync to Google Drive'}
                      </Quiet>
                    </div>
                    {recordsError && <Note top={12}>{recordsError}</Note>}
                    {driveStatus && <Note top={12}>{driveStatus}</Note>}
                  </Panel>
                </div>
              </AdminSection>

              </Band>

              <Band count="Part four of four" name="What travels with the folder" deep>

              <AdminSection
                title="The Successor's Handbook"
                description="Generated from docs/registry-custodian-guide.md, with your four lines spliced in. This is what travels with the folder."
              >
                <details className="admin-fold">
                  <summary>The handbook in full, with your four lines in place</summary>
                  <div
                    className={`admin-fold-body ${handbookProseClass}`}
                    // The source is this repository's own settled markdown, run through
                    // successorHandbook.js's own escaping renderer; the only variable
                    // content spliced in is the four fields above, which pass through
                    // that same escaping pass. Nothing here is untrusted third-party HTML.
                    dangerouslySetInnerHTML={{ __html: handbookHtml }}
                  />
                </details>
              </AdminSection>

              <AdminSection title="The custody rule">
                <div className="admin-board">
                  <Panel label="Never in one place" tone="warn">
                    <blockquote className="font-serif text-wood-800 italic text-[15px] leading-relaxed">
                      "The passkey and the files must never be stored in the same place. Not in the same drawer, not in
                      the same account, not in the same cloud service. Whoever holds both at once holds the entire
                      registry, so they travel separately and rest separately, always."
                    </blockquote>
                  </Panel>
                  <Panel label="Once a year" tone="act">
                    <blockquote className="font-serif text-wood-800 italic text-[15px] leading-relaxed">
                      "Once a year, or whenever custody changes hands, walk steps one through four with the real held
                      files and a scratch database that is thrown away afterward. Never aim a restore at the live
                      system. A drill that ends with a working scratch copy is proof the succession works. A drill that
                      fails is the best possible time to find out."
                    </blockquote>
                  </Panel>
                </div>
              </AdminSection>

              </Band>
            </>
          )}
        </>
      )}
    </AdminPage>
  );
};

export default Succession;
