
import React, { useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Story, StoryCategory } from '../types';
import { STORIES, FULL_ARCHIVE } from '../data/mockData';
import { ArrowLeft, ArrowRight, BookOpen, Share2, Feather } from 'lucide-react';

// Category subtext descriptions — the soul of each section
const CATEGORY_SUBTEXT: Record<StoryCategory, string> = {
    'Living Knowledge': 'Deep explorations of subjects earned through direct experience — not theory, but embodied understanding.',
    'Beneath the Surface': 'The meaning, origins, and stories woven into each body of work.',
    'The Practice': 'How creation happens — the rituals, tools, and inner process behind the art.',
    'The Path': 'The personal journey. Where this all began, and where it continues to lead.',
};

// Category-specific featured intro text
const CATEGORY_FEATURED: Record<StoryCategory, { heading: string; body: string }> = {
    'Living Knowledge': {
        heading: 'Earned, Not Learned',
        body: 'These writings come from years of immersion — into crystals, ceremony, cultures, and creation. Each piece shares knowledge that can only be gathered through direct experience.',
    },
    'Beneath the Surface': {
        heading: 'What the Work Holds',
        body: 'Every series carries a story deeper than what meets the eye. These writings reveal the philosophy, symbolism, and experiences behind each body of work.',
    },
    'The Practice': {
        heading: 'From Formless to Form',
        body: 'The creative process is its own practice — equal parts discipline and surrender. These writings open the studio door.',
    },
    'The Path': {
        heading: 'The Thread That Connects',
        body: 'Tea, travel, ceremony, community. The path is not separate from the art — it is the art. These writings trace the journey.',
    },
};

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
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
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
                            className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-wood-400 hover:text-wood-900 transition-colors font-bold p-2"
                            aria-label="Share this writing"
                        >
                            <Share2 size={14} /> Share
                        </button>
                    )}
                </div>

                <div className="text-center mb-16">
                    <span className="inline-block px-4 py-1.5 border border-bronze-200 rounded-full font-mono text-[10px] uppercase tracking-widest text-bronze-600 mb-6 font-bold">
                        {story.category}
                    </span>
                    <h1 className="font-serif text-4xl md:text-6xl text-wood-900 leading-tight mb-6 font-medium">
                        {story.title}
                    </h1>
                    {story.subtitle && (
                        <p className="font-serif text-xl md:text-2xl text-wood-600 italic font-light mb-6">
                            {story.subtitle}
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold">
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

                <div className="prose prose-xl font-serif text-wood-800 leading-loose mx-auto">
                    {story.content.map((p, i) => (
                        <p key={i} className="mb-8">{p}</p>
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
                                        <p className="font-mono text-[10px] text-wood-500 uppercase tracking-widest mt-1 font-bold">
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
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 block mb-2 font-bold">
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

// --- Writings Landing Page ---
interface WritingsProps {
    initialCategory?: StoryCategory | 'All';
}

const Writings: React.FC<WritingsProps> = ({ initialCategory = 'All' }) => {
    const [activeCategory, setActiveCategory] = React.useState<StoryCategory | 'All'>(initialCategory);

    const categories: StoryCategory[] = ['Living Knowledge', 'Beneath the Surface', 'The Practice', 'The Path'];

    const filteredStories = useMemo(() => {
        if (activeCategory === 'All') return STORIES;
        return STORIES.filter(s => s.category === activeCategory);
    }, [activeCategory]);

    // Count articles per category
    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = { All: STORIES.length };
        categories.forEach(cat => {
            counts[cat] = STORIES.filter(s => s.category === cat).length;
        });
        return counts;
    }, []);

    return (
        <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-5xl mx-auto">
                {/* Intro */}
                <div className="text-center mb-20">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">Writings</h1>
                    <p className="font-serif text-xl text-wood-600 italic font-light max-w-2xl mx-auto">
                        The philosophy behind the work. The glowing crystal. The geometry. The path from formless to form.
                    </p>
                </div>

                {/* Category Filter with counts */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-6 border-b border-wood-200 pb-8">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors flex items-center gap-1.5 ${activeCategory === 'All' ? 'text-wood-900' : 'text-wood-400 hover:text-wood-600'}`}
                    >
                        All
                        <span className={`text-[9px] ${activeCategory === 'All' ? 'text-wood-500' : 'text-wood-300'}`}>
                            {categoryCounts['All']}
                        </span>
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors flex items-center gap-1.5 ${activeCategory === cat ? 'text-wood-900' : 'text-wood-400 hover:text-wood-600'}`}
                        >
                            {cat}
                            <span className={`text-[9px] ${activeCategory === cat ? 'text-wood-500' : 'text-wood-300'}`}>
                                {categoryCounts[cat]}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Category Subtext — visible when a specific category is selected */}
                {activeCategory !== 'All' && (
                    <div className="text-center mb-16 animate-fade-in">
                        <p className="font-serif text-lg text-wood-500 italic font-light max-w-2xl mx-auto">
                            {CATEGORY_SUBTEXT[activeCategory]}
                        </p>
                    </div>
                )}

                {/* Featured Living Knowledge — shown on "All" view */}
                {activeCategory === 'All' && (
                    <div className="mb-20 bg-wood-100/50 p-8 md:p-12 border border-wood-200">
                        <div className="flex items-center gap-3 mb-6">
                            <BookOpen size={18} className="text-bronze-600" />
                            <span className="font-mono text-xs uppercase tracking-widest text-bronze-600 font-bold">Featured Living Knowledge</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="font-serif text-4xl text-wood-900 mb-4 font-medium">Ye Ming Zhu</h2>
                                <p className="font-serif text-lg text-wood-600 mb-8 leading-relaxed">
                                    The glowing crystal. History, mysteries, meaning, and my journey with the Dragon's Pearl.
                                </p>
                                <Link
                                    to="/writings/ye-ming-zhu"
                                    className="font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 pb-1 font-bold"
                                >
                                    Begin Reading
                                </Link>
                            </div>
                            <div className="aspect-video bg-wood-200 overflow-hidden relative">
                                <img src="https://picsum.photos/800/600?random=ymz" className="w-full h-full object-cover" alt="Ye Ming Zhu glowing crystal by Adrian Rasmussen" loading="lazy" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Category-specific featured header — shown when filtering by category */}
                {activeCategory !== 'All' && (
                    <div className="mb-16 bg-wood-100/30 p-8 md:p-10 border border-wood-200 animate-fade-in">
                        <h2 className="font-serif text-3xl text-wood-900 mb-3 font-medium">
                            {CATEGORY_FEATURED[activeCategory].heading}
                        </h2>
                        <p className="font-serif text-lg text-wood-600 leading-relaxed font-light max-w-3xl">
                            {CATEGORY_FEATURED[activeCategory].body}
                        </p>
                    </div>
                )}

                {/* All Writings List */}
                <div className="space-y-4">
                    {filteredStories.map(story => (
                        <Link
                            key={story.id}
                            to={`/writings/${story.slug}`}
                            className="group cursor-pointer bg-white p-6 md:p-8 border border-wood-200 hover:border-bronze-300 transition-all hover:shadow-sm flex flex-col md:flex-row md:items-center gap-6 block"
                        >
                            <div className="md:w-1/4">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 block mb-1 font-bold">{story.date}</span>
                                <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold">{story.category}</span>
                                <span className="font-mono text-[10px] uppercase tracking-widest text-wood-300 block mt-1 font-bold">{story.readMinutes} min read</span>
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

                {/* Closing invitation */}
                <div className="mt-24 pt-16 border-t border-wood-200 text-center">
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
