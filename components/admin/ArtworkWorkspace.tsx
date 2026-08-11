import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  loadArtworkWorkspace,
  type ArtworkWorkspace as ArtworkWorkspaceData,
  type ArtworkWorkspaceSelector,
} from '../../utils/artworkWorkspace';
import { AdminAlert, AdminEmptyState, AdminPage, AdminSection } from './AdminPage';
import ArtworkWorkspaceHeader from './ArtworkWorkspaceHeader';

type WorkspaceStatus = 'loading' | 'ready' | 'missing' | 'conflict' | 'error';

const linkClass = 'font-sans text-base font-semibold text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:text-bronze-900';

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

type PlateDestination = { href: string; label: string };

export function artworkPlateDestination(
  keeperPieceId: string | null | undefined,
  plate: ArtworkWorkspaceData['plate'],
): PlateDestination | null {
  if (!keeperPieceId || !plate) return null;
  const wizardActionable = plate.state === 'generated'
    || (plate.state === 'active'
      && (plate.recoveryState === 'plate_recovery_missing'
        || plate.recoveryState === 'plate_recovery_stale'));
  return wizardActionable
    ? {
        href: queryPath('/admin/pieces/wizard', { keeperPieceId }),
        label: 'Open plate and recovery wizard',
      }
    : {
        href: queryPath('/admin/pieces', { keeperPieceId }),
        label: 'Open exact piece in plate registry',
      };
}

function workspaceWithUsefulPlateAction(
  workspace: ArtworkWorkspaceData,
): ArtworkWorkspaceData {
  if (!workspace.nextAction?.href.startsWith('/admin/pieces/wizard?')) return workspace;
  const destination = artworkPlateDestination(
    workspace.identity?.keeperPieceId,
    workspace.plate,
  );
  if (!destination || destination.href.startsWith('/admin/pieces/wizard?')) return workspace;
  return {
    ...workspace,
    nextAction: {
      ...destination,
      reason: 'Review this exact physical identity in the plate registry.',
    },
  };
}

function stateLabel(value: string | null | undefined): string {
  return value ? value.replaceAll('_', ' ') : 'Not recorded';
}

