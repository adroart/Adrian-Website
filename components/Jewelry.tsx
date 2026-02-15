
import React, { useMemo } from 'react';
import { INVENTORY } from '../data/mockData';
import { Diamond, ArrowRight, Sparkles } from 'lucide-react';
import { Product } from '../types';

// Reuse Product Card style but simpler for this page
const JewelryCard: React.FC<{ product: Product }> = ({ product }) => (
    <div className="group cursor-pointer">
        <div className="aspect-[4/5] bg-wood-100 overflow-hidden relative mb-4">
             <img 
                src={product.image} 
                alt={product.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
             />
             <div className="absolute inset-0 bg-wood-900/0 group-hover:bg-wood-900/10 transition-colors"></div>
        </div>
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-serif text-lg text-wood-900">{product.title}</h3>
                <p className="font-mono text-xs text-wood-500 uppercase tracking-wide mt-1">{product.material}</p>
            </div>
            <span className="font-mono text-sm text-wood-900">${product.price}</span>
        </div>
    </div>
);

const Jewelry: React.FC = () => {
    // Filter for jewelry items
    const jewelryItems = useMemo(() => {
        return INVENTORY.filter(item => item.category === 'Jewelry' || item.category === 'Metalwork');
    }, []);

    return (
        <section className="pt-32 pb-20 min-h-screen bg-paper-50">
            {/* Header */}
            <div className="max-w-7xl mx-auto px-6 mb-24">
                <div className="max-w-3xl">
                     <div className="flex items-center gap-2 text-bronze-600 mb-6">
                         <Diamond size={16} />
                         <span className="font-mono text-xs uppercase tracking-widest">Resonant Adornment</span>
                     </div>
                     <h1 className="text-4xl md:text-6xl font-serif text-wood-900 mb-8 leading-tight">
                         Carrying intention on the skin.
                     </h1>
                     <p className="text-xl text-wood-600 font-serif leading-relaxed max-w-2xl">
                         The Resonance Collection explores jewelry not as decoration, but as talisman. 
                         Brass, silver, and copper pieces designed to conduct energy and anchor your daily practice.
                     </p>
                </div>
            </div>

            {/* Featured Visual */}
            <div className="w-full h-[60vh] bg-stone-200 mb-24 relative overflow-hidden">
                <img 
                    src="https://picsum.photos/1920/1080?random=888" 
                    className="w-full h-full object-cover opacity-90"
                    alt="Jewelry Editorial"
                />
                <div className="absolute inset-0 bg-wood-900/20 mix-blend-multiply"></div>
                <div className="absolute bottom-12 left-6 md:left-12 text-paper-50 max-w-md">
                     <h3 className="font-serif text-3xl mb-4">The Brass Series</h3>
                     <p className="text-paper-100 font-light mb-6">Hand-oxidized geometric forms that develop a unique patina with your touch.</p>
                     <button className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest border-b border-paper-50 pb-1 hover:text-bronze-300 hover:border-bronze-300 transition-colors">
                         View the Lookbook <ArrowRight size={14} />
                     </button>
                </div>
            </div>

            {/* Product Grid */}
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between mb-12 border-b border-wood-200 pb-4">
                     <h2 className="font-serif text-2xl text-wood-900">Current Collection</h2>
                     <span className="font-mono text-xs uppercase tracking-widest text-wood-500">{jewelryItems.length} Pieces Available</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
                    {jewelryItems.map(item => (
                        <JewelryCard key={item.id} product={item} />
                    ))}
                </div>
                
                {jewelryItems.length === 0 && (
                    <div className="py-20 text-center">
                        <p className="font-serif text-wood-500">The collection is currently being forged. Check back soon.</p>
                    </div>
                )}
            </div>

            {/* Ritual Note */}
            <div className="max-w-4xl mx-auto px-6 mt-32 text-center">
                 <Sparkles className="mx-auto text-bronze-500 mb-6" size={24} />
                 <h3 className="font-serif text-3xl text-wood-900 mb-4">A Note on Patina</h3>
                 <p className="text-wood-600 font-serif leading-relaxed">
                     Unlike industrial steel, these metals are alive. They will darken, shine, and change based on your skin's chemistry and the air in your environment. We believe this aging process is part of the artifact's soul.
                 </p>
            </div>
        </section>
    );
};

export default Jewelry;
