
import React from 'react';
import { View } from '../types';
import { ArrowUpRight, ArrowRight } from 'lucide-react';

interface FooterProps {
    setView: (view: View) => void;
}

const Footer: React.FC<FooterProps> = ({ setView }) => {
    return (
        <footer className="bg-wood-100 text-wood-900 pt-16 pb-8 px-6 relative overflow-hidden border-t border-wood-200 print:hidden">
            {/* 8. The Studio Mark (Visual Anchor - Subtle) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-wood-200 rounded-full opacity-40 pointer-events-none"></div>

            <div className="max-w-[1400px] mx-auto relative z-10">
                
                {/* Top Section: Brand & Newsletter (Horizontal Split) */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-12 mb-16">
                    
                    {/* 3. Refined Branding */}
                    <div className="max-w-md">
                        <h2 className="font-serif text-2xl md:text-3xl text-wood-900 mb-4 tracking-tight font-medium">Adrian Rasmussen</h2>
                        <p className="font-sans text-wood-600 text-sm leading-relaxed">
                            Resonant artifacts for the modern sanctuary. <br />
                            Exploring the intersection of digital precision and organic imperfection.
                        </p>
                    </div>

                    {/* 4. Minimalist Newsletter */}
                    <div className="w-full md:w-auto">
                        <span className="font-mono text-xs uppercase tracking-widest text-wood-500 block mb-3 font-bold">
                            Join the Studio List
                        </span>
                        <form className="flex border-b border-wood-400 focus-within:border-bronze-600 transition-colors pb-1 w-full md:w-80 group" onSubmit={(e) => e.preventDefault()}>
                            <input 
                                type="email" 
                                placeholder="Email address" 
                                className="bg-transparent w-full outline-none text-wood-900 placeholder-wood-400 font-serif text-lg"
                            />
                            <button type="submit" className="text-wood-400 group-hover:text-bronze-600 transition-colors">
                                <ArrowRight size={18} />
                            </button>
                        </form>
                    </div>
                </div>

                {/* Middle Section: Navigation (2. Horizontal Architecture, 5. Curated Nav) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16 border-t border-wood-200 pt-12">
                    
                    {/* Column 1: Main */}
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mb-1">Index</span>
                        <button onClick={() => setView(View.ART)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">The Archive</button>
                        <button onClick={() => setView(View.STORIES)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Journal</button>
                        <button onClick={() => setView(View.SHOP)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Available Works</button>
                        <a href="#" target="_blank" className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Tea House</a>
                    </div>

                    {/* Column 2: Studio */}
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mb-1">Studio</span>
                        <button onClick={() => setView(View.STUDIO)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">About</button>
                        <button onClick={() => setView(View.STUDIO)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Commissions</button>
                        <button onClick={() => setView(View.STUDIO)} className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Contact</button>
                    </div>

                    {/* Column 3: Info */}
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mb-1">Information</span>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Shipping & Returns</button>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Care Guide</button>
                        <button className="text-left font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit">Authenticity</button>
                    </div>

                    {/* Column 4: Social */}
                    <div className="flex flex-col gap-3">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-wood-400 font-bold mb-1">Connect</span>
                        <a href="#" className="flex items-center gap-2 font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit group">
                            Instagram <ArrowUpRight size={14} className="text-wood-400 group-hover:text-bronze-600" />
                        </a>
                        <a href="mailto:hello@adrianrasmussen.art" className="flex items-center gap-2 font-serif text-base text-wood-700 hover:text-bronze-600 transition-colors w-fit group">
                            Email <ArrowUpRight size={14} className="text-wood-400 group-hover:text-bronze-600" />
                        </a>
                    </div>
                </div>

                {/* Bottom Bar: 8. Meta-Data & 1. Light Theme */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-mono uppercase tracking-widest text-wood-500 pt-8 border-t border-wood-200">
                    <div className="flex gap-6">
                        <span>© {new Date().getFullYear()} Adrian Rasmussen</span>
                        <button className="hover:text-wood-800 transition-colors">Privacy</button>
                        <button className="hover:text-wood-800 transition-colors">Terms</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-bronze-400"></span>
                        <span>Designed in Ubud, Bali</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
