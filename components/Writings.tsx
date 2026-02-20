
import React, { useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Story, StoryCategory } from '../types';
import { STORIES } from '../data/mockData';
import { ArrowLeft, ArrowRight, BookOpen, Share2 } from 'lucide-react';

// --- Individual Article View ---
export const WritingArticle: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    const story = useMemo(() => STORIES.find(s => s.slug === slug), [slug]);

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
                        <p className="font-serif text-xl md:text-2xl text-wood-600 italic font-light">
                            {story.subtitle}
                        </p>
                    )}
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

    return (
        <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
            <div className="max-w-5xl mx-auto">
                {/* 10.1 Intro */}
                <div className="text-center mb-20">
                    <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">Writings</h1>
                    <p className="font-serif text-xl text-wood-600 italic font-light">
                        Sharing the experiences of growth and wisdom.
                    </p>
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-16 border-b border-wood-200 pb-8">
                    <button
                        onClick={() => setActiveCategory('All')}
                        className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${activeCategory === 'All' ? 'text-wood-900' : 'text-wood-400 hover:text-wood-600'}`}
                    >
                        All
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`font-mono text-xs uppercase tracking-widest font-bold transition-colors ${activeCategory === cat ? 'text-wood-900' : 'text-wood-400 hover:text-wood-600'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* 10.3 Living Knowledge (Highlighting) */}
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
                                    Read Presentation
                                </Link>
                            </div>
                            <div className="aspect-video bg-wood-200 overflow-hidden relative">
                                <img src="https://picsum.photos/800/600?random=ymz" className="w-full h-full object-cover" alt="Ye Ming Zhu glowing crystal by Adrian Rasmussen" loading="lazy" />
                            </div>
                        </div>
                    </div>
                )}

                {/* 10.6 All Writings List */}
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
                                <p className="font-serif text-wood-500 line-clamp-1 italic font-light">
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
        </section>
    );
};

export default Writings;
