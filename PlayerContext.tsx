import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Track } from './types';
import { TRACKS as SEED_TRACKS } from './data/mockData';

interface PlayerContextType {
    tracks: Track[];                            // live list, fetched from R2 (falls back to seed)
    tracksLoaded: boolean;
    refreshTracks: () => Promise<void>;
    currentTrack: Track | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    play: (track: Track) => void;
    pause: () => void;
    toggle: () => void;
    stop: () => void;
    seek: (seconds: number) => void;
    next: () => void;
    prev: () => void;
    audioRef: React.RefObject<HTMLAudioElement>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

const STORAGE_KEY = 'adrian_player_state';

interface PersistedState {
    trackId: string;
    currentTime: number;
}

function loadPersistedState(): PersistedState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.trackId === 'string' && typeof parsed?.currentTime === 'number') {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [tracks, setTracks] = useState<Track[]>(SEED_TRACKS);
    const [tracksLoaded, setTracksLoaded] = useState(false);
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const refreshTracks = useCallback(async () => {
        try {
            const res = await fetch('/api/poems');
            const data = await res.json();
            if (data?.ok && Array.isArray(data.poems)) {
                setTracks(data.poems.length > 0 ? data.poems : SEED_TRACKS);
            }
        } catch {
            // Network failure — keep whatever we already have (seed or last good).
        } finally {
            setTracksLoaded(true);
        }
    }, []);

    // Fetch live track list once on mount.
    useEffect(() => {
        refreshTracks();
    }, [refreshTracks]);

    // Restore last track on mount once we have tracks (paused, at saved position).
    useEffect(() => {
        if (!tracksLoaded) return;
        const persisted = loadPersistedState();
        if (!persisted) return;
        const track = tracks.find(t => t.id === persisted.trackId);
        if (!track) return;
        setCurrentTrack(track);
        const el = audioRef.current;
        if (el) {
            const onLoaded = () => {
                el.currentTime = persisted.currentTime;
                el.removeEventListener('loadedmetadata', onLoaded);
            };
            el.addEventListener('loadedmetadata', onLoaded);
        }
    }, [tracksLoaded]);

    // Persist on track / time change (throttled by save-on-pause + save-on-time-update).
    useEffect(() => {
        if (!currentTrack) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                trackId: currentTrack.id,
                currentTime,
            }));
        } catch {
            // ignore quota errors
        }
    }, [currentTrack, Math.floor(currentTime / 5)]);

    const play = useCallback((track: Track) => {
        const el = audioRef.current;
        if (!el) return;
        if (currentTrack?.id !== track.id) {
            setCurrentTrack(track);
            // Wait for src change to apply before playing.
            requestAnimationFrame(() => {
                const a = audioRef.current;
                if (!a) return;
                a.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
            });
        } else {
            el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
    }, [currentTrack]);

    const pause = useCallback(() => {
        const el = audioRef.current;
        if (!el) return;
        el.pause();
        setIsPlaying(false);
    }, []);

    const toggle = useCallback(() => {
        const el = audioRef.current;
        if (!el || !currentTrack) return;
        if (el.paused) {
            el.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        } else {
            el.pause();
            setIsPlaying(false);
        }
    }, [currentTrack]);

    const stop = useCallback(() => {
        const el = audioRef.current;
        if (el) {
            el.pause();
            el.currentTime = 0;
        }
        setIsPlaying(false);
        setCurrentTrack(null);
        setCurrentTime(0);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    }, []);

    const seek = useCallback((seconds: number) => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = Math.max(0, Math.min(seconds, el.duration || seconds));
    }, []);

    const next = useCallback(() => {
        if (!currentTrack) return;
        const idx = tracks.findIndex(t => t.id === currentTrack.id);
        if (idx >= 0 && idx < tracks.length - 1) {
            play(tracks[idx + 1]);
        }
    }, [currentTrack, play, tracks]);

    const prev = useCallback(() => {
        if (!currentTrack) return;
        const idx = tracks.findIndex(t => t.id === currentTrack.id);
        if (idx > 0) {
            play(tracks[idx - 1]);
        }
    }, [currentTrack, play, tracks]);

    const value = useMemo(() => ({
        tracks,
        tracksLoaded,
        refreshTracks,
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        play,
        pause,
        toggle,
        stop,
        seek,
        next,
        prev,
        audioRef,
    }), [tracks, tracksLoaded, refreshTracks, currentTrack, isPlaying, currentTime, duration, play, pause, toggle, stop, seek, next, prev]);

    return (
        <PlayerContext.Provider value={value}>
            {children}
            <audio
                ref={audioRef}
                src={currentTrack?.audioUrl}
                preload="metadata"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
            />
        </PlayerContext.Provider>
    );
};

export const usePlayer = (): PlayerContextType => {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
    return ctx;
};

export function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}
