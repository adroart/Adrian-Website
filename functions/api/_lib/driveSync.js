/**
 * Google Drive sync for the offline master ledger.
 *
 * Runs server-side in Adrian's own Cloudflare account. It uploads the ledger to
 * Adrian's Google Drive so the master copy is captured automatically, with no
 * manual download and nothing routed through any AI assistant.
 *
 * CREDENTIALS (Adrian provisions once; fails closed until then):
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET  reused from the existing sign-in
 *                                            OAuth client.
 *   GOOGLE_DRIVE_REFRESH_TOKEN               a refresh token minted once with
 *                                            the least-privilege `drive.file`
 *                                            scope, so this app can only see and
 *                                            manage the single file it creates —
 *                                            never the rest of the Drive.
 *   GOOGLE_DRIVE_FOLDER_ID (optional)        target folder; Drive root if unset.
 *
 * TWO canonical managed files, each updated in place. Google Drive keeps its
 * own revision history on them, so every export is retained without
 * cluttering the folder:
 *   registry-ledger.jsonl   the secret-free issuance ledger (text)
 *   piece-records.zip       the public piece-records archive (binary,
 *                           deterministic STORE zip from recordArchive.js)
 *
 * The request builders are pure and unit tested; syncLedgerToDrive and
 * syncRecordsArchiveToDrive are thin orchestrations over fetch and take an
 * injectable fetch for testing.
 */
import { LEDGER_FILENAME } from './registryLedgerExport.js';
import { RECORDS_ARCHIVE_FILENAME } from './recordArchive.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const LEDGER_MIME = 'application/x-ndjson';
const RECORDS_ARCHIVE_MIME = 'application/zip';
const MULTIPART_BOUNDARY = 'adrian-registry-ledger-sync';

export { RECORDS_ARCHIVE_FILENAME };

export function isDriveSyncConfigured(env) {
  return Boolean(
    env
      && typeof env.GOOGLE_CLIENT_ID === 'string' && env.GOOGLE_CLIENT_ID
      && typeof env.GOOGLE_CLIENT_SECRET === 'string' && env.GOOGLE_CLIENT_SECRET
      && typeof env.GOOGLE_DRIVE_REFRESH_TOKEN === 'string' && env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

export function buildTokenRequest(env) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  return { url: TOKEN_URL, method: 'POST', body: body.toString() };
}

export function buildManagedFindFileUrl(env, filename) {
  const folderClause = env.GOOGLE_DRIVE_FOLDER_ID
    ? ` and '${env.GOOGLE_DRIVE_FOLDER_ID}' in parents`
    : '';
  const query = `name = '${filename}' and trashed = false${folderClause}`;
  // Encode with %20 for spaces; the Drive `q` parameter does not treat `+` as a
  // space, so URLSearchParams' form encoding would corrupt the query.
  const params = [
    `q=${encodeURIComponent(query)}`,
    `fields=${encodeURIComponent('files(id,name)')}`,
    'spaces=drive',
    'pageSize=1',
  ].join('&');
  return `${FILES_URL}?${params}`;
}

export function buildFindFileUrl(env) {
  return buildManagedFindFileUrl(env, LEDGER_FILENAME);
}

function concatBytes(parts) {
  const encoder = new TextEncoder();
  const encoded = parts.map((part) =>
    (part instanceof Uint8Array ? part : encoder.encode(part)));
  const out = new Uint8Array(encoded.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of encoded) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

/**
 * Multipart create for any managed file. String content keeps the historical
 * string body (byte-identical for the ledger); Uint8Array content (the
 * records zip) produces a Uint8Array body.
 */
export function buildManagedMultipartCreate(env, filename, mimeType, content) {
  const metadata = {
    name: filename,
    mimeType,
    ...(env.GOOGLE_DRIVE_FOLDER_ID ? { parents: [env.GOOGLE_DRIVE_FOLDER_ID] } : {}),
  };
  const preamble =
    `--${MULTIPART_BOUNDARY}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${MULTIPART_BOUNDARY}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;
  const epilogue = `\r\n--${MULTIPART_BOUNDARY}--`;
  const body = typeof content === 'string'
    ? `${preamble}${content}${epilogue}`
    : concatBytes([preamble, content, epilogue]);
  return {
    url: `${UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`,
    method: 'POST',
    contentType: `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
    body,
  };
}

export function buildMultipartCreate(env, content) {
  const operation = buildManagedMultipartCreate(env, LEDGER_FILENAME, LEDGER_MIME, content);
  // Ledger content is a string, so the multipart body stays a string.
  return { ...operation, body: /** @type {string} */ (operation.body) };
}

export function buildManagedMediaUpdate(fileId, mimeType, content) {
  return {
    url: `${UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=media&fields=id,webViewLink`,
    method: 'PATCH',
    contentType: mimeType,
    body: content,
  };
}

export function buildMediaUpdate(fileId, content) {
  return buildManagedMediaUpdate(fileId, LEDGER_MIME, content);
}

/**
 * Upload one managed file to Drive: refresh an access token, find the
 * canonical file by name, then update it in place or create it. Returns a
 * structured outcome and never throws for the ordinary failure modes, so a
 * caller (including a background waitUntil) can record status without risk.
 */
export async function syncManagedFileToDrive(env, { filename, mimeType, content }, fetchImpl = fetch) {
  if (!isDriveSyncConfigured(env)) return { ok: false, reason: 'not_configured' };

  try {
    const tokenReq = buildTokenRequest(env);
    const tokenResponse = await fetchImpl(tokenReq.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenReq.body,
    });
    if (!tokenResponse.ok) return { ok: false, reason: 'token_failed' };
    const tokenData = await tokenResponse.json().catch(() => ({}));
    const accessToken = tokenData.access_token;
    if (!accessToken) return { ok: false, reason: 'token_failed' };
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    let fileId = null;
    const findResponse = await fetchImpl(
      buildManagedFindFileUrl(env, filename), { headers: authHeader },
    );
    if (findResponse.ok) {
      const found = await findResponse.json().catch(() => ({}));
      fileId = found?.files?.[0]?.id || null;
    }

    const operation = fileId
      ? buildManagedMediaUpdate(fileId, mimeType, content)
      : buildManagedMultipartCreate(env, filename, mimeType, content);
    const uploadResponse = await fetchImpl(operation.url, {
      method: operation.method,
      headers: { ...authHeader, 'Content-Type': operation.contentType },
      body: operation.body,
    });
    if (!uploadResponse.ok) return { ok: false, reason: 'upload_failed' };
    const uploaded = await uploadResponse.json().catch(() => ({}));
    return {
      ok: true,
      fileId: uploaded.id || fileId,
      webViewLink: uploaded.webViewLink || null,
      updated: Boolean(fileId),
    };
  } catch {
    return { ok: false, reason: 'sync_error' };
  }
}

/** The historical ledger entry point, unchanged in behavior. */
export async function syncLedgerToDrive(env, content, fetchImpl = fetch) {
  return syncManagedFileToDrive(env, {
    filename: LEDGER_FILENAME,
    mimeType: LEDGER_MIME,
    content,
  }, fetchImpl);
}

/** The piece-records archive mirror: piece-records.zip, updated in place. */
export async function syncRecordsArchiveToDrive(env, zipBytes, fetchImpl = fetch) {
  return syncManagedFileToDrive(env, {
    filename: RECORDS_ARCHIVE_FILENAME,
    mimeType: RECORDS_ARCHIVE_MIME,
    content: zipBytes,
  }, fetchImpl);
}
