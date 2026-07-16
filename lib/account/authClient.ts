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

export const authClient = createAuthClient({
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

/** Sign out and clear the session cookie. */
export function signOut() {
  return authClient.signOut();
}
