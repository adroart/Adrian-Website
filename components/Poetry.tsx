import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../PlayerContext';
import { useMetaTags } from '../hooks/useMetaTags';
import { img } from '../utils/cloudinary';

const openingLineFor = (track: { openingLine?: string; poem: { lines: string[] }[] }): string => {
    if (track.openingLine) return track.openingLine;
    return track.poem[0]?.lines[0] ?? '';
};

const Poetry: React.FC = () => {
    const { tracks, tracksLoaded, currentTrack, isPlaying, play, toggle } = usePlayer();

    useMetaTags({
        title: 'Poetry',
        description: 'Poems by Adrian Rasmussen. Some of them are sung.',
    });

    return (
        <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-20">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 font-medium mb-4">Poetry</h1>
                    <p className="font-serif italic text-xl md:text-2xl text-wood-500 font-light mb-6">
                        songs that wanted to be sung
                    </p>
                    <p className="font-serif text-base md:text-lg text-wood-600 leading-relaxed max-w-xl mx-auto">
                        These pieces began as poems. Some of them asked to be sung; this is where they live.
                    </p>
                </div>

                {/* Anthology */}
                <ul className="border-t border-wood-100">
                    {tracks.map((track) => {
                        const isCurrent = currentTrack?.id === track.id;
                        const isCurrentlyPlaying = isCurrent && isPlaying;
                        const opening = openingLineFor(track);
                        return (
                            <li
                                key={track.id}
                                className={`relative border-b border-wood-100 transition-colors ${
                                    isCurrent ? 'bg-paper-100/40' : ''
                                }`}
                            >
                                {isCurrent && (
                                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-bronze-500" aria-hidden />
                                )}
                                <div className="flex items-center gap-5 py-6 sm:py-8 pl-4 sm:pl-6 pr-2">
                                    {/* Cover seal */}
                                    <Link
                                        to={`/poetry/${track.slug}`}
                                        className="w-[60px] h-[60px] sm:w-[72px] sm:h-[72px] flex-shrink-0 overflow-hidden bg-wood-100 border border-wood-200 group"
                                        aria-label={`Open ${track.title}`}
                                    >
                                        {track.coverImage && (
                                            <img
                                                src={img(track.coverImage, { w: 160, h: 160 })}
                                                alt=""
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        )}
                                    </Link>

                                    {/* Opening line + title */}
                                    <Link
                                        to={`/poetry/${track.slug}`}
                                        className="flex-1 min-w-0 group"
                                    >
                                        <p className={`font-serif italic leading-snug truncate ${
                                            isCurrent
                                                ? 'text-wood-900 text-xl sm:text-2xl'
                                                : 'text-wood-700 text-lg sm:text-2xl'
                                        } group-hover:text-bronze-700 transition-colors`}>
                                            {opening}
                                        </p>
                                        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mt-2 truncate">
                                            {track.title}
                                            {track.duration && (
                                                <>
                                                    <span className="text-wood-300 mx-2" aria-hidden>·</span>
                                                    <span className="text-wood-400">{track.duration}</span>
                                                </>
                                            )}
                                        </p>
                                    </Link>

                                    {/* Inline play affordance — does NOT navigate */}
                                    <button
                                        onClick={() => (isCurrent ? toggle() : play(track))}
                                        aria-label={isCurrentlyPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                                        className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-full border border-wood-300 text-wood-700 hover:border-bronze-500 hover:text-bronze-700 transition-colors flex items-center justify-center"
                                    >
                                        {isCurrentlyPlaying ? (
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
                                </div>
                            </li>
                        );
                    })}
                </ul>

                {tracksLoaded && tracks.length === 0 && (
                    <p className="text-center font-serif italic text-wood-500 py-16">
                        Nothing to listen to yet. Soon.
                    </p>
                )}
            </div>
        </section>
    );
};

export default Poetry;
