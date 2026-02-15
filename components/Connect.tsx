
import React, { useState } from 'react';
import { Mail, MapPin, Instagram, Sparkles, User, MessageSquareText } from 'lucide-react';
import ResonantOracle from './ResonantOracle';

const Connect: React.FC = () => {
  const [activeChannel, setActiveChannel] = useState<'HUMAN' | 'MACHINE'>('HUMAN');

  return (
    <section className="pt-32 pb-20 min-h-screen px-6 transition-colors duration-700 ease-in-out"
             style={{ backgroundColor: activeChannel === 'MACHINE' ? '#f4f1ea' : '#f5f5f4' }}>
      
      {/* Channel Selector - Grounded Navigation */}
      <div className="max-w-md mx-auto mb-20 relative z-20">
          <div className="bg-white/50 backdrop-blur-sm border border-wood-200 rounded-full p-1 shadow-lg flex">
              <button 
                onClick={() => setActiveChannel('HUMAN')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-xs font-mono uppercase tracking-widest transition-all duration-300 ${activeChannel === 'HUMAN' ? 'bg-wood-900 text-paper-50 shadow-md transform scale-105' : 'text-wood-400 hover:text-wood-600'}`}
              >
                  <User size={16} /> The Artisan
              </button>
              <button 
                onClick={() => setActiveChannel('MACHINE')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-xs font-mono uppercase tracking-widest transition-all duration-300 ${activeChannel === 'MACHINE' ? 'bg-wood-900 text-paper-50 shadow-md transform scale-105' : 'text-wood-400 hover:text-wood-600'}`}
              >
                  <Sparkles size={16} /> The Oracle
              </button>
          </div>
          <div className="text-center mt-4">
              <span className="font-mono text-xs uppercase tracking-widest text-wood-400">
                  {activeChannel === 'HUMAN' ? 'Direct Signal // Analog' : 'Algorithmic Divination // Digital'}
              </span>
          </div>
      </div>

      {activeChannel === 'HUMAN' ? (
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 animate-slide-up">
            
            {/* About Zone */}
            <div className="space-y-8">
              <div className="relative aspect-[3/4] w-full max-w-md mx-auto lg:mx-0 bg-stone-200 overflow-hidden border border-wood-200 shadow-xl group">
                <img 
                    src="https://picsum.photos/600/800?grayscale" 
                    alt="Adrian Rasmussen" 
                    className="w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 border-[0.5px] border-paper-50/20 m-2"></div>
              </div>
              <div>
                  <h2 className="text-3xl font-serif text-wood-900 mb-4">The Artisan</h2>
                  <div className="w-12 h-px bg-bronze-500 mb-6"></div>
                  <p className="text-wood-600 leading-relaxed text-lg">
                    I am an explorer of the spaces between things. My work sits at the intersection of modern technology—using lasers to cut with precision—and ancient wisdom, honoring the organic imperfections of wood and stone. Based in the lush spiritual heart of Ubud, Bali.
                  </p>
              </div>
            </div>

            {/* Connect Zone */}
            <div className="flex flex-col justify-center space-y-12">
              <div className="space-y-6">
                <h2 className="text-3xl font-serif text-wood-900">Inquiries</h2>
                <p className="text-wood-500">
                  Available for bespoke commissions, space design consultation, and private tea ceremonies.
                </p>
                
                <div className="space-y-4 pt-4 border-l border-wood-200 pl-6">
                  <div className="flex items-center gap-4 text-wood-700">
                    <MapPin className="w-5 h-5 text-bronze-500" />
                    <span className="font-sans">Ubud, Bali, Indonesia</span>
                  </div>
                  <a href="mailto:hello@adrianrasmussen.art" className="flex items-center gap-4 text-wood-700 hover:text-bronze-500 transition-colors group">
                    <Mail className="w-5 h-5 text-bronze-500 group-hover:scale-110 transition-transform" />
                    <span className="font-sans">hello@adrianrasmussen.art</span>
                  </a>
                  <a href="#" className="flex items-center gap-4 text-wood-700 hover:text-bronze-500 transition-colors group">
                    <Instagram className="w-5 h-5 text-bronze-500 group-hover:scale-110 transition-transform" />
                    <span className="font-sans">@adrianrasmussen</span>
                  </a>
                </div>
              </div>

              <form className="space-y-8 bg-white p-8 border border-wood-100 shadow-sm relative">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-wood-300"></div>
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-wood-300"></div>
                <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-wood-300"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-wood-300"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2 group">
                    <label className="text-xs uppercase tracking-widest text-wood-400 group-focus-within:text-bronze-600 transition-colors">Name</label>
                    <input type="text" className="w-full bg-transparent border-b border-wood-200 focus:border-wood-900 py-2 outline-none transition-colors font-serif text-lg" />
                  </div>
                  <div className="space-y-2 group">
                    <label className="text-xs uppercase tracking-widest text-wood-400 group-focus-within:text-bronze-600 transition-colors">Email</label>
                    <input type="email" className="w-full bg-transparent border-b border-wood-200 focus:border-wood-900 py-2 outline-none transition-colors font-serif text-lg" />
                  </div>
                </div>
                <div className="space-y-2 group">
                  <label className="text-xs uppercase tracking-widest text-wood-400 group-focus-within:text-bronze-600 transition-colors">Message</label>
                  <textarea rows={4} className="w-full bg-transparent border-b border-wood-200 focus:border-wood-900 py-2 outline-none transition-colors resize-none font-serif text-lg"></textarea>
                </div>
                <div className="flex justify-end">
                    <button type="button" className="flex items-center gap-3 px-8 py-3 bg-wood-900 text-paper-50 uppercase tracking-widest text-xs hover:bg-bronze-600 transition-colors">
                        <MessageSquareText size={16} /> Send Transmission
                    </button>
                </div>
              </form>
            </div>

          </div>
      ) : (
          <div className="max-w-4xl mx-auto animate-slide-up min-h-[60vh] flex flex-col justify-center">
             <ResonantOracle isEmbedded={true} />
          </div>
      )}
    </section>
  );
};

export default Connect;
