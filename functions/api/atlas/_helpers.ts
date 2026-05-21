/**
 * Shared helpers for /api/atlas/* Cloudflare Pages Functions.
 *
 * Centralizes:
 *   - R2 read/write for the three Atlas keys (ledger, stewards, public).
 *   - Cookie parsing and admin / steward auth.
 *   - Steward session token (HMAC-signed) issue + verify.
 *   - JSON response helpers, identical surface to functions/api/poems.js.
 *   - Public state regeneration after any ledger write.
 *
 * No HTTP handlers live here — only utilities the route files import.
 */

import type { LedgerEvent, StewardRecord, PublicAtlasState } from '../../../types';
import { projectAll } from '../../../utils/ledgerProjection';
import { toPublicState } from '../../../utils/ledgerProjection';
import { CITIES } from '../../../data/cities';
import { FULL_ARCHIVE } from '../../../data/mockData';

// ---------- R2 keys ----------

export const KEY_LEDGER = 'atlas/ledger.json';
export const KEY_STEWARDS = 'atlas/stewards.json';
export const KEY_PUBLIC = 'atlas/public.json';

// ---------- Cookie names ----------

export const ADMIN_COOKIE = 'admin_session';
export const STEWARD_COOKIE = 'steward_session';

// ---------- Env typing ----------

export interface AtlasEnv {
  MUSIC_BUCKET: R2Bucket;
  UPLOAD_SECRET: string;
}

// Minimal shape we need from R2 — avoids depending on @cloudflare/workers-types.
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}
interface R2Object {
  text(): Promise<string>;
}

export interface PagesContext<E = AtlasEnv> {
  request: Request;
  env: E;
}

// ---------- JSON responses ----------

export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

// ---------- Cookies ----------

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function isAdmin(request: Request, env: AtlasEnv): boolean {
  return getCookie(request, ADMIN_COOKIE) === env.UPLOAD_SECRET;
}

export function buildCookie(
  name: string,
  value: string,
  isSecure: boolean,
  maxAgeSeconds: number,
): string {
  const base = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  return isSecure ? `${base}; Secure` : base;
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === 'https:';
}

// ---------- R2 read/write ----------

async function readJsonArray<T>(env: AtlasEnv, key: string): Promise<T[]> {
  const obj = await env.MUSIC_BUCKET.get(key);
  if (!obj) return [];
  try {
    const text = await obj.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function readJsonObject<T>(env: AtlasEnv, key: string): Promise<T | null> {
  const obj = await env.MUSIC_BUCKET.get(key);
  if (!obj) return null;
  try {
    const text = await obj.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(env: AtlasEnv, key: string, value: unknown): Promise<void> {
  await env.MUSIC_BUCKET.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function readLedger(env: AtlasEnv): Promise<LedgerEvent[]> {
  return readJsonArray<LedgerEvent>(env, KEY_LEDGER);
}

export async function writeLedger(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<void> {
  await writeJson(env, KEY_LEDGER, events);
}

export async function readStewards(env: AtlasEnv): Promise<StewardRecord[]> {
  return readJsonArray<StewardRecord>(env, KEY_STEWARDS);
}

export async function writeStewards(
  env: AtlasEnv,
  stewards: StewardRecord[],
): Promise<void> {
  await writeJson(env, KEY_STEWARDS, stewards);
}

export async function readPublicState(
  env: AtlasEnv,
): Promise<PublicAtlasState | null> {
  return readJsonObject<PublicAtlasState>(env, KEY_PUBLIC);
}

export async function writePublicState(
  env: AtlasEnv,
  state: PublicAtlasState,
): Promise<void> {
  await writeJson(env, KEY_PUBLIC, state);
}

// ---------- Public state regeneration ----------

/**
 * Build the {pieceId → {series, category}} map from data/mockData.ts.
 * The mockData module is the only source of artwork metadata until a CMS
 * lands. We import FULL_ARCHIVE and project it down to just the two fields
 * toPublicState consumes.
 */
function buildArtworkMeta(): Map<string, { series?: string; category?: string }> {
  const map = new Map<string, { series?: string; category?: string }>();
  for (const a of FULL_ARCHIVE) {
    map.set(a.id, { series: a.series, category: a.category });
  }
  return map;
}

/**
 * Re-derive PublicAtlasState from a full ledger and persist it to R2.
 * Called after every successful ledger write so the GET cache stays fresh.
 */
export async function regeneratePublicState(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<PublicAtlasState> {
  const records = projectAll(events);
  const meta = buildArtworkMeta();
  const state = toPublicState(records, meta, CITIES);
  await writePublicState(env, state);
  return state;
}

// ---------- Steward session token (HMAC-signed) ----------

export interface StewardSessionPayload {
  pieceId: string;
  editionNumber?: number;
  exp: number; // epoch ms
}

const STEWARD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function hmacSign(payload: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encodeText(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encodeText(payload));
  return new Uint8Array(sig);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Build a steward session token: base64url(JSON payload).base64url(HMAC sig).
 * The payload encodes the piece scope and expiry; the HMAC is over the
 * base64url-encoded payload string itself, so the verifier can rebuild it
 * without re-serializing JSON (and dodge canonicalization issues).
 */
export async function issueStewardSession(
  payload: Omit<StewardSessionPayload, 'exp'>,
  secret: string,
): Promise<string> {
  const full: StewardSessionPayload = {
    ...payload,
    exp: Date.now() + STEWARD_TTL_MS,
  };
  const payloadB64 = base64UrlEncode(encodeText(JSON.stringify(full)));
  const sig = await hmacSign(payloadB64, secret);
  return `${payloadB64}.${base64UrlEncode(sig)}`;
}

/**
 * Verify and decode a steward session token. Returns null on any failure
 * (bad format, bad signature, expired). Callers should treat null as 401.
 */
export async function verifyStewardSession(
  token: string,
  secret: string,
): Promise<StewardSessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1 || dot === token.length - 1) return null;

  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  let expectedSig: Uint8Array;
  try {
    expectedSig = await hmacSign(payloadB64, secret);
  } catch {
    return null;
  }

  let providedSig: Uint8Array;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  if (!constantTimeEqual(expectedSig, providedSig)) return null;

  let payload: StewardSessionPayload;
  try {
    const json = decodeText(base64UrlDecode(payloadB64));
    payload = JSON.parse(json) as StewardSessionPayload;
  } catch {
    return null;
  }

  if (!payload || typeof payload.pieceId !== 'string' || typeof payload.exp !== 'number') {
    return null;
  }
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function stewardSessionCookie(token: string, isSecure: boolean): string {
  // 30 days in seconds, matches STEWARD_TTL_MS.
  return buildCookie(STEWARD_COOKIE, token, isSecure, 30 * 24 * 60 * 60);
}
