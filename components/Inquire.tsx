
import React from 'react';
import { Mail, MapPin } from 'lucide-react';

const Inquire: React.FC = () => {
  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-20">
      
      {/* 9.1 Hero */}
      <div className="max-w-[1400px] mx-auto px-6 mb-24">
          <div className="flex flex-col md:flex-row gap-1">
              <div className="flex-1 h-[400px] md:h-[600px] bg-wood-100 relative overflow-hidden">
                  <img src="https://picsum.photos/1000/1200?random=inq1" className="w-full h-full object-cover grayscale" alt="Intimate Piece" />
                  <div className="absolute bottom-6 left-6 bg-paper-50/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest font-bold">Personal</div>
              </div>
              <div className="flex-1 h-[400px] md:h-[600px] bg-wood-100 relative overflow-hidden">
                  <img src="https://picsum.photos/1200/1000?random=inq2" className="w-full h-full object-cover grayscale" alt="Large Installation" />
                  <div className="absolute bottom-6 left-6 bg-paper-50/90 px-4 py-2 font-mono text-[10px] uppercase tracking-widest font-bold">Spatial</div>
              </div>
          </div>
      </div>

      <div className="max-w-3xl mx-auto px-6">
          
          {/* 9.2 Opening */}
          <div className="mb-16">
               <h1 className="font-serif text-5xl text-wood-900 mb-8 font-medium">Inquire</h1>
               <p className="font-serif text-xl text-wood-700 leading-relaxed font-light mb-6">
                  I take on a small number of commissions each year. Some become intimate pieces for personal spaces. Others become installations that transform environments.
               </p>
               <p className="font-serif text-lg text-wood-600 leading-relaxed">
                  I'm selective. Not because of budget, but because of fit. The right projects find me, and I recognize them when they do. If you're feeling a pull toward working together, trust that.
               </p>
          </div>

          {/* 9.3 Commission Paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
               <div className="bg-white p-8 border border-wood-200">
                   <h3 className="font-serif text-2xl text-wood-900 mb-3 font-medium">Personal Commissions</h3>
                   <p className="font-serif text-wood-600 mb-4">Something for your home, your altar, your life. Pieces created from conversation.</p>
               </div>
               <div className="bg-white p-8 border border-wood-200">
                   <h3 className="font-serif text-2xl text-wood-900 mb-3 font-medium">Spatial Commissions</h3>
                   <p className="font-serif text-wood-600 mb-4">Installations. Tea houses. Stages. Spaces where people can gather and connect.</p>
               </div>
          </div>

          {/* 9.4 Form */}
          <div className="bg-wood-50 p-8 md:p-12 border border-wood-100 relative">
               <h3 className="font-serif text-3xl text-wood-900 mb-8 font-medium">Start the conversation</h3>
               <form className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Name</label>
                            <input type="text" className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">Email</label>
                            <input type="email" className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg" required />
                        </div>
                   </div>
                   
                   <div className="space-y-2">
                        <label className="text-xs font-mono uppercase tracking-widest text-wood-500 font-bold">What wants to exist?</label>
                        <textarea rows={4} className="w-full bg-transparent border-b border-wood-300 py-2 focus:border-bronze-500 outline-none font-serif text-lg resize-none" placeholder="Tell me what you're imagining..." required></textarea>
                   </div>

                   {/* Collapsible optionals could go here */}

                   <div className="flex justify-end pt-4">
                        <button className="px-10 py-4 bg-wood-900 text-paper-50 font-mono text-xs uppercase tracking-widest hover:bg-bronze-600 transition-colors font-bold shadow-lg">
                            Send Transmission
                        </button>
                   </div>
               </form>
          </div>

          {/* 9.5 Below Form */}
          <div className="mt-12 text-center">
              <p className="font-serif text-wood-600">
                  Light Codes can also be created for you. <button className="text-bronze-600 underline underline-offset-4 decoration-1">Learn more</button>
              </p>
          </div>

      </div>
    </section>
  );
};

export default Inquire;
