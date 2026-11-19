import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  loadArtworkWorkspace,
  type ArtworkWorkspace as ArtworkWorkspaceData,
  type ArtworkWorkspaceSelector,
} from '../../utils/artworkWorkspace';
import { AdminEmptyState, AdminPage } from './AdminPage';
import ArtworkWorkspaceHeader from './ArtworkWorkspaceHeader';

type WorkspaceStatus = 'loading' | 'ready' | 'missing' | 'invalid' | 'conflict' | 'inconsistent' | 'error';

function oneQueryValue(searchParams: URLSearchParams, key: 'instance' | 'record'): string | undefined {
  const values = searchParams.getAll(key);
  if (values.length > 1) throw new Error('workspace_selector_conflict');
  const value = values[0];
  if (value === undefined) return undefined;
  if (!value || value !== value.trim()) throw new Error('workspace_selector_conflict');
  return value;
}

export function artworkWorkspaceSelector(
  artworkId: string | undefined,
  searchParams: URLSearchParams,
): ArtworkWorkspaceSelector {
  if (!artworkId || artworkId !== artworkId.trim()) throw new Error('workspace_not_found');
  if ([...searchParams.keys()].some((key) => key !== 'instance' && key !== 'record')) {
    throw new Error('workspace_selector_conflict');
  }
  const keeperPieceId = oneQueryValue(searchParams, 'instance');
  const artistArtworkRecordId = oneQueryValue(searchParams, 'record');
  return {
    artworkId,
    ...(keeperPieceId ? { keeperPieceId } : {}),
    ...(artistArtworkRecordId ? { artistArtworkRecordId } : {}),
  };
}

function queryPath(path: string, values: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) query.set(key, value);
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

type RecordAction = { href: string; label: string; primary?: boolean };

export function artworkPlateDestination(
  keeperPieceId: string | null | undefined,
  plate: ArtworkWorkspaceData['plate'],
): RecordAction | null {
  if (!keeperPieceId || !plate) return null;
  const needsIdentityProof = (plate.recoveryState === 'identity_missing' || plate.recoveryState === 'identity_stale')
    && ['legacy', 'generated', 'active'].includes(plate.state);
  if (needsIdentityProof) return {
    href: queryPath('/admin/pieces/wizard', { keeperPieceId, proof: 'identity' }),
    label: 'Verify identity recovery',
  };
  const canResume = 'wizardStage' in plate
    ? plate.wizardStage != null
    : plate.state === 'generated' || (plate.state === 'active'
      && ['plate_recovery_missing', 'plate_recovery_stale'].includes(plate.recoveryState));
  return canResume ? {
    href: queryPath('/admin/pieces/wizard', { keeperPieceId }),
    label: 'Open plate and recovery wizard',
  } : {
    href: queryPath('/admin/pieces', { keeperPieceId }),
    label: 'Open plate registry',
  };
}

const certificateFields = {
  materials: 'Materials',
  makers: 'Makers and roles',
  origin: 'Origin',
  techniques: 'Techniques',
  yearWording: 'Year wording',
  editionWording: 'Edition wording',
  certificateWording: 'Certificate wording',
  openingWording: 'Opening wording',
};

const recoveryText = {
  identity_missing: 'Identity recovery proof needed',
  identity_stale: 'Identity recovery proof out of date',
  plate_backup_missing: 'Plate backup needed',
  plate_recovery_missing: 'Plate recovery proof needed',
  plate_recovery_stale: 'Plate recovery proof out of date',
  current: 'Recovery proof current',
  not_required: 'Identity recovery proof current',
};

const plateText = {
  legacy: 'No fabricated plate on record',
  generated: 'Plate prepared',
  active: 'Plate active',
  void: 'Plate voided',
  superseded: 'Plate replaced',
};

