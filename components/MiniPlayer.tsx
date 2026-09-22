import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePlayer, formatTime } from '../PlayerContext';
import { img } from '../utils/media';

const MiniPlayer: React.FC = () => {
    const { currentTrack, isPlaying, currentTime, duration, toggle, stop, next, prev } = usePlayer();
    const location = useLocation();

    if (!currentTrack) return null;

    // Hide on routes where the player would feel intrusive,
    // and on the dedicated track page (the page IS the expanded player).
    const path = location.pathname;
    if (path === '/welcome') return null;
    if (path === '/oracle') return null;
    if (path.startsWith('/admin')) return null;
    if (path === `/poetry/${currentTrack.slug}`) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div
            className="dark-preserve fixed bottom-0 left-0 right-0 z-40 bg-wood-900/95 backdrop-blur border-t border-bronze-400/30 print:hidden"
            style={{ animation: 'slide-up 240ms ease-out' }}
        >
            <style>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5">
                {/* Cover seal + title */}
                <Link
                    to={`/poetry/${currentTrack.slug}`}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                    <div className="w-10 h-10 flex-shrink-0 overflow-hidden bg-wood-700 border border-bronze-400/20">
                        {currentTrack.coverImage && (
                            <img
                                src={img(currentTrack.coverImage, { w: 80, h: 80 })}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>
                    <div className="min-w-0 hidden sm:block">
                        <div className="font-serif text-base text-paper-50 truncate group-hover:text-bronze-400 transition-colors leading-tight">
                            {currentTrack.title}
                        </div>
                        <div className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mt-0.5">
                            Adrian Rasmussen
                        </div>
                    </div>
                </Link>

                {/* Center transport */}
                <div className="flex flex-col items-center gap-1.5 flex-1 max-w-md">
                    <div className="flex items-center gap-3 sm:gap-5">
                        <button
                            onClick={prev}
                            aria-label="Previous"
                            className="hidden sm:block text-wood-400 hover:text-paper-50 transition-colors"
                        >
                            <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                                <rect x="0" y="0" width="2" height="14" />
                                <path d="M16 0L4 7l12 7V0z" />
                            </svg>
                        </button>
                        <button
                            onClick={toggle}
                            aria-label={isPlaying ? 'Pause' : 'Play'}
                            className="w-9 h-9 rounded-full bg-paper-50 text-wood-900 flex items-center justify-center hover:bg-bronze-300 transition-colors flex-shrink-0"
                        >
                            {isPlaying ? (
                                <svg width="10" height="12" viewBox="0 0 14 16" fill="currentColor">
                                    <rect x="0" y="0" width="5" height="16" rx="1" />
                                    <rect x="9" y="0" width="5" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="10" height="12" viewBox="0 0 14 16" fill="currentColor">
                                    <path d="M2 1l11 7-11 7V1z" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={next}
                            aria-label="Next"
                            className="hidden sm:block text-wood-400 hover:text-paper-50 transition-colors"
                        >
                            <svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor">
                                <path d="M0 0l12 7L0 14V0z" />
                                <rect x="14" y="0" width="2" height="14" />
                            </svg>
                        </button>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 w-full">
                        <span className="font-label text-[10px] text-wood-500 font-semibold tabular-nums">
                            {formatTime(currentTime)}
                        </span>
                        <div className="flex-1 h-[2px] bg-wood-700 relative overflow-hidden">
                            <div
                                className="absolute inset-y-0 left-0 bg-bronze-400 transition-[width] duration-100"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="font-label text-[10px] text-wood-500 font-semibold tabular-nums">
                            {currentTrack.duration ?? formatTime(duration)}
                        </span>
                    </div>
                </div>

                {/* Right: expand + close */}
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                    <Link
                        to={`/poetry/${currentTrack.slug}`}
                        className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 hover:text-bronze-400 font-semibold transition-colors hidden md:inline"
                    >
                        Expand
                    </Link>
                    <button
                        onClick={stop}
                        aria-label="Close player"
                        className="text-wood-500 hover:text-paper-50 transition-colors text-lg leading-none"
                    >
                        ×
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MiniPlayer;
