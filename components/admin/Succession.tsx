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
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminAlert, AdminPage, AdminPageHeader, AdminSection, adminUI } from './AdminPage';
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
  'font-serif text-[15px] leading-relaxed text-wood-700',
  '[&_h1]:font-title [&_h1]:text-2xl [&_h1]:text-wood-900 [&_h1]:mb-4',
  '[&_h2]:font-title [&_h2]:text-xl [&_h2]:text-wood-900 [&_h2]:mt-9 [&_h2]:mb-2',
  '[&_h3]:italic [&_h3]:text-wood-800 [&_h3]:mt-6 [&_h3]:mb-2',
  '[&_p]:mb-3', '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3', '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3',
  '[&_li]:mb-1', '[&_strong]:font-semibold [&_strong]:text-wood-900',
  '[&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-wood-100 [&_code]:px-1 [&_code]:break-all',
  '[&_pre]:bg-wood-100 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-3 [&_pre_code]:bg-transparent [&_pre_code]:break-normal',
].join(' ');

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

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Continuity"
        title="Succession"
        description="This is the encrypted copy of the private registry, the thing that lets a museum or a family member continue the registry if you cannot. It is not the offline ledger and it is not the piece records archive; there are three exports and they are easy to confuse, so this page keeps them apart and gives the succession plan itself a real home."
      />

      <AdminAlert tone="info">
        Three exports exist. The offline ledger (secret-free, on the{' '}
        <Link to="/admin/pieces" className="underline underline-offset-4">Plate registry desk</Link>) proves the
        public lineage chain. The piece records archive, below, is every public record page, safe to share on its
        own. This encrypted archive is the only one of the three that can rebuild the whole private registry from
        nothing, and the only one that must never be shared.
      </AdminAlert>

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
          <AdminSection title="Private registry access">
            <div className="flex items-center justify-between gap-4">
              <Body>Unlocked for this session.</Body>
              <Quiet onClick={() => void lock()}>{unlockBusy ? 'Locking' : 'Lock again'}</Quiet>
            </div>
          </AdminSection>

          {loading && (
            <AdminSection title="The state of the succession">
              <Body>Reading the succession state.</Body>
            </AdminSection>
          )}
          {loadError && <AdminAlert tone="error" live>{loadError}</AdminAlert>}

          {!loading && !loadError && (
            <>
              {!fields.custodyEnvelopeMadeAt && (
                <AdminAlert tone="warning" live>
                  <Body size={14}>
                    No custody envelope has been recorded. The envelope is the one file that carries the
                    encrypted archive's keys out of Cloudflare, and Cloudflare can never hand those keys back
                    once they leave. Without it, if this Cloudflare account were ever lost, the encrypted
                    archive could never be opened again: the private layer of the registry, who holds each
                    piece and every collector's Ownership Code, would be gone. The permanent records and the
                    public history would still survive. Only the private layer depends on this one file.
                  </Body>
                  <Body size={14} top={10}>Build it, then come back and record the date below.</Body>
                  <pre
                    style={{
                      marginTop: 10,
                      padding: '10px 14px',
                      background: 'rgba(0,0,0,0.28)',
                      fontFamily: 'monospace',
                      fontSize: 13,
                      overflowX: 'auto',
                    }}
                  >
                    {CUSTODY_ENVELOPE_COMMAND}
                  </pre>
                </AdminAlert>
              )}

              <AdminSection
                title="The state of the succession, honestly"
                description="Every line below is either a real read from this server or an admission that it does not know."
              >
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
                <Ledger label="When the archive was last taken" value={<State tone="quiet">Not known here</State>} />
                <Note top={8}>
                  The server keeps no record of when the encrypted archive was last downloaded. The only record is
                  the timestamp inside the filename of whichever copy you are holding, registry-private-recovery-
                  &lt;timestamp&gt;.json.
                </Note>
                <Ledger
                  label="Custody envelope"
                  value={
                    <State tone={fields.custodyEnvelopeMadeAt ? 'warm' : 'wrong'}>
                      {fields.custodyEnvelopeMadeAt ? `Recorded, ${fields.custodyEnvelopeMadeAt}` : 'Not recorded'}
                    </State>
                  }
                />
                <Note top={8}>
                  The envelope is a file you hold offline, apart from this archive. This interface never
                  receives it and has no way to check whether it exists or which archive it opens.
                  {fields.custodyEnvelopeMadeAt
                    ? ' The date above is only your own record that you built it, not something this page verified.'
                    : ' Nothing has been recorded yet.'}
                </Note>
                <Ledger
                  label="Yearly drill"
                  value={
                    <State tone={fields.custodyDrillLastRunAt ? 'warm' : 'brass'}>
                      {fields.custodyDrillLastRunAt ? `Recorded, ${fields.custodyDrillLastRunAt}` : 'Not recorded'}
                    </State>
                  }
                />
                <Note top={8}>
                  Nothing here can watch a drill happen.
                  {fields.custodyDrillLastRunAt
                    ? ' The date above is only your own record that you walked it, not something this page verified.'
                    : ' Record the date below once you have walked the drill described further down this page.'}
                </Note>
              </AdminSection>

              <AdminSection
                title="The three blanks"
                description="The handbook below has lines waiting for your own handwriting. Type them here and they travel into the rendered handbook. The physical act, paper and seal, still happens away from any screen; this only stops the interface from staying silent about it."
              >
                <form onSubmit={saveDraft} className="grid gap-6 max-w-lg">
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
                  <div className="flex items-center gap-4">
                    <Brass onClick={() => void saveDraft()}>{saveBusy ? 'Saving' : 'Save'}</Brass>
                    {savedAt && <Note>Last saved {new Date(savedAt).toLocaleString()}</Note>}
                  </div>
                  {saveError && <Note>{saveError}</Note>}
                  {saveSuccess && <Note>{saveSuccess}</Note>}
                </form>
              </AdminSection>

              <AdminSection
                title="The custody envelope, and the yearly drill"
                description="Neither can be read from here, so these are your own dates: when the envelope was last built, and when the yearly restore drill was last walked against a scratch database. Typing a date does not verify the act happened; it only stops this page from staying silent about it."
              >
                <form onSubmit={saveDraft} className="grid gap-6 max-w-lg">
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
                    hint="When you last walked the drill described further down this page"
                  />
                  <div className="flex items-center gap-4">
                    <Brass onClick={() => void saveDraft()}>{saveBusy ? 'Saving' : 'Save'}</Brass>
                    {savedAt && <Note>Last saved {new Date(savedAt).toLocaleString()}</Note>}
                  </div>
                  {saveError && <Note>{saveError}</Note>}
                  {saveSuccess && <Note>{saveSuccess}</Note>}
                </form>
              </AdminSection>

              <AdminSection
                title="Take the folder"
                description="The encrypted archive is the one that matters most and the one that must never be shared. The piece records archive beside it is public-safe."
              >
                <div className="flex flex-wrap items-center gap-4">
                  <Brass onClick={() => void downloadArchive()}>
                    {archiveBusy ? 'Preparing' : 'Download encrypted archive'}
                  </Brass>
                  <Quiet onClick={() => void downloadRecords()}>
                    {recordsBusy ? 'Preparing' : 'Download piece records archive'}
                  </Quiet>
                  <Quiet onClick={() => void syncRecordsToDrive()}>
                    {driveBusy ? 'Syncing' : 'Sync piece records to Google Drive'}
                  </Quiet>
                </div>
                {archiveError && <Note top={10}>{archiveError}</Note>}
                {recordsError && <Note top={10}>{recordsError}</Note>}
                {driveStatus && <Note top={10}>{driveStatus}</Note>}
                <Note top={14}>
                  The offline ledger lives on the <Link to="/admin/pieces" className="underline underline-offset-4">Plate registry desk</Link>, where it already has its own download and Drive sync.
                </Note>
              </AdminSection>

              <AdminSection
                title="The Successor's Handbook"
                description="Generated from docs/registry-custodian-guide.md, with the blanks above spliced in. This is what travels with the folder."
              >
                <div
                  className={handbookProseClass}
                  // The source is this repository's own settled markdown, run through
                  // successorHandbook.js's own escaping renderer; the only variable
                  // content spliced in is the four fields above, which pass through
                  // that same escaping pass. Nothing here is untrusted third-party HTML.
                  dangerouslySetInnerHTML={{ __html: handbookHtml }}
                />
              </AdminSection>

              <AdminSection title="The custody rule">
                <blockquote className="border-l-2 border-bronze-500 pl-5 font-serif text-wood-800 italic mb-6">
                  "The passkey and the files must never be stored in the same place. Not in the same drawer, not in
                  the same account, not in the same cloud service. Whoever holds both at once holds the entire
                  registry, so they travel separately and rest separately, always."
                </blockquote>
                <blockquote className="border-l-2 border-bronze-500 pl-5 font-serif text-wood-800 italic">
                  "Once a year, or whenever custody changes hands, walk steps one through four with the real held
                  files and a scratch database that is thrown away afterward. Never aim a restore at the live
                  system. A drill that ends with a working scratch copy is proof the succession works. A drill that
                  fails is the best possible time to find out."
                </blockquote>
              </AdminSection>
            </>
          )}
        </>
      )}
    </AdminPage>
  );
};

export default Succession;
