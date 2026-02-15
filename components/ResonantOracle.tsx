
import React, { useState, useEffect } from 'react';
import { generateOracleInsight } from '../services/geminiService';
import { Sparkles } from 'lucide-react';

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
    const [displayedText, setDisplayedText] = useState('');
    
    useEffect(() => {
        setDisplayedText('');
        let i = 0;
        const interval = setInterval(() => {
            setDisplayedText((prev) => prev + text.charAt(i));
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 40); 
        return () => clearInterval(interval);
    }, [text]);

    return <span>{displayedText}</span>;
};

interface OracleProps {
    isEmbedded?: boolean;
}

const ResonantOracle: React.FC<OracleProps> = ({ isEmbedded = false }) => {
  const [intent, setIntent] = useState('');
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInsight(null);
    await new Promise(r => setTimeout(r, 2000)); 
    
    const response = await generateOracleInsight(intent);
    setInsight(response);
    setLoading(false);
  };

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden text-stone-800 ${isEmbedded ? 'py-8' : 'pt-32 pb-20 min-h-screen px-6 bg-[#f4f1ea]'}`}>
      
      <div className={`absolute inset-0 z-0 opacity-10 flex items-center justify-center pointer-events-none ${isEmbedded ? 'scale-75' : ''}`}>
          <div className="w-[150vw] h-[150vw] border border-stone-800 rounded-full"></div>
          <div className="absolute w-[100vw] h-[100vw] border border-stone-800 rounded-full"></div>
          <div className="absolute w-[50vw] h-[50vw] border border-stone-800 rounded-full"></div>
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        
        <div className={`relative flex items-center justify-center mb-12 transition-all ${isEmbedded ? 'w-64 h-64' : 'w-96 h-96'}`}>
            <div className="absolute inset-0 border border-stone-300 rounded-full"></div>
            <div className={`absolute inset-4 border border-dashed border-stone-400 rounded-full animate-spin-slow ${loading ? 'duration-[2s]' : ''}`}></div>
            <div className={`absolute inset-12 border border-stone-800 rounded-full animate-spin-reverse-slow opacity-60`}>
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-3 bg-stone-800"></div>
                 <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-3 bg-stone-800"></div>
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-1 bg-stone-800"></div>
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-1 bg-stone-800"></div>
            </div>

            <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center border-2 border-stone-800 bg-[#f4f1ea] z-20 shadow-2xl">
               {loading ? (
                   <div className="text-xs font-mono text-stone-900 animate-pulse text-center leading-tight tracking-widest">
                       THINKING...
                   </div>
               ) : (
                   <div className="flex flex-col items-center gap-2">
                       <div className="w-2 h-2 bg-stone-900 rounded-full"></div>
                       <span className="text-xs font-mono uppercase text-stone-400 tracking-widest">Ready</span>
                   </div>
               )}
            </div>
            
            <div className="absolute w-[150%] h-px bg-stone-300 top-1/2 left-[-25%] z-0"></div>
        </div>

        <div className="space-y-4 text-center mb-12">
          <p className="font-mono text-xs text-stone-500 uppercase tracking-[0.3em]">
            Digital Archive
          </p>
          <h1 className="text-4xl md:text-6xl font-serif text-stone-900 tracking-tight">The Oracle</h1>
        </div>

        {!insight ? (
          <form onSubmit={handleConsult} className="w-full max-w-xl space-y-12 animate-slide-up">
            <div className="relative group">
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                placeholder="Enter your question..."
                className="w-full bg-transparent border-b-2 border-stone-300 py-4 px-4 text-center text-xl md:text-2xl font-serif text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-800 transition-all rounded-none"
              />
              <div className="absolute bottom-0 left-0 h-[2px] bg-stone-800 w-0 group-focus-within:w-full transition-all duration-700 ease-out"></div>
            </div>
            
            <div className="flex justify-center">
                <button
                    type="submit"
                    disabled={loading}
                    className="group relative px-12 py-5 overflow-hidden hover:-translate-y-1 transition-transform"
                >
                    <span className="relative z-10 font-mono text-sm uppercase tracking-[0.3em] text-stone-800 group-hover:text-stone-50 transition-colors">
                        Consult
                    </span>
                    <div className="absolute inset-0 border border-stone-800 group-hover:bg-stone-800 transition-colors duration-500"></div>
                </button>
            </div>
          </form>
        ) : (
          <div className="w-full max-w-xl mt-4 relative animate-fade-in">
             <div className="relative bg-[#fdfbf7] border border-stone-200 p-12 md:p-16 text-center shadow-2xl">
                <div className="absolute top-2 left-2 w-4 h-4 border-t border-l border-stone-800"></div>
                <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-stone-800"></div>
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-stone-800"></div>
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b border-r border-stone-800"></div>

                <div className="mb-8 flex justify-center text-bronze-500">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                
                <p className="text-2xl md:text-3xl font-serif text-stone-900 leading-relaxed min-h-[100px]">
                   "<TypewriterText text={insight} />"
                </p>
                
                <div className="mt-12 pt-8 border-t border-stone-100">
                    <button 
                        onClick={() => setInsight(null)}
                        className="text-xs font-mono text-stone-400 hover:text-stone-900 uppercase tracking-[0.2em] transition-colors"
                    >
                        Ask Again
                    </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResonantOracle;
