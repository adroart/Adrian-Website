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
 * How it is laid out, and why:
 *
 * One column, one measure, flat ground. An earlier version of this page was
 * built out of tinted two-column cards and it read as furniture rather than
 * as a document: everything boxed, every label 11px, nothing to rest on.
 * What carries the structure now is a type scale and a rule. Four numbered
 * parts, each opened by a hairline and a serif heading; inside them, lines
 * separated by hairlines; no filled box anywhere.
 *
 * Serif for everything read. Mono, and only mono, for what the machine
 * says: the part numbers, the group chips, and every state word. That is
 * the whole colour and texture system, and it means a state word is
 * recognisable as a machine reading before it has been read.
 *
 * The classes live in src/index.css under "The desk's reading grammar".
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

/* Of the kit, this page now draws with Body, Brass, Field and Quiet. Ledger,
   Note and State were the boxed desk's row, caption and status word; the
   reading grammar in index.css says all three in plain elements at readable
   sizes instead. The destructure stays whole so the kit is imported the one
   way every admin file imports it. */
const { Body, Brass, Field, Ledger, Note, Quiet, State } = adminUI;
void Ledger; void Note; void State;

const handbookProseClass = [
  'font-serif text-[16px] leading-relaxed text-wood-700 max-w-[42rem]',
  '[&_h1]:font-title [&_h1]:text-3xl [&_h1]:text-wood-900 [&_h1]:mb-4',
  '[&_h2]:font-title [&_h2]:text-2xl [&_h2]:text-wood-900 [&_h2]:mt-10 [&_h2]:mb-2',
  '[&_h3]:italic [&_h3]:text-wood-800 [&_h3]:mt-7 [&_h3]:mb-2',
  '[&_p]:mb-4', '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4', '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4',
  '[&_li]:mb-1.5', '[&_strong]:font-semibold [&_strong]:text-wood-900',
  '[&_code]:font-mono [&_code]:text-[14px] [&_code]:bg-wood-100 [&_code]:px-1 [&_code]:break-all',
  '[&_pre]:bg-wood-100 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre_code]:bg-transparent [&_pre_code]:break-normal',
].join(' ');

type StateTone = 'quiet' | 'warm' | 'brass' | 'wrong';

/** Everything the machine says wears mono. Nothing else does. */
const Mark: React.FC<React.PropsWithChildren<{ lit?: boolean }>> = ({ lit, children }) => (
  <span className={lit ? 'admin-tag admin-tag-lit' : 'admin-tag'}>{children}</span>
);

/** A state word: what the machine reads, standing at the end of its line. */
const Reading: React.FC<{ tone?: StateTone; children: React.ReactNode }> = ({ tone = 'quiet', children }) => (
  <span className={tone === 'quiet' ? 'admin-state' : `admin-state admin-state-${tone}`}>{children}</span>
);

/** One numbered part. The rule above it and the room around it are the whole
 *  separation; there is no band and no box. */
const Part: React.FC<React.PropsWithChildren<{ number: string; title: string }>> = ({
  number,
  title,
  children,
}) => (
  <section className="admin-movement">
    <header>
      <Mark>{number}</Mark>
      <h2>{title}</h2>
    </header>
    {children}
  </section>
);

/** A named group of lines. */
const Group: React.FC<React.PropsWithChildren<{ label: string }>> = ({ label, children }) => (
  <div className="admin-group">
    <Mark>{label}</Mark>
    {children}
  </div>
);

/** One line: what it is on the left, what the machine reads on the right, a
 *  sentence underneath, and anything to press below that. */
const Line: React.FC<{
  title: string;
  state?: React.ReactNode;
  note?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, state, note, children }) => (
  <div className="admin-line">
    <span className="admin-line-title">{title}</span>
    {state}
    {note && <p className="admin-line-note">{note}</p>}
    {children && <div className="admin-line-act">{children}</div>}
  </div>
);

/** The same line, which opens. The state word still reads in place; the mono
 *  sign after it is the only thing added. */