function recordListPath(state: unknown) {
  if (state && typeof state === 'object' && 'artworkListReturnPath' in state
    && typeof state.artworkListReturnPath === 'string'
    && /^\/admin\/artworks(?:\?[^#\s]*)?$/.test(state.artworkListReturnPath)) {
    return state.artworkListReturnPath;
  }
  return '/admin/artworks';
}

function RecordSection({ id, title, status, note, action, secondary, returnState }: {
  id: string;
  title: string;
  status: string;
  note?: string;
  action?: RecordAction | null;
  secondary?: RecordAction | null;
  returnState: { artworkReturnPath: string; artworkListReturnPath: string };
}) {
  return (
    <section id={id} className="studio-record-section" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{title}</h2>
      <div className="studio-record-summary">
        <p className="studio-record-status">{status}</p>
        {note && <p className="studio-record-note">{note}</p>}
      </div>
      {action && <div className="studio-record-section-actions">
        {[action, secondary].filter((item): item is RecordAction => Boolean(item)).map(item => (
          <Link key={item.href} className={`studio-record-action${item.primary ? ' studio-record-primary' : ''}`}
            to={item.href} state={returnState}>{item.label}</Link>
        ))}
      </div>}
    </section>
  );
}

const activityDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const activityTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function WorkspaceSummaries({ workspace, artworkReturnPath, artworkListReturnPath }: {
  workspace: ArtworkWorkspaceData;
  artworkReturnPath: string;
  artworkListReturnPath: string;
}) {
  const returnState = { artworkReturnPath, artworkListReturnPath };
  const artworkId = workspace.catalog?.artworkId;
  const keeperPieceId = workspace.identity?.keeperPieceId;
  const recordId = workspace.salesRecord?.artworkRecordId;
  const next = workspace.nextAction;
  const plate = workspace.plate;
  const plateAction = artworkPlateDestination(keeperPieceId, plate);
  const registryPath = keeperPieceId ? queryPath('/admin/pieces', { keeperPieceId }) : null;
  const maintenancePath = keeperPieceId ? queryPath('/admin/maintenance', { artworkId, keeperPieceId }) : null;
  const certificatePath = artworkId ? queryPath('/admin/certificates', { artworkId }) : null;
  const invitePath = keeperPieceId && plate?.state !== 'void' && plate?.state !== 'superseded'
    ? queryPath('/admin/invitations', { keeperPieceId }) : null;
  const legacyPath = workspace.legacySaleVerificationPath
    ?? (next?.href.includes('source=legacy_acquisition') ? next.href : null);
  const registrationAction = !keeperPieceId && next?.href.startsWith('/admin/registrations?') ? next : null;
  const salePath = recordId
    ? queryPath('/admin/collector-sales', { artistArtworkRecordId: recordId, keeperPieceId })
    : null;
  const outstandingRecovery = plate && !['current', 'not_required'].includes(plate.recoveryState)
    && plate.state !== 'void' && plate.state !== 'superseded';
  const primaryHref = (outstandingRecovery && plateAction?.href)
    || registrationAction?.href
    || (next?.href.startsWith('/admin/certificates?') ? certificatePath : null)
    || (next?.href.startsWith('/admin/invitations?') ? invitePath : null)
    || (next?.href === legacyPath ? legacyPath : null);

  const action = (href: string | null | undefined, label: string): RecordAction | null =>
    href ? { href, label, primary: href === primaryHref } : null;
  const identityAction = registrationAction
    ? action(registrationAction.href, 'Register artwork identity')
    : plateAction && action(plateAction.href, plateAction.label === 'Verify identity recovery' ? 'Verify recovery' : plateAction.label);
  const identitySecondary = registryPath && identityAction?.href !== registryPath
    ? action(registryPath, 'Plate registry') : null;

  const missingFacts = workspace.certificate.missingFields.map(field => certificateFields[field].toLowerCase());
  const certificateStatus = missingFacts.length
    ? `${missingFacts.length} certificate ${missingFacts.length === 1 ? 'fact' : 'facts'} missing`
    : workspace.certificate.state === 'complete' ? 'Certificate facts complete' : 'Certificate unavailable';
  const certificateNote = certificatePath
    ? (missingFacts.length && missingFacts.length <= 3 ? `Add ${missingFacts.join(', ')}. ` : '')
      + 'Edits apply to all editions.'
    : undefined;

  const saleStatus = workspace.sale?.state === 'verified' ? 'Sale verified'
    : workspace.sale?.state === 'legacy_candidate' ? 'Earlier sale needs verification'
    : recordId ? 'Sales record on file' : 'No sale recorded';
  const ledgerLabel = workspace.sale?.state === 'verified' ? 'Open sale and ledger' : 'Open sales record';
  const saleAction = action(legacyPath, 'Verify earlier sale') ?? action(salePath, ledgerLabel);
  const saleSecondary = legacyPath ? action(salePath, ledgerLabel) : null;

  const keeperStatus = {
    active: 'Piece claimed',
    unclaimed: 'Piece unclaimed',
    released: 'Keeper released the piece',
    not_registered: recordId ? 'Register the piece before inviting a keeper' : 'Choose an edition to view keeper status',
  }[workspace.caretaker.state];
  const invitationNote = workspace.invitation ? {
    available: 'Invitation ready to use.',
    redeemed: 'Invitation accepted.',
    revoked: 'Last invitation withdrawn.',
    expired: 'Last invitation expired.',
  }[workspace.invitation.state] : keeperPieceId && workspace.caretaker.state === 'unclaimed'
    ? 'No invitation on file.' : undefined;
  const invitationLabel = workspace.invitation?.state === 'available'
    ? 'View open invitation' : workspace.caretaker.state === 'unclaimed' ? 'Create invitation' : 'View invitations';

  return (
    <>
      <RecordSection id="artwork-plate-recovery" title="Identity and recovery" returnState={returnState}
        status={plate ? recoveryText[plate.recoveryState] : keeperPieceId ? 'Identity registered'
          : recordId ? 'Identity awaiting registration' : 'No edition selected'}
        note={plate ? plateText[plate.state] : !recordId && !keeperPieceId ? 'Choose a registered piece in Artworks.' : undefined}
        action={identityAction} secondary={identitySecondary} />
      <RecordSection id="artwork-record-certificate" title="Certificate" returnState={returnState}
        status={certificateStatus} note={certificateNote}
        action={action(certificatePath, 'Edit certificate')} />
      <RecordSection id="artwork-sale-ledger" title="Sale and ledger" returnState={returnState}
        status={saleStatus} action={saleAction} secondary={saleSecondary} />
      <RecordSection id="artwork-invitation-caretaker" title="Keeper" returnState={returnState}
        status={keeperStatus} note={invitationNote} action={action(invitePath, invitationLabel)} />
      <section className="studio-record-history" id="artwork-maintenance-history" aria-labelledby="artwork-activity-title">
        <div className="studio-record-history-heading">
          <h2 id="artwork-activity-title">Recent activity</h2>
          {maintenancePath && <Link className="studio-record-action" to={maintenancePath}
            state={returnState}>Open Maintenance</Link>}
        </div>
        {workspace.activity.length ? (
          <ol className="studio-record-events">
            {workspace.activity.map((item, index) => {
              const date = new Date(item.occurredAt);
              return <li key={`${item.occurredAt}:${item.kind}:${item.label}:${index}`}>
                <span>{item.label}</span>
                <time dateTime={item.occurredAt}>{activityDate.format(date)} · {activityTime.format(date)}</time>
              </li>;
            })}
          </ol>
        ) : <p className="studio-record-note">No activity recorded yet.</p>}
      </section>
    </>
  );
}

const errorCopy = {
  invalid: 'This record link is invalid. Open the piece again from Artworks.',
  conflict: 'The selected artwork, edition, and sales record do not identify the same artwork. Open the piece again from Artworks.',
  inconsistent: 'The saved identity and sales record disagree. Check the exact piece in Artworks.',
  error: 'The artwork record could not be loaded.',
};

function WorkspaceView({ artworkId, route, backPath, query }: {
  artworkId: string | undefined;
  route: string;
  backPath: string;
  query: string;
}) {
  const [workspace, setWorkspace] = useState<ArtworkWorkspaceData | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('loading');
  const [attempt, setAttempt] = useState(0);
  const statusRef = useRef<HTMLDivElement>(null);
  const selector = useMemo(() => {
    try {
      return artworkWorkspaceSelector(artworkId, new URLSearchParams(query));
    } catch (error) {
      return error;
    }
  }, [artworkId, query]);

  useEffect(() => {
    const controller = new AbortController();
    if (selector instanceof Error) {
      setStatus(selector.message === 'workspace_not_found' ? 'missing' : 'invalid');
      return () => controller.abort();
    }
    void loadArtworkWorkspace(selector, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setWorkspace(result);
        setStatus('ready');
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        const code = error instanceof Error ? error.message : '';
        setStatus(code === 'workspace_not_found' ? 'missing'
          : code === 'workspace_selector_conflict' ? 'conflict'
          : code === 'workspace_data_corrupt' ? 'inconsistent' : 'error');
      });
    return () => controller.abort();
  }, [selector, attempt]);

  useEffect(() => {
    if (status !== 'ready' && status !== 'loading') statusRef.current?.focus();
  }, [status]);

  const code = workspace?.identity?.publicCode;
  const publicHref = workspace?.catalog && code && workspace.plate?.state !== 'void'
    ? queryPath(`/works/${encodeURIComponent(workspace.catalog.artworkId)}`, { instance: code }) : null;

  return (
    <AdminPage width="wide">
      <div className="studio-record">
        <ArtworkWorkspaceHeader artworkId={artworkId} workspace={workspace} backPath={backPath} publicHref={publicHref} />
        {status === 'loading' && <p role="status" className="studio-record-message">Loading artwork workspace.</p>}
        {status === 'missing' && <div ref={statusRef} tabIndex={-1}>
          <AdminEmptyState title="Artwork workspace not found" description="Open Artworks to find a registered piece." />
        </div>}
        {status in errorCopy && <div ref={statusRef} tabIndex={-1} className="studio-record-message">
          <p role="alert">{errorCopy[status as keyof typeof errorCopy]}</p>
          {status === 'error' && <button type="button" className="studio-record-action" onClick={() => {
            setStatus('loading');
            setAttempt(current => current + 1);
          }}>Retry</button>}
        </div>}
        {status === 'ready' && workspace && <WorkspaceSummaries workspace={workspace} artworkReturnPath={route} artworkListReturnPath={backPath} />}
      </div>
    </AdminPage>
  );
}

export default function ArtworkWorkspace() {
  const { artworkId } = useParams<{ artworkId: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const route = location.pathname + location.search;
  return <WorkspaceView key={route} artworkId={artworkId} route={route}
    query={searchParams.toString()} backPath={recordListPath(location.state)} />;
}
