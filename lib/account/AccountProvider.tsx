import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ClerkProvider,
  useAuth,
  useUser,
} from '@clerk/clerk-react';
import { AccountContext, AccountState } from './useAccount';
import { LAUNCH_FLAGS } from '../../launchFlags';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as
  | string
  | undefined;

export const isClerkConfigured: boolean = Boolean(CLERK_PUBLISHABLE_KEY);

/**
 * `AccountProvider` is the single place where the rest of the app reads
 * its sign-in state from. When Clerk has been provisioned (publishable
 * key set at build time) AND the accounts launch flag is on, it mounts
 * ClerkProvider and bridges Clerk's hooks into AccountContext. Otherwise
 * it provides stub values so the site keeps working in guest mode and the
 * code never has to special-case "Clerk not loaded" elsewhere.
 */
export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const enabled = isClerkConfigured && LAUNCH_FLAGS.accounts;
  if (!enabled || !CLERK_PUBLISHABLE_KEY) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#8c6b3f',         // bronze-600
          colorText: '#3a2e1f',            // wood-900
          colorBackground: '#fbf8f1',      // paper-50
          colorInputBackground: '#fbf8f1',
          colorInputText: '#3a2e1f',
          fontFamily: 'Lato, Helvetica, sans-serif',
          borderRadius: '4px',
        },
      }}
    >
      <ClerkAccountBridge>{children}</ClerkAccountBridge>
    </ClerkProvider>
  );
};

/**
 * Sits inside ClerkProvider, reads the real Clerk hooks, and publishes
 * the resulting state onto AccountContext. Also runs the one-time
 * sync-user request the first time it sees a signed-in user, so the
 * server creates the corresponding row in D1 and a Stripe Customer.
 */
const ClerkAccountBridge: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useAuth();
  const user = useUser();
  const syncedFor = useRef<string | null>(null);

  const fetchAuthed = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = await auth.getToken();
      const headers = new Headers(init.headers ?? {});
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return fetch(input, { ...init, headers });
    },
    [auth.getToken],
  );

  // First time we observe a signed-in user in this tab, ping the
  // sync-user endpoint so the server upserts the row and creates a
  // Stripe Customer if needed. Idempotent server-side; safe to retry.
  useEffect(() => {
    if (!auth.isLoaded || !auth.isSignedIn || !auth.userId) return;
    if (syncedFor.current === auth.userId) return;
    syncedFor.current = auth.userId;
    fetchAuthed('/api/auth/sync-user', { method: 'POST' }).catch((err) => {
      // Non-fatal — Functions might not be deployed yet. Log to console
      // so a curious developer can spot it; users get a fully functional
      // signed-in state regardless.
      // eslint-disable-next-line no-console
      console.warn('[account] sync-user failed:', err);
    });
  }, [auth.isLoaded, auth.isSignedIn, auth.userId, fetchAuthed]);

  const value = useMemo<AccountState>(
    () => ({
      available: true,
      isSignedIn: !!auth.isSignedIn,
      isLoaded: !!auth.isLoaded,
      userId: auth.userId ?? null,
      email: user.user?.primaryEmailAddress?.emailAddress ?? null,
      fetchAuthed,
    }),
    [auth.isLoaded, auth.isSignedIn, auth.userId, user.user, fetchAuthed],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};
