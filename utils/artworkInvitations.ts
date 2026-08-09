export type InvitationStatus = 'available' | 'used' | 'expired' | 'revoked';

export type PublicArtworkSummary = {
  artworkId: string;
  title: string;
  publicCode: string;
  edition:
    | { kind: 'unique' }
    | { kind: 'numbered'; number: number; size: number | null };
};

export type InvitationInspection = {
  invitationId: string;
  artwork: PublicArtworkSummary;
  status: InvitationStatus;
};

export type InvitationCreateRequest = {
  keeperPieceId: string;
  intendedRecipientEmail: string;
  expiresAt: string;
  idempotencyKey: string;
};

export type InvitationCreateResult = {
  invitationId: string;
  token: string | null;
};

export type InvitationCreateAttempt = Readonly<{
  request: Readonly<InvitationCreateRequest>;
}>;

export type AdminInvitation = InvitationInspection & {
  keeperPieceId: string;
  intendedRecipientEmail: string;
  createdAt: string;
  expiresAt: string;
};

export class InvitationRequestError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new InvitationRequestError(
      response.status,
      typeof data?.error === 'string' ? data.error : 'invitation_request_failed',
    );
  }
  return data;
}

export async function inspectInvitation(token: string): Promise<InvitationInspection> {
  const data = await requestJson('/api/invitations/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return {
    invitationId: data.invitationId,
    artwork: data.artwork,
    status: data.status,
  };
}

export async function redeemInvitation(token: string) {
  return requestJson('/api/invitations/redeem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

export function beginInvitationCreateAttempt(
  current: InvitationCreateAttempt | null,
  draft: Omit<InvitationCreateRequest, 'idempotencyKey'>,
  createKey: () => string = () => crypto.randomUUID(),
): InvitationCreateAttempt {
  if (current) return current;
  return Object.freeze({
    request: Object.freeze({
      keeperPieceId: draft.keeperPieceId.trim(),
      intendedRecipientEmail: draft.intendedRecipientEmail.trim().toLowerCase(),
      expiresAt: draft.expiresAt,
      idempotencyKey: createKey(),
    }),
  });
}

export async function createInvitation(
  request: InvitationCreateRequest,
): Promise<InvitationCreateResult> {
  const data = await requestJson('/api/admin/invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return { invitationId: data.invitationId, token: data.token };
}

export function clearInvitationSecret(
  invitation: InvitationCreateResult,
): InvitationCreateResult {
  return { invitationId: invitation.invitationId, token: null };
}

export async function listInvitations(): Promise<AdminInvitation[]> {
  const data = await requestJson('/api/admin/invitations');
  return Array.isArray(data.invitations) ? data.invitations : [];
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  await requestJson('/api/admin/invitations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invitationId }),
  });
}
