import React, { useEffect, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Track, Stanza } from '../types';
import { usePlayer, formatTime } from '../PlayerContext';
import { useMetaTags } from '../hooks/useMetaTags';
import { img } from '../utils/media';

// Find the index of the active stanza given the current playback time.
// Returns -1 if no stanza has a startSeconds <= time, or if no stanzas have timestamps.
function findActiveStanza(poem: Stanza[], time: number): number {
    let active = -1;
    for (let i = 0; i < poem.length; i++) {
        const s = poem[i].startSeconds;
        if (typeof s === 'number' && s <= time) {
            active = i;
        }
    }
    return active;
}

const PoetryTrack: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const { tracks, tracksLoaded, currentTrack, isPlaying, currentTime, duration, play, toggle, seek, audioRef } = usePlayer();

    const track = useMemo<Track | undefined>(() => tracks.find(t => t.slug === slug), [tracks, slug]);

    const idx = useMemo(() => (track ? tracks.findIndex(t => t.id === track.id) : -1), [tracks, track]);
    const prevTrack = idx > 0 ? tracks[idx - 1] : null;
    const nextTrack = idx >= 0 && idx < tracks.length - 1 ? tracks[idx + 1] : null;

    const isActive = !!track && currentTrack?.id === track.id;
    const time = isActive ? currentTime : 0;
    const dur = isActive && duration > 0 ? duration : (track?.durationSeconds ?? 0);
    const progress = dur > 0 ? Math.min(1, time / dur) : 0;

    // Wavesurfer (lazy-loaded, attached to root <audio> via MediaElement backend)
    const waveContainerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<any>(null);

    useEffect(() => {
        if (!track || !waveContainerRef.current || !audioRef.current) return;
        if (!isActive) return;

        let cancelled = false;
        let ws: any = null;

        import('wavesurfer.js').then((mod) => {
            if (cancelled || !waveContainerRef.current || !audioRef.current) return;
            const WaveSurfer = mod.default;
            try {
                ws = WaveSurfer.create({
                    container: waveContainerRef.current,
                    media: audioRef.current,
                    waveColor: 'rgba(124, 95, 60, 0.35)',
                    progressColor: 'rgba(184, 138, 79, 0.95)',
                    cursorColor: 'rgba(184, 138, 79, 0)',
                    height: 36,
                    barWidth: 2,
                    barGap: 2,
                    barRadius: 1,
                    normalize: true,
                });
                wavesurferRef.current = ws;
            } catch {
                // Wavesurfer fails silently — the audio strip remains usable, just without the waveform.
            }
        });

        return () => {
            cancelled = true;
            try {
                wavesurferRef.current?.destroy();
            } catch {
                // ignore
            }
            wavesurferRef.current = null;
        };
    }, [track, isActive, audioRef]);

    useMetaTags({
        title: track ? `${track.title}, Poetry by Adrian Rasmussen` : 'Poetry',
        description: track
            ? `A poem by Adrian Rasmussen, with an accompanying song.`
            : 'Poetry by Adrian Rasmussen.',
        image: track?.coverImage
            ? `https://adrianrasmussen.com${img(track.coverImage, { w: 1200, h: 630, format: 'jpg' })}`
            : undefined,
    });

    if (!track) {
        if (!tracksLoaded) {
            return <section className="min-h-screen bg-paper-50" />;
        }
        return (
            <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Poem not found</h1>
                    <Link
                        to="/poetry"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
                    >
                        <ArrowLeft size={14} /> Back to all poems
                    </Link>
                </div>
            </section>
        );
    }

    const hasTimestamps = track.poem.some(s => typeof s.startSeconds === 'number');
    const activeStanza = hasTimestamps ? findActiveStanza(track.poem, time) : -1;

    return (
        <article className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-[640px] mx-auto">
                {/* Top: cover seal + title + dedication + audio strip */}
                <header className="text-center mb-16">
                    {track.coverImage && (
                        <div className="w-[140px] h-[140px] mx-auto overflow-hidden border border-wood-200 bg-wood-100 mb-8">
                            <img
                                src={img(track.coverImage, { w: 280, h: 280 })}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    <h1 className="font-display text-4xl md:text-5xl text-wood-900 font-medium leading-tight mb-4">
                        {track.title}
                    </h1>
                    {track.dedication && (
                        <p className="font-serif italic text-base md:text-lg text-wood-500 mb-8">
                            {track.dedication}
                        </p>
                    )}

                    {/* Audio strip */}
                    <div className="flex items-center gap-4 max-w-md mx-auto">
                        <button
                            onClick={() => (isActive ? toggle() : play(track))}
                            aria-label={isActive && isPlaying ? 'Pause' : 'Play'}
                            className="w-11 h-11 rounded-full bg-wood-900 text-paper-50 flex items-center justify-center hover:bg-bronze-700 transition-colors flex-shrink-0"
                        >
                            {isActive && isPlaying ? (
                                <svg width="11" height="13" viewBox="0 0 14 16" fill="currentColor">
                                    <rect x="0" y="0" width="5" height="16" rx="1" />
                                    <rect x="9" y="0" width="5" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="11" height="13" viewBox="0 0 14 16" fill="currentColor">
                                    <path d="M2 1l11 7-11 7V1z" />
                                </svg>
                            )}
                        </button>
                        <div className="flex-1 min-w-0">
                            {/* Wavesurfer container — only renders meaningfully once active */}
                            <div ref={waveContainerRef} className={`h-[36px] ${isActive ? '' : 'hidden'}`} />
                            {!isActive && (
                                <div className="h-[36px] flex items-center">
                                    <div className="w-full h-[2px] bg-wood-200 relative overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-bronze-400/60"
                                            style={{ width: `${progress * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between mt-1">
                                <span className="font-label text-[10px] text-wood-400 font-semibold tabular-nums">
                                    {formatTime(time)}
                                </span>
                                <span className="font-label text-[10px] text-wood-400 font-semibold tabular-nums">
                                    {track.duration ?? formatTime(dur)}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Poem with bronze tide marker in the left margin */}
                <div className="relative pl-6 md:pl-10 pr-2 pb-16">
                    <div className="absolute top-0 bottom-0 left-0 w-px bg-bronze-500/15" aria-hidden />
                    <div
                        className="absolute top-0 left-0 w-px bg-bronze-500 transition-[height] duration-200"
                        style={{ height: `${progress * 100}%` }}
                        aria-hidden
                    />

                    <div className="space-y-10">
                        {track.poem.map((stanza, i) => {
                            const isClickable = typeof stanza.startSeconds === 'number';
                            const isCurrent = hasTimestamps && i === activeStanza;
                            const baseClasses = 'block w-full text-left font-serif leading-[1.85] whitespace-pre-line transition-colors duration-300';
                            const sizeClasses = 'text-[1.375rem] md:text-[1.5rem]';
                            const colorClasses = isCurrent
                                ? 'text-wood-900 font-medium'
                                : hasTimestamps
                                    ? 'text-wood-500'
                                    : 'text-wood-700';
                            const text = stanza.lines.join('\n');

                            if (isClickable) {
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            if (!isActive) play(track);
                                            seek(stanza.startSeconds!);
                                        }}
                                        className={`${baseClasses} ${sizeClasses} ${colorClasses} hover:text-wood-900 cursor-pointer`}
                                    >
                                        {text}
                                    </button>
                                );
                            }
                            return (
                                <p key={i} className={`${baseClasses} ${sizeClasses} ${colorClasses}`}>
                                    {text}
                                </p>
                            );
                        })}
                    </div>
                </div>

                {/* Themes */}
                {track.themes && track.themes.length > 0 && (
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold text-center mb-10">
                        {track.themes.join(' · ')}
                    </p>
                )}

                {/* AI note */}
                {track.aiNote && (
                    <p className="font-sans text-[11px] text-wood-400 text-center mb-12 max-w-md mx-auto leading-relaxed">
                        {track.aiNote}
                    </p>
                )}

                {/* Sequential nav */}
                {(prevTrack || nextTrack) && (
                    <div className="border-t border-wood-200 pt-10 grid grid-cols-2 gap-6">
                        <div>
                            {prevTrack && (
                                <Link to={`/poetry/${prevTrack.slug}`} className="group block">
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold block mb-1">
                                        ← {prevTrack.title}
                                    </span>
                                    <span className="font-serif italic text-wood-500 text-base group-hover:text-wood-900 transition-colors leading-snug block">
                                        {prevTrack.openingLine ?? prevTrack.poem[0]?.lines[0]}
                                    </span>
                                </Link>
                            )}
                        </div>
                        <div className="text-right">
                            {nextTrack && (
                                <Link to={`/poetry/${nextTrack.slug}`} className="group block">
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold block mb-1">
                                        {nextTrack.title} →
                                    </span>
                                    <span className="font-serif italic text-wood-500 text-base group-hover:text-wood-900 transition-colors leading-snug block">
                                        {nextTrack.openingLine ?? nextTrack.poem[0]?.lines[0]}
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* Back to all */}
                <div className="text-center mt-12">
                    <Link
                        to="/poetry"
                        className="inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 hover:text-wood-900 font-semibold transition-colors"
                    >
                        <ArrowLeft size={12} /> Back to all poems
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default PoetryTrack;
