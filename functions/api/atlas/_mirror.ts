/**
 * Public mirror to GitHub for durability. Disabled by default — the
 * handlers call mirrorPublicState() unconditionally, and this function
 * no-ops unless GITHUB_MIRROR_TOKEN, GITHUB_MIRROR_REPO, and
 * GITHUB_MIRROR_PATH env vars are all present.
 *
 * Repo shape expected: a public GitHub repo where the file at
 * GITHUB_MIRROR_PATH (e.g. "atlas/public.json") is overwritten on each
 * write. Software Heritage Foundation archives all public GitHub repos
 * indefinitely, giving us free multi-region redundancy.
 *
 * Setup steps (for the successor doc):
 *   1. Create a public GitHub repo (e.g. adrian-atlas-mirror).
 *   2. Generate a fine-grained PAT with Contents: Read/Write on that repo.
 *   3. Set GITHUB_MIRROR_TOKEN, GITHUB_MIRROR_REPO (e.g. "user/repo"),
 *      GITHUB_MIRROR_PATH on the Cloudflare Pages project.
 */

export interface MirrorEnv {
  GITHUB_MIRROR_TOKEN?: string;
  GITHUB_MIRROR_REPO?: string;
  GITHUB_MIRROR_PATH?: string;
}

export interface MirrorResult {
  mirrored: boolean;
  reason?: string;
}

const GITHUB_API = 'https://api.github.com';
// GitHub requires a User-Agent on every request. Static value so the
// commits in the mirror repo can be identified as coming from this code.
const USER_AGENT = 'adrian-atlas-mirror';

/**
 * Encode a UTF-8 string as base64. Workers expose `btoa`, but it expects
 * a binary string, so we round-trip through TextEncoder first.
 */
function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Build the auth + content-type headers used on every GitHub call.
 * Centralized so we never forget the User-Agent (GitHub rejects without it).
 */
function buildHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': USER_AGENT,
    'Content-Type': 'application/json',
  };
}

/**
 * Look up the existing file's SHA, which GitHub requires on PUT in order
 * to overwrite. A 404 is the legitimate "first write" path and returns
 * null; any other non-OK status surfaces as a reason string the caller
 * can log.
 */
async function fetchExistingSha(
  repo: string,
  path: string,
  token: string,
): Promise<{ sha: string | null; error?: string }> {
  const url = `${GITHUB_API}/repos/${repo}/contents/${encodeURI(path)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(token),
    });
  } catch (err) {
    return { sha: null, error: `network ${(err as Error).message || 'error'}` };
  }
  if (response.status === 404) {
    return { sha: null };
  }
  if (!response.ok) {
    return { sha: null, error: `http ${response.status}` };
  }
  try {
    const body = (await response.json()) as { sha?: unknown };
    if (typeof body.sha === 'string') return { sha: body.sha };
    return { sha: null, error: 'malformed GET response' };
  } catch {
    return { sha: null, error: 'unparseable GET response' };
  }
}

/**
 * Mirror the public Atlas state to a GitHub repository.
 *
 * Returns `{ mirrored: false, reason: 'not configured' }` when any of the
 * three required env vars is missing — this is the default state and is
 * intentionally indistinguishable from a successful no-op. On any HTTP or
 * network error, returns `{ mirrored: false, reason: 'http {status}' }`
 * (or similar) so the caller can log without throwing. Never throws: a
 * mirror failure must never cause the underlying ledger write to fail.
 */
export async function mirrorPublicState(
  env: MirrorEnv,
  publicStateJson: string,
): Promise<MirrorResult> {
  const token = env.GITHUB_MIRROR_TOKEN;
  const repo = env.GITHUB_MIRROR_REPO;
  const path = env.GITHUB_MIRROR_PATH;

  if (!token || !repo || !path) {
    return { mirrored: false, reason: 'not configured' };
  }

  try {
    const existing = await fetchExistingSha(repo, path, token);
    if (existing.error) {
      return { mirrored: false, reason: existing.error };
    }

    const message = `atlas: public state update ${new Date().toISOString()}`;
    const body: Record<string, unknown> = {
      message,
      content: base64EncodeUtf8(publicStateJson),
    };
    if (existing.sha) {
      body.sha = existing.sha;
    }

    const putUrl = `${GITHUB_API}/repos/${repo}/contents/${encodeURI(path)}`;
    const putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: buildHeaders(token),
      body: JSON.stringify(body),
    });

    if (!putResponse.ok) {
      return { mirrored: false, reason: `http ${putResponse.status}` };
    }

    return { mirrored: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { mirrored: false, reason: `exception ${msg}` };
  }
}