function DefinitionList({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid gap-4 font-sans text-base text-wood-700 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 border-t border-wood-200 pt-3">
          <dt className="font-semibold text-wood-900">{label}</dt>
          <dd className="mt-1 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WorkspaceSummaries({ workspace }: { workspace: ArtworkWorkspaceData }) {
  const artworkId = workspace.catalog?.artworkId;
  const keeperPieceId = workspace.identity?.keeperPieceId;
  const artistArtworkRecordId = workspace.salesRecord?.artworkRecordId;
  const plateDestination = artworkPlateDestination(keeperPieceId, workspace.plate);
  const publicPath = artworkId
    ? queryPath(`/works/${encodeURIComponent(artworkId)}`, {
        instance: workspace.identity?.publicCode,
      })
    : null;

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      <div id="artwork-record-certificate" className="min-w-0">
        <AdminSection title="Record and certificate">
          <DefinitionList items={[
            ['Sales artwork record', artistArtworkRecordId || 'No sales artwork record'],
            ['Record relationship', stateLabel(workspace.salesRecord?.state)],
            ['Certificate', stateLabel(workspace.certificate.state)],
            ['Missing certificate facts', workspace.certificate.missingFields.length
              ? workspace.certificate.missingFields.map(stateLabel).join(', ') : 'None'],
          ]} />
          <div className="mt-5 flex flex-wrap gap-4">
            {artistArtworkRecordId && <Link className={linkClass} to={queryPath('/admin/collector-sales', { artistArtworkRecordId, keeperPieceId })}>Open sales record</Link>}
            {artworkId && <Link className={linkClass} to={queryPath('/admin/certificates', { artworkId })}>Open certificate editor</Link>}
          </div>
        </AdminSection>
      </div>

      <div id="artwork-sale-ledger" className="min-w-0">
        <AdminSection title="Verified sale and artwork ledger">
          {workspace.sale || artistArtworkRecordId ? (
            <>
              <DefinitionList items={[
                ['Verified sale', stateLabel(workspace.sale?.state)],
                ['Verified sale ID', workspace.sale?.verifiedSaleId || 'Not verified'],
                ['Artwork ledger', artistArtworkRecordId ? 'Available in the sales record' : 'No ledger linked'],
              ]} />
              {artistArtworkRecordId && <p className="mt-5"><Link className={linkClass} to={queryPath('/admin/collector-sales', { artistArtworkRecordId, keeperPieceId })}>Open verified sale and ledger</Link></p>}
            </>
          ) : <AdminEmptyState title="No sale relationship" description="No verified sale or artwork ledger is linked to this catalog record." />}
        </AdminSection>
      </div>

      <div id="artwork-invitation-caretaker" className="min-w-0">
        <AdminSection title="Invitation and caretaker state">
          <DefinitionList items={[
            ['Invitation', stateLabel(workspace.invitation?.state)],
            ['Invitation ID', workspace.invitation?.invitationId || 'Not recorded'],
            ['Caretaker', stateLabel(workspace.caretaker.state)],
          ]} />
          {keeperPieceId && <p className="mt-5"><Link className={linkClass} to={queryPath('/admin/invitations', { keeperPieceId })}>Open invitations</Link></p>}
        </AdminSection>
      </div>

      <div id="artwork-public-preview" className="min-w-0">
        <AdminSection title="Public piece preview">
          <DefinitionList items={[
            ['Catalog ID', artworkId || 'Not resolved'],
            ['Public code', workspace.identity?.publicCode || 'Not registered'],
          ]} />
          {publicPath
            ? <p className="mt-5"><Link className={linkClass} to={publicPath}>Open public piece preview</Link></p>
            : <AdminEmptyState title="No public preview" description="This record does not resolve to a catalog artwork." />}
        </AdminSection>
      </div>

      <div id="artwork-plate-recovery" className="min-w-0">
        <AdminSection title="Plate and recovery">
          <DefinitionList items={[
            ['Plate', stateLabel(workspace.plate?.state)],
            ['Recovery', stateLabel(workspace.plate?.recoveryState)],
            ['Physical identity', keeperPieceId || 'Not registered'],
          ]} />
          {plateDestination && <p className="mt-5"><Link className={linkClass} to={plateDestination.href}>{plateDestination.label}</Link></p>}
        </AdminSection>
      </div>

      <div id="artwork-maintenance-history" className="min-w-0">
        <AdminSection title="Maintenance and custody history">
          {workspace.activity.length ? (
            <ol className="space-y-3">
              {workspace.activity.map((item) => (
                <li key={`${item.occurredAt}:${item.kind}:${item.label}`} className="border-l-2 border-wood-200 pl-4">
                  <p className="font-sans text-base text-wood-900">{item.label}</p>
                  <p className="font-sans text-sm text-wood-600">{new Date(item.occurredAt).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          ) : <AdminEmptyState title="No history yet" description="Maintenance and custody activity will appear here when it is recorded." />}
          {(artworkId || keeperPieceId) && <p className="mt-5"><Link className={linkClass} to={queryPath('/admin/maintenance', { artworkId, keeperPieceId })}>Open Maintenance</Link></p>}
        </AdminSection>
      </div>
    </div>
  );
}

const ArtworkWorkspace: React.FC = () => {
  const { artworkId } = useParams<{ artworkId: string }>();
  const [searchParams] = useSearchParams();
  const query = searchParams.toString();
  const stableArtworkId = artworkId || 'unknown';
  const [workspace, setWorkspace] = useState<ArtworkWorkspaceData | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus>('loading');
  const statusRef = useRef<HTMLDivElement>(null);
  const selector = useMemo(() => {
    try {
      return artworkWorkspaceSelector(artworkId, new URLSearchParams(query));
    } catch (error) {
      return error;
    }
  }, [artworkId, query]);
  const headerWorkspace = workspace ? workspaceWithUsefulPlateAction(workspace) : null;

  useEffect(() => {
    const controller = new AbortController();
    setWorkspace(null);
    setStatus('loading');

    if (selector instanceof Error) {
      setStatus(selector.message === 'workspace_not_found' ? 'missing' : 'conflict');
      window.requestAnimationFrame(() => statusRef.current?.focus());
      return () => controller.abort();
    }

    void loadArtworkWorkspace(selector, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setWorkspace(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted
          || (error instanceof DOMException && error.name === 'AbortError')) return;
        const code = error instanceof Error ? error.message : 'artwork_workspace_request_failed';
        setStatus(code === 'workspace_not_found' ? 'missing'
          : code === 'workspace_selector_conflict' || code === 'workspace_data_corrupt'
            ? 'conflict' : 'error');
        window.requestAnimationFrame(() => statusRef.current?.focus());
      });

    return () => controller.abort();
  }, [selector]);

  return (
    <AdminPage width="wide">
      <ArtworkWorkspaceHeader artworkId={stableArtworkId} workspace={headerWorkspace} />

      {status === 'loading' && <AdminAlert tone="info" live>Loading artwork workspace.</AdminAlert>}
      {status === 'missing' && (
        <div ref={statusRef} tabIndex={-1}>
          <AdminEmptyState title="Artwork workspace not found" description="No catalog artwork or matching relationship was found for this exact route." />
        </div>
      )}
      {status === 'conflict' && (
        <div ref={statusRef} tabIndex={-1}>
          <AdminAlert tone="error" live>The catalog, physical instance, and sales record do not identify the same artwork. Return to the source record and open the exact artwork again.</AdminAlert>
        </div>
      )}
      {status === 'error' && (
        <div ref={statusRef} tabIndex={-1}>
          <AdminAlert tone="error" live>The artwork workspace could not be loaded. Reload this page to try again.</AdminAlert>
        </div>
      )}
      {status === 'ready' && workspace && <WorkspaceSummaries workspace={workspace} />}
    </AdminPage>
  );
};

export default ArtworkWorkspace;
