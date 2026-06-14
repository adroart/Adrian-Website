import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccountContext, AccountState } from './useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';
import { authClient } from './authClient';

/**
 * `AccountProvider` is the single place the rest of the app reads its sign-in
 * state from. It publishes the `AccountState` shape onto AccountContext from
 * the self-owned Better Auth session (email one-time-code sign-in). When the
 * accounts launch flag is off, it provides quiet "not available" stubs so the
 * site renders quest UI without special-casing elsewhere.
 *
 * Replaces the previous Clerk integration. Sessions are cookies, so there is
 * no provider component to mount and `fetchAuthed` just includes credentials.
 */
export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (!LAUNCH_FLAGS.accounts) return <>{children}</>;
  return <BetterAuthBridge>{children}</BetterAuthBridge>;
};

/**
 * Reads the Better Auth session hook and publishes it onto AccountContext.
 * Also runs the one-time sync-user request the first time it sees a signed-in
 * user so the server creates the matching D1 row + Stripe Customer.
 */
const BetterAuthBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: session, isPending } = authClient.useSession();
  const syncedFor = useRef<string | null>(null);

  // Authenticated fetch: the session is a cookie, so just include credentials.
  const fetchAuthed = useCallback(
    async (input: string, init: RequestInit = {}) =>
      fetch(input, { ...init, credentials: 'include' }),
    [],
  );

  const userId = session?.user?.id ?? null;
  const isSignedIn = !!userId;
  const isLoaded = !isPending;

  // First time we observe a signed-in user this tab, sync the D1 row + Stripe
  // customer. Idempotent server-side; safe to retry.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;
    fetchAuthed('/api/auth/sync-user', { method: 'POST' }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[account] sync-user failed:', err);
    });
  }, [isLoaded, isSignedIn, userId, fetchAuthed]);

  const value = useMemo<AccountState>(
    () => ({
      available: true,
      isSignedIn,
      isLoaded,
      userId,
      email: session?.user?.email ?? null,
      fetchAuthed,
    }),
    [isSignedIn, isLoaded, userId, session?.user?.email, fetchAuthed],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
