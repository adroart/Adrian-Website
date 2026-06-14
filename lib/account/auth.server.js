/**
 * Better Auth server instance for the art site's customer accounts.
 *
 * Self-owned login living in the site's own D1 database (binding `DB`). Email
 * one-time-code sign-in for now; Google OAuth can be added later by adding a
 * socialProviders block. Replaces Clerk — see todo/plans/better-auth-migration.md
 * and the identity direction in i64os/substrate/directions/identity.md.
 *
 * Built per-request inside Pages Functions because `env` (the D1 binding +
 * secrets) is not a module global there. Better Auth 1.5+ auto-detects a D1
 * binding by duck-typing, so we pass `env.DB` straight in — no adapter wrapper.
 *
 * Required env (Infisical dev / Cloudflare Pages prod):
 *   BETTER_AUTH_SECRET   — random 32+ char string
 *   BETTER_AUTH_URL      — deployed origin, e.g. https://adrianrasmussen.com
 *   RESEND_API_KEY       — existing key, reused for the sign-in code email
 *   RESEND_FROM_EMAIL    — existing verified sender (default below)
 */

import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins';

const DEFAULT_FROM = 'noreply@adrianrasmussen.com';

/**
 * @param {Record<string, any>} env  Pages Functions env (D1 binding + secrets)
 * @param {(p: Promise<any>) => void} [waitUntil]  context.waitUntil, bound
 */
export function createAuth(env, waitUntil) {
  const baseURL = env.BETTER_AUTH_URL || 'http://localhost:5555';
  const fromEmail = env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    basePath: '/api/auth',
    trustedOrigins: [
      baseURL,
      'https://adrianrasmussen.com',
      'https://www.adrianrasmussen.com',
      'http://localhost:5555',
      'http://127.0.0.1:5555',
      'http://localhost:8788',
    ],
    advanced: {
      backgroundTasks: {
        handler: (promise) => waitUntil?.(promise),
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        async sendVerificationOTP({ email, otp }) {
          if (!env.RESEND_API_KEY) {
            // Dev without a key set: log so local testing still works.
            console.log(`[auth] sign-in code for ${email}: ${otp}`);
            return;
          }
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: `Adrian Rasmussen Art <${fromEmail}>`,
              to: [email],
              subject: 'Your sign-in code',
              text: `Your sign-in code is ${otp}. It expires in 10 minutes.`,
            }),
          });
          if (!res.ok) {
            const err = await res.text().catch(() => '');
            throw new Error(`Resend failed (${res.status}): ${err}`);
          }
        },
      }),
    ],
  });
}
