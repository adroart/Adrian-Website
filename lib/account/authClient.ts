/**
 * Browser-side Better Auth client for customer accounts. Email one-time-code
 * sign-in (no passwords). The session is a cookie, so authenticated requests
 * to our own API just need credentials included — no bearer token.
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
export function signUpWithPassword(email: string, password: string, name?: string) {
  return authClient.signUp.email({ email, password, name: name ?? '' });
}

/** Log in with email + password. */
export function signInWithPassword(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

/** Continue with Google (redirects to Google, returns to the site). */
export function signInWithGoogle(callbackURL: string = '/') {
  return authClient.signIn.social({ provider: 'google', callbackURL });
}

/** Sign out and clear the session cookie. */
export function signOut() {
  return authClient.signOut();
}
