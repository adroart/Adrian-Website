
import React from 'react';

// Feature 5: Infinite "Data Tape" Marquee
const InfiniteMarquee = () => {
    return (
        <div className="w-full overflow-hidden bg-stone-900 py-4 my-20">
            <div className="animate-marquee whitespace-nowrap flex gap-12">
                {[...Array(10)].map((_, i) => (
                    <span key={i} className="text-stone-400 font-mono text-sm uppercase tracking-[0.4em] flex items-center gap-12">
                        Sacred Geometry <span>//</span> Spatial Resonance <span>//</span> Timeless Craft <span>//</span> Precision
                    </span>
                ))}
            </div>
        </div>
    );
};

const Offerings: React.FC = () => {
  return (
    <section className="pt-40 pb-20 min-h-screen">
      <div className="px-6 max-w-7xl mx-auto mb-20">
         <div className="border-l-2 border-bronze-500 pl-8">
            <h1 className="text-5xl md:text-7xl font-serif text-stone-900 mb-6">Offerings</h1>
            <p className="text-stone-500 font-light max-w-2xl text-lg">
            Extending the philosophy of resonant design into your personal environment and practice.
            </p>
         </div>
      </div>

      <InfiniteMarquee />

      <div className="px-6 max-w-7xl mx-auto space-y-32">
        {/* Service 1 */}
        <div className="flex flex-col md:flex-row gap-16 items-center group">
          <div className="w-full md:w-1/2 h-[500px] bg-stone-200 overflow-hidden relative">
             <div className="absolute inset-0 bg-stone-900/10 group-hover:bg-transparent transition-colors z-10"></div>
             <img src="https://picsum.photos/800/600?random=30" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
          </div>
          <div className="w-full md:w-1/2 space-y-8">
            <span className="font-mono text-sm text-bronze-500 uppercase tracking-widest">01 // Commission</span>
            <h3 className="text-4xl font-serif text-stone-900">Bespoke Artifacts</h3>
            <p className="text-stone-600 font-light leading-relaxed text-lg">
              Co-creating specific artifacts for your home or altar. We begin with a consultation to understand the intention, geometry, and materials that will best serve the space. From large-scale wall installations to intimate handheld totems.
            </p>
            <button className="text-base uppercase tracking-widest text-stone-900 border-b border-stone-900 pb-1 hover:text-bronze-600 hover:border-bronze-600 transition-colors">
              Start a Commission
            </button>
          </div>
        </div>

        {/* Service 2 */}
        <div className="flex flex-col md:flex-row-reverse gap-16 items-center group">
          <div className="w-full md:w-1/2 h-[500px] bg-stone-200 overflow-hidden relative">
            <div className="absolute inset-0 bg-stone-900/10 group-hover:bg-transparent transition-colors z-10"></div>
            <img src="https://picsum.photos/800/600?random=31" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
          </div>
          <div className="w-full md:w-1/2 space-y-8">
             <span className="font-mono text-sm text-bronze-500 uppercase tracking-widest">02 // Environment</span>
            <h3 className="text-4xl font-serif text-stone-900">Resonant Space Design</h3>
            <p className="text-stone-600 font-light leading-relaxed text-lg">
              Specializing in the creation of tea rooms, meditation corners, and sanctuary spaces. I apply principles of flow, lighting, and texture to create environments that naturally induce a state of calm awareness.
            </p>
            <button className="text-base uppercase tracking-widest text-stone-900 border-b border-stone-900 pb-1 hover:text-bronze-600 hover:border-bronze-600 transition-colors">
              View Design Portfolio
            </button>
          </div>
        </div>

         {/* Service 3 */}
         <div className="flex flex-col md:flex-row gap-16 items-center group">
          <div className="w-full md:w-1/2 h-[500px] bg-stone-200 overflow-hidden relative">
             <div className="absolute inset-0 bg-stone-900/10 group-hover:bg-transparent transition-colors z-10"></div>
             <img src="https://picsum.photos/800/600?random=32" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000" />
          </div>
          <div className="w-full md:w-1/2 space-y-8">
            <span className="font-mono text-sm text-bronze-500 uppercase tracking-widest">03 // Ritual</span>
            <h3 className="text-4xl font-serif text-stone-900">Private Tea Ceremonies</h3>
            <p className="text-stone-600 font-light leading-relaxed text-lg">
              Hosted in Ubud or at your private residence. A silent, bowl-based tea ceremony using aged Puerh and antique wares. This is not a performance, but a shared meditation and a cleansing of the senses.
            </p>
            <button className="text-base uppercase tracking-widest text-stone-900 border-b border-stone-900 pb-1 hover:text-bronze-600 hover:border-bronze-600 transition-colors">
              Book a Session
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Offerings;
