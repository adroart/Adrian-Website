import React from 'react';
import { Link } from 'react-router-dom';
import type { ArtworkWorkspace } from '../../utils/artworkWorkspace';
import { AdminPageHeader } from './AdminPage';

const actionClass = 'collector-button-primary text-base!';

function relationshipState(workspace: ArtworkWorkspace | null): string {
  if (!workspace) return 'Loading relationships';
  if (workspace.salesRecord?.state === 'unresolved') return 'Sales record unresolved';
  if (workspace.salesRecord?.state === 'identified') return 'Catalog artwork identified';
  if (workspace.salesRecord?.state === 'identity_linked') {
    return `Sales record linked · caretaker ${workspace.caretaker.state.replace('_', ' ')}`;
  }
  if (workspace.identity) {
    return `Registered · caretaker ${workspace.caretaker.state.replace('_', ' ')}`;
  }
  return 'Catalog record only';
}

export const ArtworkWorkspaceHeader: React.FC<{
  artworkId: string;
  workspace: ArtworkWorkspace | null;
}> = ({ artworkId, workspace }) => (
  <>
    <AdminPageHeader
      eyebrow="Artwork workspace"
      title={workspace?.catalog?.title || `Artwork ${artworkId}`}
      description="One read-only view of this catalog artwork, its exact physical identity, and its private studio relationships."
      actions={workspace?.nextAction ? (
        <div className="max-w-sm">
          <Link className={actionClass} to={workspace?.nextAction?.href}>{workspace.nextAction.label}</Link>
          <p className="mt-2 font-sans text-sm text-wood-600">{workspace.nextAction.reason}</p>
        </div>
      ) : undefined}
    />
    <dl className="mb-8 grid gap-3 border-y border-wood-200 py-4 font-sans text-sm text-wood-700 sm:grid-cols-3">
      <div><dt>Catalog ID</dt><dd>{workspace?.catalog?.artworkId || artworkId}</dd></div>
      <div><dt>Public code</dt><dd>{workspace?.identity?.publicCode || 'Not registered'}</dd></div>
      <div><dt>Relationship state</dt><dd>{relationshipState(workspace)}</dd></div>
    </dl>
  </>
);

export default ArtworkWorkspaceHeader;
