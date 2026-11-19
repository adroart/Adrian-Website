import React from 'react';
import { Link } from 'react-router-dom';
import type { ArtworkWorkspace } from '../../utils/artworkWorkspace';

export default function ArtworkWorkspaceHeader({ artworkId, workspace, backPath, publicHref }: {
  artworkId?: string;
  workspace: ArtworkWorkspace | null;
  backPath: string;
  publicHref: string | null;
}) {
  const id = workspace?.catalog?.artworkId ?? artworkId;
  const edition = workspace?.edition;
  const facts = workspace ? [
    edition?.kind === 'numbered' ? `Edition ${edition.number}` : edition?.kind === 'unique' ? 'Unique work' : null,
    id,
    workspace.identity?.publicCode,
  ].filter(Boolean) : [];
  return (
    <header className="studio-record-header">
      <div className="studio-record-header-links">
        <Link className="studio-record-back" to={backPath}>Back to Artworks</Link>
        {publicHref && <Link className="studio-record-back" to={publicHref}>View public piece</Link>}
      </div>
      <h1>{workspace?.catalog?.title || (id ? `Artwork ${id}` : 'Artwork record')}</h1>
      {facts.length > 0 && <p className="studio-record-facts">{facts.join(' · ')}</p>}
      {workspace?.selectionScope === 'implicit_record'
        && <p className="studio-record-note">Selected from the linked sales record. Use Artworks to choose a different edition.</p>}
    </header>
  );
}
