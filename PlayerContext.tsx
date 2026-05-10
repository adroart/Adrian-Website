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
import { TRACKS } from './data/mockData';

interface PlayerContextType {
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
    const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    // Restore last track on mount (paused, at saved position).
    useEffect(() => {
        const persisted = loadPersistedState();
        if (!persisted) return;
        const track = TRACKS.find(t => t.id === persisted.trackId);
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
    }, []);

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
        const idx = TRACKS.findIndex(t => t.id === currentTrack.id);
        if (idx >= 0 && idx < TRACKS.length - 1) {
            play(TRACKS[idx + 1]);
        }
    }, [currentTrack, play]);

    const prev = useCallback(() => {
        if (!currentTrack) return;
        const idx = TRACKS.findIndex(t => t.id === currentTrack.id);
        if (idx > 0) {
            play(TRACKS[idx - 1]);
        }
    }, [currentTrack, play]);

    const value = useMemo(() => ({
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
    }), [currentTrack, isPlaying, currentTime, duration, play, pause, toggle, stop, seek, next, prev]);

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
