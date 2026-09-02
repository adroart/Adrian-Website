import { requireUser, jsonResponse } from '../_lib/auth.js';
import {
  readCollectorOnboarding,
  saveCollectorBirthProfile,
  skipCollectorBirthProfile,
} from '../_lib/collectorOnboarding.js';
import { clientErrorCode } from '../_lib/clientError.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET' && request.method !== 'POST' && request.method !== 'PUT') {
    return new Response('Method not allowed', { status: 405 });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);

  try {
    if (request.method === 'GET') {
      const result = await readCollectorOnboarding(env, { userId: auth.userId });
      return jsonResponse(result, { status: 200 }, request, env);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, { status: 400 }, request, env);
    }
    if (body?.action === 'skip') {
      return jsonResponse(skipCollectorBirthProfile(), { status: 200 }, request, env);
    }
    if (body?.action !== 'save') {
      return jsonResponse({ error: 'invalid_action' }, { status: 400 }, request, env);
    }
    const result = await saveCollectorBirthProfile(env, {
      userId: auth.userId,
      email: auth.email,
      inputs: body.inputs,
    });
    return jsonResponse(result, { status: 200 }, request, env);
  } catch (error) {
    const code = clientErrorCode(error, 'onboarding_failed');
    const status = code === 'invalid_inputs' || code === 'invalid_saved_at' ? 400 : 500;
    return jsonResponse({ error: code }, { status }, request, env);
  }
}