const Standing: React.FC<{ label: string; word: string; tone: StateTone; children: React.ReactNode }> = ({
  label,
  word,
  tone,
  children,
}) => (
  <details className="admin-line">
    <summary>
      <span className="admin-line-title">{label}</span>
      <Reading tone={tone}>{word}</Reading>
    </summary>
    <p className="admin-line-note">{children}</p>
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
      <div className="admin-run">
        <AdminPageHeader eyebrow="Continuity" title="Succession" />
        <p className="admin-lede">
          The encrypted copy of the private registry. It lets a museum or a family member continue the registry
          if you cannot.
        </p>
        <p className="admin-quiet">
          Three exports exist and they are easy to confuse, so the page opens by keeping them apart.
        </p>

        <Group label="The three exports">
          <Line
            title="The offline ledger"
            state={<Reading>Safe to share</Reading>}
            note={
              <>
                Proves the public lineage chain. Taken on the{' '}
                <Link to="/admin/pieces" className="underline underline-offset-4">Plate registry desk</Link>.
              </>
            }
          />
          <Line
            title="The piece records archive"
            state={<Reading>Safe to share</Reading>}
            note="Every public record page. Taken in part three."
          />
          <Line
            title="This encrypted archive"
            state={<Reading tone="wrong">Never share</Reading>}
            note="Rebuilds the whole private registry from nothing. The only one of the three that can."
          />
        </Group>

        {checkingUnlock ? (
          <AdminSection title="Private registry access">
            <Body>Checking the registry unlock.</Body>
          </AdminSection>
        ) : readiness === 'locked' ? (
          <Part number="01" title="Private registry access">
            <p className="admin-say">
              Everything below concerns the private registry, so it stays behind the same step-up unlock as the
              plate registry desk.
            </p>
            <form onSubmit={unlock} className="grid gap-6 max-w-sm mt-8">
              <Field
                label="Registry unlock secret"
                type="password"
                value={unlockSecret}
                onChange={setUnlockSecret}
              />
              <div className="admin-shelf">
                <Brass onClick={() => void unlock()}>{unlockBusy ? 'Unlocking' : 'Unlock the registry'}</Brass>
              </div>
              {unlockError && <p className="admin-quiet">{unlockError}</p>}
            </form>
          </Part>
        ) : (
          <>
            {loading && <p className="admin-say">Reading the succession state.</p>}
            {loadError && <AdminAlert tone="error" live>{loadError}</AdminAlert>}

            {!loading && !loadError && (
              <>
                <Part number="01" title="Status">
                  {!fields.custodyEnvelopeMadeAt && (
                    <AdminAlert tone="warning" live>
                      <p className="admin-say">No custody envelope recorded. Build it in part two.</p>
                      {/* The full consequence is the reason this warning exists,
                          and it is a paragraph. It stands folded so the warning
                          itself is one line every time it is passed. */}
                      <AdminAside label="What is lost without it">
                        <p className="admin-quiet">
                          The envelope is the one file that carries the encrypted archive's keys out of
                          Cloudflare, and Cloudflare can never hand those keys back once they leave. Without it,
                          if this Cloudflare account were ever lost, the encrypted archive could never be opened
                          again: the private layer of the registry, who holds each piece and every
                          collector's Ownership Code, would be gone. The permanent records and the
                          public history would still survive. Only the private layer depends on this one file.
                        </p>
                        <p className="admin-quiet">It can also be built from a terminal.</p>
                        <code className="admin-code">{CUSTODY_ENVELOPE_COMMAND}</code>
                      </AdminAside>
                    </AdminAlert>
                  )}

                  <h3>The state of the succession, honestly</h3>
                  <p className="admin-quiet">
                    The first group is read from this server. The second is your own word, and nothing here can
                    check it.
                  </p>

                  <Group label="Read from this server">
                    <Line
                      title="Encrypted archive"
                      state={
                        <Reading tone={config.recoveryExportConfigured ? 'warm' : 'wrong'}>
                          {config.recoveryExportConfigured ? 'Configured' : 'Not configured'}
                        </Reading>
                      }
                    />
                    <Line
                      title="Piece records storage"
                      state={
                        <Reading tone={config.recordsBucketConfigured ? 'warm' : 'wrong'}>
                          {config.recordsBucketConfigured ? 'Configured' : 'Not configured'}
                        </Reading>
                      }
                    />
                    <Line
                      title="Google Drive mirror"
                      state={
                        <Reading tone={config.driveConfigured ? 'warm' : 'quiet'}>
                          {config.driveConfigured ? 'Configured' : 'Not configured'}
                        </Reading>
                      }
                    />
                    <Line
                      title="Handbook blanks"
                      state={
                        <Reading tone={successionFieldsComplete(fields) ? 'warm' : 'brass'}>
                          {successionFieldsComplete(fields) ? 'All filled' : 'Waiting on you'}
                        </Reading>
                      }
                    />
                  </Group>

                  <Group label="Your own record">
                    <Standing label="When the archive was last taken" word="Not known here" tone="quiet">
                      The server keeps no record of when the encrypted archive was last downloaded. The only
                      record is the timestamp inside the filename of whichever copy you are holding,
                      registry-private-recovery-&lt;timestamp&gt;.json.
                    </Standing>
                    <Standing
                      label="Custody envelope"
                      word={fields.custodyEnvelopeMadeAt ? `Recorded ${fields.custodyEnvelopeMadeAt}` : 'Not recorded'}
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
                      word={fields.custodyDrillLastRunAt ? `Recorded ${fields.custodyDrillLastRunAt}` : 'Not recorded'}
                      tone={fields.custodyDrillLastRunAt ? 'warm' : 'brass'}
                    >
                      Nothing here can watch a drill happen.
                      {fields.custodyDrillLastRunAt
                        ? ' The date above is only your own record that you walked it, not something this page verified.'
                        : ' Record the date in part two once you have walked the drill in part four.'}
                    </Standing>
                  </Group>
                </Part>

                <Part number="02" title="Your record">
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

                  <h3>The four blanks, and the two dates</h3>
                  <p className="admin-quiet">
                    The four lines are spliced into the handbook in part four. The two dates are your word that
                    an act happened. Building an envelope above fills the first date in, and it still has to be
                    saved.
                  </p>

                  <form onSubmit={saveDraft} className="grid gap-5 mt-8 max-w-xl">
                    <Field
                      label="Written and sealed at"
                      value={draft.passkeySealedAt}
                      onChange={(value) => setDraft((current) => ({ ...current, passkeySealedAt: sanitizeSuccessionField(value) }))}
                      hint="Where the first sealed copy is kept"
                    />
                    <Field
                      label="A second sealed copy at"
                      value={draft.passkeySecondCopyAt}
                      onChange={(value) => setDraft((current) => ({ ...current, passkeySecondCopyAt: sanitizeSuccessionField(value) }))}
                      hint="Where the second copy is kept"
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
                    <Field
                      label="Custody envelope last built"
                      type="date"
                      value={draft.custodyEnvelopeMadeAt}
                      onChange={(value) => setDraft((current) => ({ ...current, custodyEnvelopeMadeAt: sanitizeSuccessionField(value) }))}
                      hint="Date it was last built"
                    />
                    <Field
                      label="Yearly restore drill last run"
                      type="date"
                      value={draft.custodyDrillLastRunAt}
                      onChange={(value) => setDraft((current) => ({ ...current, custodyDrillLastRunAt: sanitizeSuccessionField(value) }))}
                      hint="Date you last walked the drill in part four"
                    />
                    <div className="admin-shelf mt-3">
                      <Brass onClick={() => void saveDraft()}>{saveBusy ? 'Saving' : 'Save'}</Brass>
                      {savedAt && <Mark>Last saved {new Date(savedAt).toLocaleString()}</Mark>}
                    </div>
                    {saveError && <AdminAlert tone="error" live>{saveError}</AdminAlert>}
                    {saveSuccess && <AdminAlert tone="success" live>{saveSuccess}</AdminAlert>}
                  </form>
                </Part>

                <Part number="03" title="Downloads">
                  <Line
                    title="The encrypted archive"
                    state={<Reading tone="wrong">Never share</Reading>}
                    note="Keep it apart from the custody envelope, always."
                  >
                    <div className="admin-shelf">
                      <Brass onClick={() => void downloadArchive()}>
                        {archiveBusy ? 'Preparing' : 'Download encrypted archive'}
                      </Brass>
                    </div>
                    {archiveError && <p className="admin-quiet">{archiveError}</p>}
                  </Line>
                  <Line
                    title="The piece records archive"
                    state={<Reading>Safe to share</Reading>}
                    note="Safe to keep in Google Drive."
                  >
                    <div className="admin-shelf">
                      <Quiet onClick={() => void downloadRecords()}>
                        {recordsBusy ? 'Preparing' : 'Download'}
                      </Quiet>
                      <Quiet onClick={() => void syncRecordsToDrive()}>
                        {driveBusy ? 'Syncing' : 'Sync to Google Drive'}
                      </Quiet>
                    </div>
                    {recordsError && <p className="admin-quiet">{recordsError}</p>}
                    {driveStatus && <p className="admin-quiet">{driveStatus}</p>}
                  </Line>
                </Part>

                <Part number="04" title="Reference">
                  <h3>The Successor's Handbook</h3>
                  <p className="admin-quiet">
                    Generated from docs/registry-custodian-guide.md with your four lines spliced in. This travels
                    with the folder.
                  </p>
                  <details className="admin-fold mt-7">
                    <summary>The handbook in full</summary>
                    <div
                      className={`admin-fold-body ${handbookProseClass}`}
                      // The source is this repository's own settled markdown, run through
                      // successorHandbook.js's own escaping renderer; the only variable
                      // content spliced in is the four fields above, which pass through
                      // that same escaping pass. Nothing here is untrusted third-party HTML.
                      dangerouslySetInnerHTML={{ __html: handbookHtml }}
                    />
                  </details>

                  <h3>The custody rule</h3>
                  <blockquote className="admin-quote">
                    "The passkey and the files must never be stored in the same place. Not in the same drawer, not
                    in the same account, not in the same cloud service. Whoever holds both at once holds the
                    entire registry, so they travel separately and rest separately, always."
                  </blockquote>
                  <blockquote className="admin-quote">
                    "Once a year, or whenever custody changes hands, walk steps one through four with the real
                    held files and a scratch database that is thrown away afterward. Never aim a restore at the
                    live system. A drill that ends with a working scratch copy is proof the succession works. A
                    drill that fails is the best possible time to find out."
                  </blockquote>
                </Part>

                {/* The lock stands at the foot, where a thing you are finished
                    with belongs, rather than above the work. */}
                <div className="admin-movement">
                  <div className="admin-shelf" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <Mark>Private registry access</Mark>
                      <p className="admin-quiet">Unlocked for this session.</p>
                    </div>
                    <Quiet onClick={() => void lock()}>{unlockBusy ? 'Locking' : 'Lock again'}</Quiet>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AdminPage>
  );
};

export default Succession;
