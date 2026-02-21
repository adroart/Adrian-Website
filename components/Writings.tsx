
import React, { useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Story, StoryCategory } from '../types';
import { STORIES, FULL_ARCHIVE } from '../data/mockData';
import { ArrowLeft, ArrowRight, Share2, Feather } from 'lucide-react';

// Category subtext descriptions — the soul of each section
const CATEGORY_SUBTEXT: Record<StoryCategory, string> = {
    'Living Knowledge': 'Deep explorations of subjects earned through direct experience — not theory, but embodied understanding.',
    'Beneath the Surface': 'The meaning, origins, and stories woven into each body of work.',
    'The Practice': 'How creation happens — the rituals, tools, and inner process behind the art.',
    'The Path': 'The personal journey. Where this all began, and where it continues to lead.',
};

// Safely serialize data for embedding in <script type="application/ld+json"> tags.
function safeJsonLd(data: unknown): string {
    return JSON.stringify(data)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

// --- Individual Article View ---
export const WritingArticle: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();

    const story = useMemo(() => STORIES.find(s => s.slug === slug), [slug]);

    // Find next readings (other stories, excluding current, max 2)
    const nextReadings = useMemo(() => {
        if (!story) return [];
        return STORIES
            .filter(s => s.slug !== slug)
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
    }, [slug, story]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    if (!story) {
        return (
            <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="font-serif text-4xl text-wood-900 mb-6 font-medium">Writing Not Found</h1>
                    <p className="font-serif text-lg text-wood-600 mb-8">The piece you're looking for doesn't exist or has been moved.</p>
                    <Link
                        to="/writings"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                    >
                        <ArrowLeft size={14} /> Back to Writings
                    </Link>
                </div>
            </section>
        );
    }

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: story.title,
        author: { '@type': 'Person', name: 'Adrian Rasmussen' },
        datePublished: story.date,
        description: story.subtitle || story.excerpt,
        ...(story.image && { image: story.image }),
        publisher: { '@type': 'Person', name: 'Adrian Rasmussen' },
    };

    // Pieces linked to this story via relatedStorySlug
    const relatedArtworks = FULL_ARCHIVE.filter(a => a.relatedStorySlug === story.slug);

    return (
        <article className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: safeJsonLd(articleSchema) }}
            />
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-12">
                    <Link
                        to="/writings"
                        className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 font-bold"
                    >
                        <ArrowLeft size={16} /> Return to Index
                    </Link>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                        <button
                            onClick={() => navigator.share({ title: story.title, url: window.location.href })}
                            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-wood-400 hover:text-wood-900 transition-colors font-bold p-2"
                            aria-label="Share this writing"
                        >
                            <Share2 size={14} /> Share
                        </button>
                    )}
                </div>

                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 border border-bronze-200 rounded-full font-mono text-[11px] uppercase tracking-widest text-bronze-600 mb-6 font-bold">
                        {story.category}
                    </span>
                    <h1 className="font-serif text-4xl md:text-6xl text-wood-900 leading-[1.1] mb-6 font-medium">
                        {story.title}
                    </h1>
                    {story.subtitle && (
                        <p className="font-serif text-xl md:text-2xl text-wood-600 italic font-light mb-6">
                            {story.subtitle}
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-4 font-mono text-[11px] uppercase tracking-[0.15em] text-wood-400 font-bold">
                        <span>{story.date}</span>
                        <span className="text-wood-200">·</span>
                        <span>{story.readMinutes} min read</span>
                    </div>
                </div>

                {story.image && (
                    <div className="mb-16 bg-wood-100 border border-wood-200">
                        <img src={story.image} className="w-full h-auto" alt={`${story.title} by Adrian Rasmussen`} loading="lazy" />
                    </div>
                )}

                <div className="prose prose-xl font-serif text-wood-800 leading-[1.75] mx-auto">
                    {story.content.map((p, i) => (
                        <p key={i} className="mb-6">{p}</p>
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
                                            src={art.coverImage}
                                            alt={art.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="font-serif text-lg text-wood-900 group-hover:text-bronze-700 transition-colors font-medium leading-snug">
                                            {art.title}
                                        </h4>
                                        <p className="font-mono text-[11px] text-wood-500 uppercase tracking-widest mt-1 font-bold">
                                            {art.series ?? art.category}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Continue the Journey — next readings */}
                {nextReadings.length > 0 && (
                    <div className="mt-16 pt-12 border-t border-wood-200">
                        <div className="flex items-center gap-3 mb-8">
                            <Feather size={16} className="text-bronze-600" />
                            <h3 className="font-mono text-xs uppercase tracking-widest text-bronze-600 font-bold">Continue the Journey</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {nextReadings.map(next => (
                                <Link
                                    key={next.id}
                                    to={`/writings/${next.slug}`}
                                    className="group bg-white p-6 border border-wood-200 hover:border-bronze-300 transition-all hover:shadow-sm"
                                >
                                    <span className="font-mono text-[11px] uppercase tracking-widest text-bronze-600 block mb-2 font-bold">
                                        {next.category}
                                    </span>
                                    <h4 className="font-serif text-xl text-wood-900 group-hover:text-bronze-700 transition-colors font-medium mb-2">
                                        {next.title}
                                    </h4>
                                    <p className="font-serif text-sm text-wood-500 italic font-light line-clamp-2">
                                        {next.subtitle || next.excerpt}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
};

// Converts a category name to a URL-safe anchor id
const categorySlug = (cat: StoryCategory): string =>
    cat.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// --- Writings Landing Page ---
const Writings: React.FC = () => {
    const categories: StoryCategory[] = ['Living Knowledge', 'Beneath the Surface', 'The Practice', 'The Path'];

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

    return (
        <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 font-medium">Writings</h1>
                </div>

                {/* Anchor navigation */}
                <nav className="flex flex-wrap justify-center gap-6 md:gap-10 border-b border-wood-200 pb-8 mb-24" aria-label="Writing sections">
                    {categories.map(cat => (
                        <a
                            key={cat}
                            href={`#${categorySlug(cat)}`}
                            className="font-mono text-xs uppercase tracking-widest font-bold text-wood-400 hover:text-wood-900 transition-colors"
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
                        <div key={cat} id={categorySlug(cat)} className="mb-24 scroll-mt-28">
                            <div className="mb-8 pb-6 border-b border-wood-100">
                                <h2 className="font-serif text-3xl text-wood-900 font-medium mb-2">{cat}</h2>
                                <p className="font-serif text-base text-wood-500 italic font-light">
                                    {CATEGORY_SUBTEXT[cat]}
                                </p>
                            </div>
                            <div className="space-y-4">
                                {stories.map(story => (
                                    <Link
                                        key={story.id}
                                        to={`/writings/${story.slug}`}
                                        className="group bg-white p-6 md:p-8 border border-wood-200 hover:border-bronze-300 transition-all hover:shadow-sm flex flex-col md:flex-row md:items-center gap-6"
                                    >
                                        <div className="md:w-1/4">
                                            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-400 block mb-1 font-bold">{story.date}</span>
                                            {story.isFeatured && (
                                                <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-500 block mb-1 font-bold">Featured</span>
                                            )}
                                            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-wood-300 block mt-1 font-bold">{story.readMinutes} min read</span>
                                        </div>
                                        <div className="md:w-1/2">
                                            <h3 className="font-serif text-2xl text-wood-900 mb-2 group-hover:text-bronze-700 transition-colors font-medium">
                                                {story.title}
                                            </h3>
                                            <p className="font-serif text-wood-500 line-clamp-2 italic font-light">
                                                {story.subtitle || story.excerpt}
                                            </p>
                                        </div>
                                        <div className="md:w-1/4 flex justify-end">
                                            <div className="w-10 h-10 rounded-full border border-wood-100 flex items-center justify-center text-wood-300 group-hover:text-bronze-600 group-hover:border-bronze-200 transition-all">
                                                <ArrowRight size={16} />
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
                    <p className="font-serif text-xl text-wood-600 italic font-light mb-8 max-w-xl mx-auto">
                        If something here resonated, there is more to explore. Every piece begins with a conversation.
                    </p>
                    <Link
                        to="/inquire"
                        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                    >
                        Begin a Conversation <ArrowRight size={14} />
                    </Link>
                </div>
            </div>
        </section>
    );
};

export default Writings;
