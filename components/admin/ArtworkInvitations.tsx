import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';
import {
  beginInvitationCreateAttempt,
  clearInvitationSecret,
  createInvitation,
  listInvitations,
  revokeInvitation,
  type AdminInvitation,
  type InvitationCreateAttempt,
  type InvitationCreateResult,
} from '../../utils/artworkInvitations';

const inputClass = 'w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass = 'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const buttonClass = 'min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 disabled:opacity-50 transition-colors';

export function reconcileInvitationAttemptForKeeper(
  current: InvitationCreateAttempt | null,
  linkedKeeperPieceId: string,
): InvitationCreateAttempt | null {
  return current?.request.keeperPieceId === linkedKeeperPieceId ? current : null;
}

export function findAvailableInvitationForKeeper(
  invitations: AdminInvitation[],
  linkedKeeperPieceId: string,
): AdminInvitation | null {
  if (!linkedKeeperPieceId) return null;
  return invitations.find((invitation) => (
    invitation.keeperPieceId === linkedKeeperPieceId && invitation.status === 'available'
  )) ?? null;
}

export const ArtworkInvitations: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryKeeperPieceIds = searchParams.getAll('keeperPieceId');
  const linkedKeeperPieceId = queryKeeperPieceIds.length === 1 ? queryKeeperPieceIds[0] : '';
  const [keeperPieceId, setKeeperPieceId] = useState(linkedKeeperPieceId);
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [attempt, setAttempt] = useState<InvitationCreateAttempt | null>(null);
  const [created, setCreated] = useState<InvitationCreateResult | null>(null);
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invitationRows = useRef(new Map<string, HTMLElement>());
  const linkedInvitation = findAvailableInvitationForKeeper(rows, linkedKeeperPieceId);

  useEffect(() => {
    setKeeperPieceId(linkedKeeperPieceId);
    setAttempt((current) => reconcileInvitationAttemptForKeeper(current, linkedKeeperPieceId));
  }, [linkedKeeperPieceId]);

  const load = useCallback(async () => {
    try {
      setRows(await listInvitations());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load invitations.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!linkedInvitation) return;
    const frame = requestAnimationFrame(() => {
      invitationRows.current.get(linkedInvitation.invitationId)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [linkedInvitation?.invitationId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const expiry = new Date(expiresAt);
      if (Number.isNaN(expiry.getTime())) throw new Error('Choose a valid expiry time.');
      const frozen = beginInvitationCreateAttempt(attempt, {
        keeperPieceId,
        intendedRecipientEmail: email,
        expiresAt: expiry.toISOString(),
      });
      setAttempt(frozen);
      setCreated(await createInvitation(frozen.request));
      setAttempt(null);
      setKeeperPieceId('');
      setEmail('');
      setExpiresAt('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the invitation.');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (invitationId: string) => {
    setBusy(true);
    setError('');
    try {
      await revokeInvitation(invitationId);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not revoke the invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Collector registry"
        title="Artwork invitations"
        description="Create one private, single-use invitation for the intended collector."
      />

      {error && <AdminAlert tone="error" live>{error}</AdminAlert>}
      {created?.token && (
        <AdminAlert tone="warning" live>
          <p className="font-semibold">Copy this token now. It cannot be shown again.</p>
          <p className="font-mono break-all select-all mt-2">{created.token}</p>
          <button
            type="button"
            onClick={() => setCreated(clearInvitationSecret(created))}
            className={`${buttonClass} mt-4`}
          >
            Dismiss token
          </button>
        </AdminAlert>
      )}

      <AdminSection title="Invite a collector" description="Use the exact registered instance and the collector's verified email address.">
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="invitation-piece" className={labelClass}>Registered piece ID</label>
            <input id="invitation-piece" value={keeperPieceId} onChange={(event) => { setKeeperPieceId(event.target.value); setAttempt(null); }} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="invitation-email" className={labelClass}>Recipient email</label>
            <input id="invitation-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setAttempt(null); }} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="invitation-expiry" className={labelClass}>Expires</label>
            <input id="invitation-expiry" type="datetime-local" value={expiresAt} onChange={(event) => { setExpiresAt(event.target.value); setAttempt(null); }} required className={inputClass} />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className={buttonClass}>
              {busy ? 'Creating' : 'Create invitation'}
            </button>
          </div>
        </form>
      </AdminSection>

      <AdminSection title="Invitation history">
        {rows.length === 0 ? (
          <AdminEmptyState title="No invitations yet" description="Created invitations will appear here without their private token." />
        ) : (
          <div className="divide-y divide-wood-200 border-y border-wood-200">
            {rows.map((row) => (
              <article
                key={row.invitationId}
                ref={(element) => {
                  if (element) invitationRows.current.set(row.invitationId, element);
                  else invitationRows.current.delete(row.invitationId);
                }}
                tabIndex={linkedInvitation?.invitationId === row.invitationId ? -1 : undefined}
                aria-current={linkedInvitation?.invitationId === row.invitationId ? 'true' : undefined}
                className={`py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 outline-none ${
                  linkedInvitation?.invitationId === row.invitationId
                    ? 'border-l-2 border-bronze-500 pl-4 bg-bronze-50/40'
                    : ''
                }`}
              >
                <div>
                  <p className="font-serif text-xl text-wood-900">{row.artwork.title}</p>
                  <p className="font-sans text-sm text-wood-600 mt-1">
                    {row.intendedRecipientEmail} · {row.status} · expires {new Date(row.expiresAt).toLocaleDateString()}
                  </p>
                  {linkedInvitation?.invitationId === row.invitationId && (
                    <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 mt-2">
                      Selected for this registered piece
                    </p>
                  )}
                </div>
                {row.status === 'available' && (
                  <button type="button" disabled={busy} onClick={() => void revoke(row.invitationId)} className={buttonClass}>
                    Revoke
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </AdminSection>
    </AdminPage>
  );
};

export default ArtworkInvitations;
