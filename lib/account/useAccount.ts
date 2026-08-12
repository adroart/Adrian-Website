import { createContext, useContext } from 'react';

export interface AccountState {
  available: boolean;
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  email: string | null;
  fetchAuthed: (input: string, init?: RequestInit) => Promise<Response>;
}

const stub: AccountState = {
  available: false,
  isSignedIn: false,
  isLoaded: true,
  userId: null,
  email: null,
  fetchAuthed: (input, init) => fetch(input, init),
};

export const AccountContext = createContext<AccountState>(stub);

/**
 * Unified account hook used by every account-aware feature (profile sync,
 * cart sync, collections, order history). When accounts are not configured
 * (no account service) or the launch flag is off, returns a quiet "not available"
 * shape so the rest of the app can render guest UI without further branching.
 */
export function useAccount(): AccountState {
  return useContext(AccountContext);
}
