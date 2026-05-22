import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAccount } from '../account/useAccount';
import {
  loadProfile,
  saveProfile,
  clearProfile,
  type ProfileInputs,
  type StoredProfile,
} from './storage';
import { buildHologeneticProfile } from '../astrology/profile';
import { placeToUtc } from '../astrology/places';

interface ProfileContextValue {
  profile: StoredProfile | null;
  isLoading: boolean;
  /** Persist a new profile; recomputes the chart from the inputs. */
  save: (inputs: ProfileInputs) => Promise<void>;
  /** Wipe local + remote profile (remote only when signed in). */
  clear: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: null,
  isLoading: false,
  save: async () => undefined,
  clear: async () => undefined,
});

/**
 * Provides the Hologenetic Profile to any component below. Local-first:
 * reads localStorage synchronously on mount so guests get an immediate
 * render. When the visitor is signed in, the provider also pulls the
 * remote D1 copy and merges it with the local snapshot (remote wins when
 * its `updatedAt` is newer; otherwise local is pushed up).
 */
export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const account = useAccount();
  const [profile, setProfile] = useState<StoredProfile | null>(() => loadProfile());
  const [isLoading, setLoading] = useState<boolean>(false);
  const lastSyncedFor = useRef<string | null>(null);

  // Sync once per session per signed-in user. On sign-in we either push the
  // local snapshot up or pull the remote copy down — whichever is newer.
  useEffect(() => {
    if (!account.available || !account.isLoaded || !account.isSignedIn || !account.userId) return;
    if (lastSyncedFor.current === account.userId) return;
    lastSyncedFor.current = account.userId;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await account.fetchAuthed('/api/profile/get');
        const remote: StoredProfile | null = res.ok ? await res.json() : null;
        const local = loadProfile();

        if (remote && (!local || Date.parse(remote.updatedAt) > Date.parse(local.updatedAt))) {
          if (!cancelled) {
            saveProfile(remote);
            setProfile(remote);
          }
        } else if (local && (!remote || Date.parse(local.updatedAt) > Date.parse(remote.updatedAt))) {
          // Push local up so subsequent devices see it.
          await account.fetchAuthed('/api/profile/put', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: local.inputs, computed: local.computed }),
          });
        }
      } catch {
        // Non-fatal; user keeps using local copy.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account]);

  const save = useCallback(
    async (inputs: ProfileInputs) => {
      const utcBirth = placeToUtc(inputs.date, inputs.time, inputs.place.tzId);
      const computed = buildHologeneticProfile({ utcBirth });
      const stored: StoredProfile = {
        inputs,
        computed,
        updatedAt: new Date().toISOString(),
      };
      saveProfile(stored);
      setProfile(stored);

      if (account.available && account.isSignedIn) {
        try {
          await account.fetchAuthed('/api/profile/put', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs, computed }),
          });
        } catch {
          // Local save succeeded; remote sync will retry on next mount.
        }
      }
    },
    [account],
  );

  const clear = useCallback(async () => {
    clearProfile();
    setProfile(null);
    if (account.available && account.isSignedIn) {
      try {
        await account.fetchAuthed('/api/profile/delete', { method: 'DELETE' });
      } catch {
        // ignore
      }
    }
  }, [account]);

  const value = useMemo(
    () => ({ profile, isLoading, save, clear }),
    [profile, isLoading, save, clear],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export function useProfile() {
  return useContext(ProfileContext);
}
