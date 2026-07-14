/**
 * requestContestedClaim(env, claim)
 *
 * Fires a CONTESTED-claim handoff to mandalacodes when a steward bind hits a
 * piece that already has a current steward. Adrian-Website is the front door a
 * collector scans, but the patient multi-warning escalation window and the
 * one claim-request store (R2 atlas/claimRequests.json) both live on the
 * mandalacodes side. Rather than fork that store or duplicate the escalation
 * logic here, this bridge POSTs the requester's already-verified identity to
 * mandalacodes' machine-auth claim-bridge endpoint, which appends the request
 * to the SINGLE source of truth and lets the existing routing, dedupe, rate
 * limit, and resolve flow Just Work.
 *
 * INTEGRATION SHAPE (decision, recorded here and in bind.js): shape (1) of the
 * two the brief offered; one shared store, server-to-server. Adrian-Website
 * does NOT bind the atlas R2 bucket (see wrangler.toml: only MUSIC_BUCKET +
 * the shared D1), so it cannot write atlas/claimRequests.json directly. And
 * mandalacodes' user-facing request-claim endpoint authenticates with a Better
 * Auth SESSION cookie, which is per-domain and cannot be forwarded from
 * adrianrasmussen.com. So the bridge is a machine-to-machine call carrying the
 * requester's verified userId + email, authenticated exactly like the proven
 * M4 sale webhook (utils/saleBridge / _lib/atlasSale): HMAC-SHA256 over
 * `${timestamp}.${rawBody}` with a dedicated shared secret, a unix-seconds
 * timestamp re-stamped per attempt, and an idempotent receiver.
 *
 * AUTH: the requester's session is validated on THIS side (requireUser in
 * bind.js) before we ever call. The bridge secret only proves the call came
 * from Adrian-Website's server; the requester identity in the body is the
 * server's verified claim about who is asking. Never trust a client for it.
 *
 * SECRET: CLAIM_BRIDGE_SECRET, a dedicated 32+ random-byte secret set on BOTH
 * Pages projects (adrianrasmussen.com and mandalacodes.com). Distinct from
 * SALE_WEBHOOK_SECRET on purpose: different blast radius, independent rotation.
 * Adrian provisions it; this code never invents or logs a value.
 *
 * PRIVACY INVARIANT: nothing here enters a ledger hash. The body carries only
 * the opaque pieceId/editionNumber, the requester's opaque userId, their email
 * (mutable-store only, needed so the holder can recognize the buyer on
 * approval), and an optional short evidence note. The recovery code never
 * leaves bind.js; it is never sent here, hashed or otherwise.
 */

const ENDPOINT = 'https://mandalacodes.com/api/atlas/claim-bridge';

/** Same evidence-note ceiling mandalacodes enforces (CLAIM_REQUEST_NOTE_MAX). */
export const CLAIM_REQUEST_NOTE_MAX = 500;

// Retry backoff in ms. 400 = our payload is wrong, never retried. 401 (clock
// skew / secret mismatch) and 5xx / network are retried. Kept short: the bind
// response should not hang on a slow sister site, and the call is best-effort
// signalling on top of a store the holder also reaches directly.
const BACKOFF_MS = [2_000, 8_000];

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the canonical bridge payload. Only the fields the receiver accepts;
 * unknown fields are rejected (400) there. editionNumber 0 is meaningful (the
 * chain-key default), so it is always sent. Exported for the unit suite.
 */
export function buildClaimBridgePayload(claim) {
  const out = {
    pieceId: claim.pieceId,
    editionNumber: Number.isInteger(claim.editionNumber) ? claim.editionNumber : 0,
    requesterRef: claim.requesterRef,
    requesterEmail: claim.requesterEmail,
  };
  if (typeof claim.note === 'string' && claim.note.trim()) {
    out.note = claim.note.trim().slice(0, CLAIM_REQUEST_NOTE_MAX);
  }
  return out;
}

async function sendOnce(secret, rawBody) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Claim-Timestamp': timestamp,
      'X-Claim-Signature': signature,
    },
    body: rawBody,
  });
}

/**
 * Open (or no-op re-open) a contested claim request on the shared store.
 *
 * @param {object} env  Cloudflare env (needs CLAIM_BRIDGE_SECRET)
 * @param {object} claim { pieceId, editionNumber?, requesterRef, requesterEmail, note? }
 * @returns {Promise<{ ok: boolean, status?: string, request?: object, reason?: string }>}
 *   status is the receiver's word: 'opened' on a fresh request, or a friendly
 *   reason on a guardrail stop ('duplicate' for an existing open request,
 *   'rate_limited', 'self' when the asker already holds the piece).
 */
export async function requestContestedClaim(env, claim) {
  if (!env?.CLAIM_BRIDGE_SECRET) {
    // Secret not provisioned yet. Surface it clearly so bind.js can tell the
    // requester the handoff is configured-pending, not that they were rejected.
    return { ok: false, reason: 'secret_unset' };
  }
  if (!claim?.pieceId || !claim?.requesterRef || !claim?.requesterEmail) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  // Serialize ONCE; sign and send these exact bytes (re-serialization would
  // break the signature). Re-sign the timestamp per attempt, same rawBody.
  const rawBody = JSON.stringify(buildClaimBridgePayload(claim));

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await sendOnce(env.CLAIM_BRIDGE_SECRET, rawBody);
      if (res.status === 200) {
        const data = await res.json().catch(() => ({}));
        // The receiver answers 200 for both a fresh open and a guardrail stop
        // (duplicate / rate limit / self), so an honest no-op never looks like
        // a transport failure to the caller.
        return { ok: true, status: data.status, request: data.request };
      }
      if (res.status === 400) {
        // Our payload is malformed; retrying the same bytes cannot help.
        console.warn('[claimBridge] 400 rejected; not retrying');
        return { ok: false, reason: 'rejected_400' };
      }
      // 401 (clock skew / secret mismatch), 503 (receiver not ready), 5xx → retry.
    } catch (err) {
      console.warn('[claimBridge] send failed:', err?.message);
    }

    if (attempt >= BACKOFF_MS.length) {
      return { ok: false, reason: 'retries_exhausted' };
    }
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
}
