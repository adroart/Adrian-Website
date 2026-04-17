
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Story, StoryCategory, AudioTrack } from '../types';
import { STORIES } from '../data/generatedStories';
import { FULL_ARCHIVE } from '../data/mockData';
import { ArrowLeft, ArrowRight, ArrowUp, Share2, Feather } from 'lucide-react';
import { img } from '../utils/cloudinary';
import BackToTop from './shared/BackToTop';
import { useMetaTags } from '../hooks/useMetaTags';

// Category subtext descriptions — the soul of each section
const CATEGORY_SUBTEXT: Record<StoryCategory, string> = {
    'Living Knowledge': 'Deep explorations of subjects earned through direct experience — not theory, but embodied understanding.',
    'Beneath the Surface': 'The meaning, origins, and stories woven into each body of work.',
    'The Practice': 'How creation happens — the rituals, tools, and inner process behind the art.',
    'The Path': 'The personal journey. Where this all began, and where it continues to lead.',
};

// #3 Category accent colors for card top borders
const CATEGORY_ACCENT: Record<StoryCategory, string> = {
    'Living Knowledge': 'var(--color-bronze-400)',
    'Beneath the Surface': 'var(--color-wood-600)',
    'The Practice': 'var(--color-stone-400)',
    'The Path': 'var(--color-bronze-600)',
};

// Safely serialize data for embedding in <script type="application/ld+json"> tags.
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

