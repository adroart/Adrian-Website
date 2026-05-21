/**
 * POST /api/clerk/webhook
 *
 * Receives Clerk webhook events (user.created, user.updated, user.deleted)
 * verified via Svix. Public endpoint — auth is by signature.
 *
 * Configure in the Clerk dashboard:
 *   - Endpoint URL: https://<site>/api/clerk/webhook
 *   - Events: user.created, user.updated, user.deleted
 *   - Set CLERK_WEBHOOK_SECRET in Cloudflare Pages env (Functions)
 */

import { Webhook } from 'svix';
import { upsertUser, deleteUserByClerkId, getUserByClerkId, relinkOrdersByEmail } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!env.CLERK_WEBHOOK_SECRET) return new Response('webhook_not_configured', { status: 503 });
  if (!env.DB) return new Response('db_not_configured', { status: 503 });

  const headers = {
    'svix-id': request.headers.get('svix-id'),
    'svix-timestamp': request.headers.get('svix-timestamp'),
    'svix-signature': request.headers.get('svix-signature'),
  };
  const body = await request.text();

  let event;
  try {
    const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
    event = wh.verify(body, headers);
  } catch {
    return new Response('invalid_signature', { status: 400 });
  }

  switch (event.type) {
    case 'user.created':
    case 'user.updated': {
      const data = event.data;
      const email =
        data.email_addresses?.find?.((e) => e.id === data.primary_email_address_id)?.email_address ||
        data.email_addresses?.[0]?.email_address ||
        null;
      if (!email) break;
      const user = await upsertUser(env.DB, {
        clerkUserId: data.id,
        email,
        stripeCustomerId: null,
      });
      if (user?.id) await relinkOrdersByEmail(env.DB, user.id, email);
      break;
    }
    case 'user.deleted': {
      if (event.data?.id) await deleteUserByClerkId(env.DB, event.data.id);
      break;
    }
    default:
      // Other event types are ignored. Returning 200 prevents Clerk from
      // retrying.
      break;
  }

  return new Response('ok', { status: 200 });
}
