/**
 * POST /api/atlas/stewards/issue
 *
 * Admin-only. Generate a fresh steward key for a piece, persist its hash,
 * and return the raw key ONCE. The raw value never lands in R2.
 */

import type { StewardRecord } from '../../../../types';
import {
  generateStewardKey,
  hashStewardKey,
} from '../../../../utils/stewardKey';
import type { PagesContext } from '../_helpers';
import {
  isAdmin,
  json,
  readStewards,
  writeStewards,
} from '../_helpers';

interface IssueBody {
  pieceId?: unknown;
  editionNumber?: unknown;
  name?: unknown;
  email?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: IssueBody;
  try {
    body = (await request.json()) as IssueBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) {
    return json({ ok: false, error: 'Missing pieceId' }, 400);
  }
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;
  const name = typeof body.name === 'string' ? body.name : undefined;
  const email = typeof body.email === 'string' ? body.email : undefined;

  const stewards = await readStewards(env);

  // One steward per (pieceId, editionNumber) tuple. Editioned pieces can
  // have separate stewards per copy.
  const exists = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (exists) {
    return json(
      { ok: false, error: 'A steward already exists for this piece' },
      400,
    );
  }

  const rawKey = generateStewardKey();
  const keyHash = await hashStewardKey(rawKey);
  const record: StewardRecord = {
    pieceId,
    editionNumber,
    name,
    email,
    keyHash,
    keyIssuedAt: new Date().toISOString(),
    outreachStatus: 'invited',
  };

  stewards.push(record);
  await writeStewards(env, stewards);

  return json({
    ok: true,
    rawKey,
    warning: 'This key will only be shown once. Print or copy it now.',
  });
}
