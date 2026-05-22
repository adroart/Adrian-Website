/**
 * POST /api/atlas/steward/claim
 *
 * Public. A collector submits their raw steward key. On a match we:
 *   - Set the steward_session cookie (HMAC-signed, 30 days).
 *   - Update lastClaimAt; flip outreachStatus to 'claimed' on first use.
 *   - Return the current PieceRecord projection so the UI can render.
 */

import type { LedgerEvent, PieceRecord } from '../../../../types';
import { hashStewardKey } from '../../../../utils/stewardKey';
import { projectAll } from '../../../../utils/ledgerProjection';
import type { PagesContext } from '../_helpers';
import {
  json,
  readLedger,
  readStewards,
  writeStewards,
  issueStewardSession,
  stewardSessionCookie,
  isSecureRequest,
} from '../_helpers';

function findRecord(
  events: LedgerEvent[],
  pieceId: string,
  editionNumber?: number,
): PieceRecord | undefined {
  const records = projectAll(events);
  const key = `${pieceId}:${editionNumber ?? 0}`;
  return records.get(key);
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  let body: { rawKey?: unknown };
  try {
    body = (await request.json()) as { rawKey?: unknown };
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const rawKey = typeof body.rawKey === 'string' ? body.rawKey.trim() : '';
  if (!rawKey) {
    return json({ ok: false, error: 'Missing rawKey' }, 400);
  }

  const candidateHash = await hashStewardKey(rawKey);
  const stewards = await readStewards(env);
  const idx = stewards.findIndex((s) => s.keyHash === candidateHash);
  if (idx < 0) {
    return json({ ok: false, error: 'Invalid key' }, 401);
  }

  const match = stewards[idx];
  const isFirstClaim = !match.lastClaimAt;
  stewards[idx] = {
    ...match,
    lastClaimAt: new Date().toISOString(),
    outreachStatus: isFirstClaim ? 'claimed' : match.outreachStatus,
  };
  await writeStewards(env, stewards);

  const token = await issueStewardSession(
    { pieceId: match.pieceId, editionNumber: match.editionNumber },
    env.UPLOAD_SECRET,
  );

  const events = await readLedger(env);
  const record = findRecord(events, match.pieceId, match.editionNumber);

  return new Response(
    JSON.stringify({ ok: true, piece: record ?? null }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': stewardSessionCookie(token, isSecureRequest(request)),
      },
    },
  );
}
