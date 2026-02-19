
import React from 'react';
import InteractiveOracle from './ResonantOracle'; 
import { INVENTORY, STORIES } from '../data/mockData';
import { Sparkles, Layers } from 'lucide-react';

const OracleHub: React.FC = () => {
    const oracleProducts = INVENTORY.filter(p => p.category === 'Oracle' || p.category === 'Paper Goods');
    const relatedStories = STORIES.filter(s => s.tags.includes('Zen') || s.tags.includes('Symbols'));

    return (
        <section className="pt-32 pb-20 min-h-screen bg-[#f4f1ea]">
             {/* 1. Header & Intro */}
             <div className="max-w-4xl mx-auto px-6 text-center mb-20">
                 <span className="font-mono text-xs uppercase tracking-[0.3em] text-bronze-600 block mb-4">
                     Systema Naturae
                 </span>
                 <h1 className="text-5xl md:text-7xl font-serif text-stone-900 mb-8 tracking-tight">
                     The Oracle
                 </h1>
                 <p className="text-xl text-stone-600 font-serif leading-relaxed">
                     Tools for navigation in a noisy world. <br/>
                     Consult the digital mechanism below, or acquire physical decks for your altar.
                 </p>
             </div>

             {/* 2. Interactive Oracle (The "Machine") */}
             <div className="mb-32 border-y border-stone-300 bg-[#fdfbf7] py-20">
                 <div className="max-w-5xl mx-auto">
                     <InteractiveOracle isEmbedded={true} />
                 </div>
             </div>

             {/* 3. Physical Tools (Shop Integration) */}
             <div className="max-w-7xl mx-auto px-6 mb-32">
                 <div className="flex items-center gap-3 mb-12">
                     <Layers className="text-bronze-500" size={20} />
                     <h2 className="font-serif text-3xl text-stone-900">Physical Decks & Tools</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                     {oracleProducts.map(product => (
                         <div key={product.id} className="group cursor-pointer">
                             <div className="aspect-[3/4] bg-stone-200 mb-6 overflow-hidden relative border border-stone-200">
                                 <img src={product.image} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt={product.title} />
                                 <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/10 transition-colors"></div>
                             </div>
                             <h3 className="font-serif text-xl text-stone-900 mb-1">{product.title}</h3>
                             <p className="font-mono text-xs text-stone-500 uppercase tracking-wide mb-3">{product.category}</p>
                             <span className="font-mono text-sm text-stone-900">${product.price}</span>
                         </div>
                     ))}
                     {oracleProducts.length === 0 && (
                         <div className="col-span-full py-12 text-center border border-dashed border-stone-300">
                             <p className="font-serif text-stone-500">New editions are currently in press.</p>
                         </div>
                     )}
                 </div>
             </div>

             {/* 4. Philosophy / Stories */}
             <div className="max-w-4xl mx-auto px-6">
                 <div className="text-center mb-12">
                     <Sparkles className="mx-auto text-bronze-500 mb-4" size={24} />
                     <h2 className="font-serif text-3xl text-stone-900 mb-4">The Logic of Chance</h2>
                     <p className="text-stone-600 font-serif leading-relaxed">
                         The oracle is not about predicting the future. It is about triangulating the present. 
                         By introducing a random variable (a card, a generated phrase) into our linear thinking, we break the loop and allow new insight to enter.
                     </p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     {relatedStories.slice(0, 2).map(story => (
                         <div key={story.id} className="bg-white p-8 border border-stone-200 hover:border-bronze-300 transition-colors cursor-pointer group">
                             <span className="font-mono text-[10px] uppercase tracking-widest text-stone-400 mb-2 block">{story.date}</span>
                             <h4 className="font-serif text-xl text-stone-900 mb-3 group-hover:text-bronze-700 transition-colors">{story.title}</h4>
                             <p className="text-sm text-stone-500 leading-relaxed mb-4 line-clamp-2">{story.excerpt}</p>
                             <span className="text-xs font-mono uppercase tracking-widest text-stone-900 border-b border-stone-200 pb-0.5 group-hover:border-bronze-500 transition-colors">Read Essay</span>
                         </div>
                     ))}
                 </div>
             </div>
        </section>
    );
};

export default OracleHub;
