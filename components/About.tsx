
import React from 'react';

const About: React.FC = () => {
  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
        <div className="max-w-4xl mx-auto animate-fade-in">
            
            {/* 4.1 What I Create */}
            <div className="mb-24">
                 <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-12 font-medium">About</h1>
                 <p className="font-serif text-2xl md:text-3xl text-wood-800 leading-relaxed font-light mb-8">
                    Multidimensional wooden sculptures. Original paintings with projection mapping and LED. Jewelry. Oracle cards. Immersive installations. Tea houses and spaces designed for presence. Artifacts of the future.
                 </p>
                 <p className="font-serif text-lg text-wood-600 leading-relaxed">
                    Hundreds of pieces collected throughout the world. From Dubai to South Africa to the US and beyond. Working between Bali and California.
                 </p>
            </div>

            {/* 4.2 The Root */}
            <div className="mb-24 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div>
                     <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-4 font-bold">The Root</span>
                     <div className="prose prose-lg font-serif text-wood-700">
                         <p>
                            In my earliest years of school, I sat with the founder who had taken a vow of silence. He was from India but had decided to bring his wisdom to the West. People still flew from India to see him.
                         </p>
                         <p>
                            I had the opportunity to ask questions. He would respond on a chalkboard. But the feeling of sitting next to him was enough. The feeling of being seen. The feeling of presence. The feeling of truth that comes through your connection directly to the Divine was the only question that mattered. And there was no answer. Except to sit and enjoy the Divinity.
                         </p>
                         <p>
                            Those years taught me the value of just being. Centered in yourself. Just unconditionally being there with someone. This is what inspires me to create.
                         </p>
                     </div>
                </div>
                <div className="bg-wood-200 aspect-[3/4] relative overflow-hidden">
                    <img src="https://picsum.photos/800/1200?random=about1" className="w-full h-full object-cover grayscale opacity-90" alt="Adrian Portrait" />
                </div>
            </div>

            {/* 4.3 The Path */}
            <div className="mb-24">
                 <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-4 font-bold">The Path</span>
                 <div className="prose prose-xl font-serif text-wood-800 max-w-2xl">
                     <p>
                        Tea came early. My father introduced it when I was young. In 2009, I began exploring Asia. China, Japan, Thailand, Taiwan, Bali. Learning the ways of different cultures. Qigong, Tai Chi, meditation, tea ceremony. Since 2010, I've been trading artwork for Chinese tea.
                     </p>
                     <p>
                        Along the way, I found new tools. Laser cutting, LEDs, airbrushing, projection mapping. The forms evolved. The intention stayed the same. Bringing the formless into form.
                     </p>
                 </div>
            </div>

            {/* 4.4 Connection */}
            <div className="bg-wood-100 p-8 md:p-12 mb-24 border-l-4 border-bronze-400">
                 <h3 className="font-serif text-3xl text-wood-900 mb-6 font-medium">Connection</h3>
                 <p className="font-serif text-lg text-wood-700 leading-relaxed max-w-3xl">
                    Bringing people together has always been the thread. In Santa Cruz, I co-founded the Hide Gallery, which won Best Art Gallery. I worked with the city to bring the Tannery Lofts into being. I created installations for ten Burning Man festivals. Now I design tea houses and spaces where people can gather. All in service of what happens between people when presence is held.
                 </p>
            </div>

            {/* 4.5 Creation as Practice */}
            <div className="mb-24">
                 <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-4 font-bold">Creation as Practice</span>
                 <p className="font-serif text-xl text-wood-800 leading-relaxed font-light">
                    Creating is how I grow. My inner journey. A celebration of creation itself. Through the process, I've learned to speak my truth. To come more and more clear. The more I create, the more authentic I become.
                 </p>
            </div>

            {/* 4.8 Close */}
            <div className="text-center pt-12 border-t border-wood-200">
                 <p className="font-serif text-lg text-wood-500 italic mb-6">
                    "The Writings hold more. The philosophy behind the work. The glowing crystal. The geometry. The path from formless to form."
                 </p>
            </div>

        </div>
    </section>
  );
};

export default About;
