/**
 * Browser-side Better Auth client for customer accounts. Supports email
 * one-time-code, email/password, and Google sign-in. The session is a cookie,
 * so authenticated requests to our own API just need credentials included,
 * with no bearer token.
 *
 * Talks to the catch-all handler at /api/auth/* (same origin).
 */

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient } from 'better-auth/client/plugins';

/**
 * On a served page the client derives its base URL from the page origin, so
 * we pass none. On a file:// page (the double-clickable offline walkthrough
 * build) `window.location.origin` is the literal string "null", which makes
 * the client constructor throw at module import and take the whole bundle
 * down before anything renders. Auth is never exercised there, so a harmless
 * absolute base keeps the import safe; any accidental call just fails like
 * any other unreachable network request.
 */
const fileOriginBaseURL =
  typeof window !== 'undefined' && window.location.protocol === 'file:'
    ? 'http://localhost'
    : undefined;

export const authClient = createAuthClient({
  ...(fileOriginBaseURL ? { baseURL: fileOriginBaseURL } : {}),
  basePath: '/api/auth',
  plugins: [emailOTPClient()],
});

/** Send a 6-digit sign-in code to the given email. */
export function sendSignInCode(email: string) {
  return authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
}

/** Verify the code and create a session. */
export function verifySignInCode(email: string, otp: string) {
  return authClient.signIn.emailOtp({ email, otp });
}

/** Create an account with email + password. */
export function signUpWithPassword(email: string, password: string, name?: string, destination = '/') {
  return authClient.signUp.email({
    email,
    password,
    name: name ?? '',
    callbackURL: safeAuthDestination(destination),
  });
}

/** Log in with email + password. */
export function signInWithPassword(email: string, password: string, destination = '/') {
  return authClient.signIn.email({
    email,
    password,
    callbackURL: safeAuthDestination(destination),
  });
}

/** Continue with Google (redirects to Google, returns to the site). */
export function signInWithGoogle(destination = '/') {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: safeAuthDestination(destination),
  });
}

/** Request the email OTP used to replace a forgotten password. */
export function requestPasswordReset(email: string) {
  return authClient.emailOtp.requestPasswordReset({ email });
}

/** Replace a password after verifying the reset OTP. */
export function resetPasswordWithCode(email: string, otp: string, password: string) {
  return authClient.emailOtp.resetPassword({ email, otp, password });
}

/**
 * Accept only a path on this site. Protocol-relative URLs, absolute external
 * URLs, backslashes, and control characters all fall back safely.
 */
export function safeAuthDestination(destination: string | null | undefined, fallback = '/') {
  const safeFallback = isSafePath(fallback) ? fallback : '/';
  if (!destination || !isSafePath(destination)) return safeFallback;
  return destination;
}

function isSafePath(value: string) {
  return value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/[\u0000-\u001f\u007f]/.test(value);
}

const REGISTRY_UNLOCK_CLEANUP_TIMEOUT_MS = 150;

async function clearRegistryUnlockBeforeSignOut() {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fetch('/api/admin/registry-unlock', {
        method: 'DELETE',
        signal: controller.signal,
      }).catch(() => undefined),
      new Promise<void>((resolve) => {
        timeout = setTimeout(() => {
          controller.abort();
          resolve();
        }, REGISTRY_UNLOCK_CLEANUP_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

/** Clear any privileged unlock before ending the shared account session. */
export async function signOut() {
  await clearRegistryUnlockBeforeSignOut();
  return authClient.signOut();
}
