
import React from 'react';
import { Mail, MapPin, Instagram, MessageSquareText, ArrowDown } from 'lucide-react';

const Studio: React.FC = () => {
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="pt-32 pb-20 min-h-screen bg-paper-50">
      
      {/* Local Section Navigation */}
      <div className="sticky top-[60px] md:top-[72px] z-30 bg-paper-50/95 backdrop-blur-md border-b border-wood-200 mb-12 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-center md:justify-start gap-4 md:gap-8">
              <button 
                onClick={() => scrollToSection('studio-about')}
                className="text-xs font-mono uppercase tracking-widest text-wood-500 hover:text-bronze-600 transition-colors"
              >
                  About Adrian
              </button>
              <span className="text-wood-300 text-xs">|</span>
              <button 
                onClick={() => scrollToSection('studio-projects')}
                className="text-xs font-mono uppercase tracking-widest text-wood-500 hover:text-bronze-600 transition-colors"
              >
                  Project inquiry
              </button>
              <span className="text-wood-300 text-xs">|</span>
              <button 
                onClick={() => scrollToSection('studio-contact')}
                className="text-xs font-mono uppercase tracking-widest text-wood-500 hover:text-bronze-600 transition-colors"
              >
                  Contact
              </button>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        
        {/* 1. ABOUT SECTION */}
        <div id="studio-about" className="scroll-mt-48 mb-32 grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="space-y-8 animate-slide-up">
                  <span className="font-mono text-xs text-bronze-500 uppercase tracking-widest block mb-2">The Artisan</span>
                  <h1 className="text-4xl md:text-5xl font-serif text-wood-900 mb-6">Adrian Rasmussen</h1>
                  <div className="w-12 h-px bg-bronze-500 mb-8"></div>
                  <p className="text-wood-700 leading-relaxed text-lg font-serif">
                    I am an explorer of the spaces between things. My work sits at the intersection of modern technology—using lasers to cut with precision—and ancient wisdom, honoring the organic imperfections of wood and stone. 
                  </p>
                  <p className="text-wood-600 leading-relaxed text-lg font-serif">
                    Based in the lush spiritual heart of Ubud, Bali, the studio operates as both a workshop and a laboratory for resonant design. Here, light is treated as a material, and shadow as a structure.
                  </p>
            </div>
            <div className="relative aspect-[3/4] w-full max-w-md mx-auto lg:mx-0 bg-stone-200 overflow-hidden border border-wood-200 shadow-xl group">
                <img 
                    src="https://picsum.photos/600/800?grayscale" 
                    alt="Adrian Rasmussen" 
                    className="w-full h-full object-cover opacity-90 transition-transform duration-1000 group-hover:scale-105"
                />
                <div className="absolute inset-0 border-[0.5px] border-paper-50/20 m-2"></div>
            </div>
        </div>

        {/* 2. COMMISSIONS / PROJECTS SECTION */}
        <div id="studio-projects" className="scroll-mt-48 mb-32 border-t border-wood-200 pt-24">
            <div className="flex flex-col md:flex-row gap-16">
                 <div className="md:w-1/3">
                     <span className="font-mono text-xs text-bronze-500 uppercase tracking-widest block mb-2">Offerings</span>
                     <h2 className="text-3xl md:text-4xl font-serif text-wood-900 mb-6">Project Inquiry</h2>
                     <p className="text-wood-600 font-serif leading-relaxed">
                         Co-creating specific artifacts for your home, altar, or public space. We begin with a consultation to understand the intention, geometry, and materials that will best serve the environment.
                     </p>
                 </div>
                 
                 <div className="md:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-8">
                      {/* Service Card 1 */}
                      <div className="bg-white border border-wood-100 p-8 hover:border-bronze-300 transition-colors">
                          <h3 className="font-serif text-xl text-wood-900 mb-3">Bespoke Artifacts</h3>
                          <p className="text-sm text-wood-500 leading-relaxed mb-4">
                              Custom geometric wall sculptures, altar pieces, and totems crafted from rare woods and metals.
                          </p>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600">Starting at $800</span>
                      </div>
                      
                      {/* Service Card 2 */}
                      <div className="bg-white border border-wood-100 p-8 hover:border-bronze-300 transition-colors">
                          <h3 className="font-serif text-xl text-wood-900 mb-3">Light & Projection</h3>
                          <p className="text-sm text-wood-500 leading-relaxed mb-4">
                              Integration of projection mapping and LED systems into physical sculptures for dynamic, living art.
                          </p>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600">Custom Quote</span>
                      </div>

                       {/* Service Card 3 */}
                       <div className="bg-white border border-wood-100 p-8 hover:border-bronze-300 transition-colors">
                          <h3 className="font-serif text-xl text-wood-900 mb-3">Resonant Space Design</h3>
                          <p className="text-sm text-wood-500 leading-relaxed mb-4">
                              Full room consultation for meditation spaces, tea rooms, and sanctuaries.
                          </p>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-600">Consultation Basis</span>
                      </div>

                      {/* Process Step */}
                      <div className="bg-wood-900 text-paper-50 p-8 flex flex-col justify-center items-center text-center">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-bronze-400 mb-2">The Process</span>
                          <p className="font-serif italic text-lg opacity-90">
                              "First we listen to the space. Then we find the geometry that speaks."
                          </p>
                      </div>
                 </div>
            </div>
        </div>

        {/* 3. CONTACT SECTION */}
        <div id="studio-contact" className="scroll-mt-48 border-t border-wood-200 pt-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
                <div>
                     <span className="font-mono text-xs text-bronze-500 uppercase tracking-widest block mb-2">Connect</span>
                     <h2 className="text-3xl md:text-4xl font-serif text-wood-900 mb-8">Start a Conversation</h2>
                     
                     <div className="space-y-6 text-lg text-wood-700 font-serif">
                         <p>
                             Whether you are interested in a commission, a studio visit, or simply wish to share a resonance, the channel is open.
                         </p>
                         <div className="pt-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <MapPin className="w-5 h-5 text-bronze-500" />
                                <span>Ubud, Bali, Indonesia</span>
                            </div>
                            <a href="mailto:hello@adrianrasmussen.art" className="flex items-center gap-4 hover:text-bronze-600 transition-colors">
                                <Mail className="w-5 h-5 text-bronze-500" />
                                <span>hello@adrianrasmussen.art</span>
                            </a>
                            <a href="#" className="flex items-center gap-4 hover:text-bronze-600 transition-colors">
                                <Instagram className="w-5 h-5 text-bronze-500" />
                                <span>@adrianrasmussen</span>
                            </a>
                        </div>
                     </div>
                </div>

                <form className="bg-white p-8 md:p-10 border border-wood-200 shadow-sm space-y-8 relative">
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

      </div>
    </section>
  );
};

export default Studio;
