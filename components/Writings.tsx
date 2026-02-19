
import React, { useState, useMemo } from 'react';
import { Story, StoryCategory } from '../types';
import { STORIES } from '../data/mockData';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';

const Writings: React.FC = () => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [activeCategory, setActiveCategory] = useState<StoryCategory | 'All'>('All');

  const categories: StoryCategory[] = ['Living Knowledge', 'Beneath the Surface', 'The Practice', 'The Path'];

  const filteredStories = useMemo(() => {
      if (activeCategory === 'All') return STORIES;
      return STORIES.filter(s => s.category === activeCategory);
  }, [activeCategory]);

  if (selectedStory) {
      return (
          <article className="min-h-screen bg-paper-50 pt-32 pb-32 px-6 animate-fade-in">
              <div className="max-w-3xl mx-auto">
                  <button 
                      onClick={() => setSelectedStory(null)}
                      className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-500 hover:text-wood-900 mb-12 font-bold"
                  >
                      <ArrowLeft size={16} /> Return to Index
                  </button>
                  
                  <div className="text-center mb-16">
                      <span className="inline-block px-4 py-1.5 border border-bronze-200 rounded-full font-mono text-[10px] uppercase tracking-widest text-bronze-600 mb-6 font-bold">
                          {selectedStory.category}
                      </span>
                      <h1 className="font-serif text-4xl md:text-6xl text-wood-900 leading-tight mb-6 font-medium">
                          {selectedStory.title}
                      </h1>
                      {selectedStory.subtitle && (
                          <p className="font-serif text-xl md:text-2xl text-wood-600 italic font-light">
                              {selectedStory.subtitle}
                          </p>
                      )}
                  </div>

                  {selectedStory.image && (
                      <div className="mb-16 bg-wood-100 border border-wood-200">
                          <img src={selectedStory.image} className="w-full h-auto" alt="" />
                      </div>
                  )}

                  <div className="prose prose-xl font-serif text-wood-800 leading-loose mx-auto">
                      {selectedStory.content.map((p, i) => (
                          <p key={i} className="mb-8">{p}</p>
                      ))}
                  </div>
              </div>
          </article>
      );
  }

  return (
      <section className="min-h-screen bg-paper-50 pt-32 pb-32 px-6">
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
                              <button className="font-mono text-xs uppercase tracking-widest text-wood-900 border-b border-wood-900 pb-1 font-bold">
                                  Read Presentation
                              </button>
                          </div>
                          <div className="aspect-video bg-wood-200 overflow-hidden relative">
                               <img src="https://picsum.photos/800/600?random=ymz" className="w-full h-full object-cover" />
                          </div>
                      </div>
                  </div>
              )}

              {/* 10.6 All Writings List */}
              <div className="space-y-4">
                  {filteredStories.map(story => (
                      <div 
                          key={story.id} 
                          onClick={() => { setSelectedStory(story); window.scrollTo(0,0); }}
                          className="group cursor-pointer bg-white p-6 md:p-8 border border-wood-200 hover:border-bronze-300 transition-all hover:shadow-sm flex flex-col md:flex-row md:items-center gap-6"
                      >
                          <div className="md:w-1/4">
                               <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 block mb-1 font-bold">{story.date}</span>
                               <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600 font-bold">{story.category}</span>
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
                      </div>
                  ))}
              </div>
          </div>
      </section>
  );
};

export default Writings;
