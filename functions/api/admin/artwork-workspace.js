import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { getArtworkWorkspace } from '../_lib/artworkWorkspace.js';
import { EXACT_RECORD_PROJECTION, WORKSPACE_PROJECTION_HEADER } from '../../../utils/artworkWorkspace.ts';

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

// Cached Studio bundles validate every key and link against the original
// projection. Keep that response until the requesting bundle opts in.
function legacyProjection(workspace) {
  const { edition, selectionScope, legacySaleVerificationPath, plate, nextAction: action, ...base } = workspace;
  let nextAction = action;
  if (action?.href.startsWith('/works/')) {
    nextAction = {
      label: 'Review caretaker experience',
      href: `/admin/pieces?${new URLSearchParams({ keeperPieceId: workspace.identity.keeperPieceId })}`,
      reason: 'The core artwork record is ready for experience review.',
    };
  } else if (action?.href.startsWith('/admin/pieces/wizard?')) {
    const query = new URLSearchParams(action.href.split('?')[1]);
    if (query.has('proof')) {
      query.delete('proof');
      nextAction = { ...action, href: `/admin/pieces/wizard?${query}` };
    }
  }
  return {
    ...base,
    plate: plate ? { state: plate.state, recoveryState: plate.recoveryState } : null,
    nextAction,
  };
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
    const workspace = await getArtworkWorkspace(env, selector);
    const exactRecord = request.headers.get(WORKSPACE_PROJECTION_HEADER) === EXACT_RECORD_PROJECTION;
    return jsonResponse({ ok: true, workspace: exactRecord ? workspace : legacyProjection(workspace) },
      200, { Vary: WORKSPACE_PROJECTION_HEADER });
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
