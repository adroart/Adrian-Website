import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { getArtworkWorkspace } from '../_lib/artworkWorkspace.js';

const SELECTORS = {
  artworkId: 80,
  keeperPieceId: 128,
  artistArtworkRecordId: 128,
};

function parseSelectors(url) {
  const params = new URL(url).searchParams;
  const keys = [...params.keys()];
  if (keys.some((key) => !Object.hasOwn(SELECTORS, key))) {
    throw Object.assign(new Error(), { code: 'unknown_workspace_selector' });
  }
  const selector = {};
  for (const [key, maximum] of Object.entries(SELECTORS)) {
    const values = params.getAll(key);
    if (values.length > 1) {
      throw Object.assign(new Error(), { code: 'invalid_workspace_selector' });
    }
    if (!values.length) continue;
    const value = values[0].trim();
    if (!value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
      throw Object.assign(new Error(), { code: 'invalid_workspace_selector' });
    }
    selector[key] = value;
  }
  if (!Object.keys(selector).length) {
    throw Object.assign(new Error(), { code: 'workspace_selector_required' });
  }
  return selector;
}

function statusFor(code) {
  if (['unknown_workspace_selector', 'invalid_workspace_selector',
    'workspace_selector_required'].includes(code)) return 400;
  if (code === 'workspace_not_found') return 404;
  if (['workspace_selector_conflict', 'workspace_data_corrupt'].includes(code)) return 409;
  if (code === 'db_not_configured') return 503;
  return 500;
}

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  try {
    const selector = parseSelectors(request.url);
    return jsonResponse({ ok: true, workspace: await getArtworkWorkspace(env, selector) });
  } catch (error) {
    const knownCodes = new Set([
      'unknown_workspace_selector', 'invalid_workspace_selector',
      'workspace_selector_required', 'workspace_not_found',
      'workspace_selector_conflict', 'workspace_data_corrupt', 'db_not_configured',
    ]);
    const code = knownCodes.has(error?.code) ? error.code : 'artwork_workspace_failed';
    return jsonResponse({ ok: false, error: code }, statusFor(code));
  }
}