// --- Audio Track Player ---
const AudioPlayer: React.FC<{ track: AudioTrack; index: number }> = ({ track, index }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const toggle = () => {
        const el = audioRef.current;
        if (!el) return;
        if (playing) {
            el.pause();
        } else {
            el.play();
        }
        setPlaying(!playing);
    };

    const handleTimeUpdate = () => {
        const el = audioRef.current;
        if (!el || !el.duration) return;
        setProgress((el.currentTime / el.duration) * 100);
    };

    const handleEnded = () => {
        setPlaying(false);
        setProgress(0);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = audioRef.current;
        if (!el || !el.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        el.currentTime = ratio * el.duration;
    };

    return (
        <div className="flex items-center gap-4 py-4 border-b border-wood-100 last:border-0">
            <audio
                ref={audioRef}
                src={track.url}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                preload="none"
            />
            <button
                onClick={toggle}
                aria-label={playing ? 'Pause' : 'Play'}
                className="w-9 h-9 flex-shrink-0 rounded-full border border-bronze-300 flex items-center justify-center text-bronze-600 hover:bg-bronze-50 transition-colors"
            >
                {playing ? (
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                        <rect x="0" y="0" width="4" height="14" rx="1" />
                        <rect x="8" y="0" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
                        <path d="M1 1l10 6-10 6V1z" />
                    </svg>
                )}
            </button>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <span className="font-sans text-sm text-wood-800 truncate font-medium">{track.title}</span>
                    {track.duration && (
                        <span className="font-label text-[11px] text-wood-400 flex-shrink-0 font-semibold">{track.duration}</span>
                    )}
                </div>
                <div
                    className="h-[2px] bg-wood-100 rounded cursor-pointer relative"
                    onClick={handleSeek}
                >
                    <div
                        className="h-full bg-bronze-400 rounded transition-[width] duration-100"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
            <a
                href={track.url}
                download
                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-bronze-600 transition-colors font-semibold flex-shrink-0"
                aria-label={`Download ${track.title}`}
            >
                ↓
            </a>
        </div>
    );
};

// --- Individual Article View ---
export const WritingArticle: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();

    const story = useMemo(() => STORIES.find(s => s.slug === slug), [slug]);

    // Find next readings: prefer same category, then other categories
    const nextReadings = useMemo(() => {
        if (!story) return [];
        const others = STORIES.filter(s => s.slug !== slug);
        const sameCategory = others.filter(s => s.category === story.category);
        const differentCategory = others.filter(s => s.category !== story.category);
        const picks: Story[] = [];
        if (sameCategory.length > 0) picks.push(sameCategory[0]);
        if (sameCategory.length > 1) picks.push(sameCategory[1]);
        // Fill remaining slots from different categories
        for (const s of differentCategory) {
            if (picks.length >= 2) break;
            picks.push(s);
        }
        return picks.slice(0, 2);
    }, [slug, story]);

    // #18 Prev/next sequential navigation
    const { prevStory, nextStory } = useMemo(() => {
        const idx = STORIES.findIndex(s => s.slug === slug);
        return {
            prevStory: idx > 0 ? STORIES[idx - 1] : null,
            nextStory: idx < STORIES.length - 1 ? STORIES[idx + 1] : null,
        };
    }, [slug]);

    // #11 Reading progress bar
    const [readProgress, setReadProgress] = useState(0);
    // #14 Back to top visibility handled by shared BackToTop component

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    // #11 + #14 Scroll tracking for progress bar and back-to-top
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            if (docHeight > 0) {
                setReadProgress((scrollTop / docHeight) * 100);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    if (!story) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Writing Not Found</h1>
                    <p className="font-sans text-lg text-wood-600 mb-8">The piece you're looking for doesn't exist or has been moved.</p>
                    <Link
                        to="/writings"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
                    >
                        <ArrowLeft size={14} /> Back to Writings
                    </Link>
                </div>
            </section>
        );
    }

    const storyUrl = `https://adrianrasmussen.com/writings/${story.slug}`;
    const storyImageUrl = story.image
        ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/${story.image}`
        : undefined;

    useMetaTags({
        title: story.title,
        description: story.subtitle || story.excerpt,
        image: storyImageUrl,
    });

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: story.title,
        author: { '@type': 'Person', name: 'Adrian Rasmussen', url: 'https://adrianrasmussen.com/about' },
        datePublished: story.date,
        description: story.subtitle || story.excerpt,
        url: storyUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': storyUrl },
        ...(storyImageUrl && { image: storyImageUrl }),
        publisher: { '@type': 'Person', name: 'Adrian Rasmussen', url: 'https://adrianrasmussen.com/about' },
        ...(story.readMinutes && { timeRequired: `PT${story.readMinutes}M` }),
    };

    // Pieces linked to this story via relatedStorySlug
    const relatedArtworks = FULL_ARCHIVE.filter(a => a.relatedStorySlug === story.slug);

    return (
        <article className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            {/* #11 Reading progress bar */}
            <div
                className="fixed top-0 left-0 h-[2px] bg-bronze-400 z-50 transition-[width] duration-150"
                style={{ width: `${readProgress}%` }}
            />

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
            />
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-2 font-label text-xs uppercase tracking-[0.1em] text-wood-500 font-semibold">
                        <Link to="/writings" className="hover:text-wood-900 transition-colors">Writings</Link>
                        <span className="text-wood-300">/</span>
                        <span className="text-wood-400">{story.category}</span>
                    </div>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                        <button
                            onClick={() => navigator.share({ title: story.title, url: window.location.href })}
                            className="flex items-center gap-2 font-label text-[12px] uppercase tracking-[0.1em] text-wood-400 hover:text-wood-900 transition-colors font-semibold p-2"
                            aria-label="Share this writing"
                        >
                            <Share2 size={14} /> Share
                        </button>
                    )}
                </div>

                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 border border-bronze-200 rounded-full font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 mb-6 font-semibold">
                        {story.category}
                    </span>
                    <h1 className="font-serif text-4xl md:text-6xl text-wood-900 leading-[1.1] mb-6 font-medium">
                        {story.title}
                    </h1>
                    {story.subtitle && (
                        <p className="font-serif text-2xl md:text-3xl text-wood-700 font-light mb-6">
                            {story.subtitle}
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-4 font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold">
                        <span>{story.date}</span>
                        <span className="text-wood-200">·</span>
                        <span>{story.readMinutes} min read</span>
                    </div>
                </div>

                {/* #12 Improved image presentation */}
                {story.image && (
                    <div className="mb-16 overflow-hidden shadow-sm">
                        <img
                            src={img(story.image, { w: 1200, h: 800 })}
                            className="w-full h-auto aspect-[3/2] object-cover"
                            alt={`${story.title} by Adrian Rasmussen`}
                            loading="lazy"
                        />
                    </div>
                )}

                {/* Audio tracks */}
                {story.tracks && story.tracks.length > 0 && (
                    <div className="mb-16 border border-wood-200 bg-white px-6 py-2">
                        <div className="flex items-center gap-3 pt-4 pb-2 mb-2 border-b border-wood-100">
                            <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold">Listen</span>
                        </div>
                        {story.tracks.map((track, i) => (
                            <AudioPlayer key={i} track={track} index={i} />
                        ))}
                    </div>
                )}

                {/* #10 Drop cap via .article-prose + #13 Pull quotes + #15 Section dividers + #19 Responsive prose */}
                <div className="article-prose prose prose-lg md:prose-xl font-sans text-wood-900 leading-[1.85] tracking-[0.01em] mx-auto max-w-[68ch]">
                    {story.content.map((p, i) => (
                        <React.Fragment key={i}>
                            {/* #15 Subtle divider every 4 paragraphs in long articles */}
                            {i > 0 && i % 4 === 0 && story.content.length > 6 && (
                                <div className="flex justify-center py-4 not-prose">
                                    <span className="text-bronze-400 tracking-[0.5em] text-xs select-none" aria-hidden="true">···</span>
                                </div>
                            )}
                            {/* #13 Pull quotes for paragraphs starting with "> " */}
                            {p.startsWith('> ') ? (
                                <blockquote className="pull-quote my-10 text-2xl md:text-3xl text-wood-600 font-serif leading-relaxed">
                                    {p.slice(2)}
                                </blockquote>
                            ) : (
                                <p className="mb-6">{p}</p>
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Related Creations — bidirectional link back to pieces */}
                {relatedArtworks.length > 0 && (
                    <div className="mt-16 pt-12 border-t border-wood-200">
                        <h3 className="font-serif text-2xl text-wood-900 mb-8 font-medium">Related Creations</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            {relatedArtworks.map(art => (
                                <Link
                                    key={art.id}
                                    to={`/creations/${art.id}`}
                                    className="group flex gap-4 items-start"
                                >
                                    <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-wood-100 border border-wood-200">
                                        <img
                                            src={img(art.coverImage, { w: 160, h: 160 })}
                                            alt={art.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="font-sans text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                            {art.title}
                                        </h4>
                                        <p className="font-label text-[11px] text-wood-500 uppercase tracking-[0.2em] mt-1 font-semibold">
                                            {art.series ?? art.category}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* #18 Prev/Next sequential navigation */}
                <div className="mt-16 pt-12 border-t border-wood-200">
                    <div className="flex justify-between items-start gap-6">
                        {prevStory ? (
                            <Link
                                to={`/writings/${prevStory.slug}`}
                                className="group flex items-center gap-3 py-3 min-w-0 flex-1"
                            >
                                <ArrowLeft size={14} className="flex-shrink-0 text-wood-400 group-hover:text-bronze-600 transition-colors" />
                                <div className="min-w-0">
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 block font-semibold">Previous</span>
                                    <span className="font-sans text-wood-700 group-hover:text-bronze-700 transition-colors text-sm md:text-base truncate block">{prevStory.title}</span>
                                </div>
                            </Link>
                        ) : <div className="flex-1" />}
                        {nextStory ? (
                            <Link
                                to={`/writings/${nextStory.slug}`}
                                className="group flex items-center gap-3 py-3 text-right min-w-0 flex-1 justify-end"
                            >
                                <div className="min-w-0">
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 block font-semibold">Next</span>
                                    <span className="font-sans text-wood-700 group-hover:text-bronze-700 transition-colors text-sm md:text-base truncate block">{nextStory.title}</span>
                                </div>
                                <ArrowRight size={14} className="flex-shrink-0 text-wood-400 group-hover:text-bronze-600 transition-colors" />
                            </Link>
                        ) : <div className="flex-1" />}
                    </div>
                </div>

                {/* Continue the Journey — next readings */}
                {nextReadings.length > 0 && (
                    <div className="mt-16 pt-12 border-t border-wood-200">
                        <div className="flex items-center gap-3 mb-8">
                            <Feather size={16} className="text-bronze-600" />
                            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold">Continue the Journey</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {nextReadings.map(next => (
                                <Link
                                    key={next.id}
                                    to={`/writings/${next.slug}`}
                                    className="group bg-white p-6 border border-wood-200 hover:border-bronze-300 transition-all hover:shadow-sm"
                                >
                                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-2 font-semibold">
                                        {next.category}
                                    </span>
                                    <h4 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors font-medium mb-2">
                                        {next.title}
                                    </h4>
                                    <p className="font-sans text-sm text-wood-600 line-clamp-2 leading-relaxed">
                                        {next.excerpt}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* #14 Inline back to top link */}
                <div className="mt-12 text-center">
                    <button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="inline-flex items-center gap-2 font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 hover:text-wood-900 transition-colors font-semibold py-2"
                    >
                        <ArrowUp size={14} /> Return to Top
                    </button>
                </div>
            </div>

            {/* #14 Floating back to top button */}
            <BackToTop />
        </article>
    );
};

// Converts a category name to a URL-safe anchor id
const categorySlug = (cat: StoryCategory): string =>
    cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// --- Writings Landing Page ---
const Writings: React.FC = () => {
    const categories: StoryCategory[] = ['Living Knowledge', 'Beneath the Surface', 'The Practice', 'The Path'];

    // #6 Active category tracking via IntersectionObserver
    const [activeCategory, setActiveCategory] = useState('');

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    const storiesByCategory = useMemo(() => {
        const grouped: Record<StoryCategory, Story[]> = {
            'Living Knowledge': [],
            'Beneath the Surface': [],
            'The Practice': [],
            'The Path': [],
        };
        STORIES.forEach(s => grouped[s.category].push(s));
        return grouped;
    }, []);

    // Scroll to hash anchor on mount (for links arriving from other pages)
    useEffect(() => {
        if (window.location.hash) {
            const id = window.location.hash.slice(1);
            const el = document.getElementById(id);
            if (el) {
                setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 100);
            }
        } else {
            window.scrollTo(0, 0);
        }
    }, []);

    // #6 IntersectionObserver for active category highlighting
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setActiveCategory(entry.target.id);
                    }
                });
            },
            { rootMargin: '-20% 0px -70% 0px' }
        );

        Object.values(sectionRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-5xl mx-auto">

                {/* #1 Header with subtitle/epigraph */}
                <div className="text-center mb-12">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 font-medium mb-4">Writings</h1>
                    <p className="font-sans text-lg md:text-xl text-wood-500 font-light max-w-lg mx-auto leading-relaxed">
                        Reflections on art, knowledge, and the inner life — written from experience.
                    </p>
                </div>

                {/* #5 Sticky anchor navigation + #6 Active highlighting + #16 Better touch targets */}
                <nav
                    className="sticky z-10 bg-stone-950/95 backdrop-blur-xl flex flex-wrap justify-center gap-3 md:gap-10 border-b border-stone-800 pb-6 md:pb-8 mb-24 -mx-6 px-6"
                    style={{ top: 'var(--nav-height)' }}
                    aria-label="Writing sections"
                >
                    {categories.map(cat => (
                        <a
                            key={cat}
                            href={`#${categorySlug(cat)}`}
                            className={`font-label text-xs uppercase tracking-[0.2em] font-semibold transition-colors py-2 px-3 md:px-1 ${
                                activeCategory === categorySlug(cat)
                                    ? 'text-paper-50 border-b-2 border-bronze-400'
                                    : 'text-stone-400 hover:text-paper-50'
                            }`}
                        >
                            {cat}
                        </a>
                    ))}
                </nav>

                {/* Category sections */}
                {categories.map(cat => {
                    const stories = storiesByCategory[cat];
                    if (!stories || stories.length === 0) return null;
                    return (
                        <div
                            key={cat}
                            id={categorySlug(cat)}
                            className="mb-24 scroll-mt-36"
                            ref={el => { sectionRefs.current[categorySlug(cat)] = el; }}
                        >
                            <div className="mb-10 pb-6 border-b border-wood-100">
                                <h2 className="font-serif text-3xl text-wood-900 font-medium mb-2">{cat}</h2>
                                <p className="font-sans text-base text-wood-500 font-light leading-relaxed">
                                    {CATEGORY_SUBTEXT[cat]}
                                </p>
                            </div>

                            <div className="space-y-8">
                                {stories.map((story, i) => (
                                    <Link
                                        key={story.id}
                                        to={`/writings/${story.slug}`}
                                        className="stagger-in group block overflow-hidden border border-wood-200 hover:border-bronze-300 bg-white transition-all duration-300 hover:shadow-md"
                                        style={{
                                            borderTopWidth: '2px',
                                            borderTopColor: CATEGORY_ACCENT[story.category],
                                            animationDelay: `${i * 100}ms`,
                                        }}
                                    >
                                        <div className="flex flex-row">
                                            {/* Article thumbnail */}
                                            {story.image && (
                                                <div className="w-24 self-stretch flex-shrink-0 md:w-2/5 md:min-h-[220px] md:max-h-[280px] overflow-hidden bg-wood-100 flex items-center">
                                                    <img
                                                        src={img(story.image, { w: 800, h: 600, gravity: 'center' })}
                                                        alt={story.title}
                                                        className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            )}
                                            {/* Content */}
                                            <div className={`p-4 md:p-8 flex-1 flex flex-col justify-center ${story.image ? 'md:w-3/5' : 'w-full'}`}>
                                                <h3 className="font-serif text-xl md:text-2xl text-wood-900 mb-3 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                                    {story.title}
                                                </h3>
                                                <p className="font-sans text-wood-600 text-sm md:text-base leading-relaxed line-clamp-3 mb-5">
                                                    {story.excerpt}
                                                </p>
                                                {/* Refined tag pills */}
                                                {story.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 mb-5">
                                                        {story.tags.slice(0, 3).map(tag => (
                                                            <span
                                                                key={tag}
                                                                className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 bg-wood-50 rounded px-2 py-0.5 font-semibold"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold inline-flex items-center gap-2 group-hover:text-bronze-700 transition-colors">
                                                    Read <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-1" />
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Closing invitation */}
                <div className="mt-8 pt-16 border-t border-wood-200 text-center">
                    <p className="font-serif text-xl text-wood-600 font-light mb-8 max-w-xl mx-auto leading-relaxed">
                        If something here resonated, there is more to explore. Every piece begins with a conversation.
                    </p>
                    <Link
                        to="/inquire"
                        className="inline-flex items-center gap-2 font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 pb-1"
                    >
                        Begin a conversation <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default Writings;
