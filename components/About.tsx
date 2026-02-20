
import React from 'react';
import { Link } from 'react-router-dom';

const PERSON_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Adrian Rasmussen',
  url: 'https://adrianrasmussen.com',
  jobTitle: 'Multidimensional Artist',
  description: 'Technician of the Sacred. Multidimensional artist working between studios in Bali and Santa Cruz, California.',
  sameAs: ['https://www.instagram.com/adrianrasmussen'],
  knowsAbout: ['Sculpture', 'Installation Art', 'Laser Cutting', 'Projection Mapping', 'Tea Ceremony'],
  workLocation: [
    { '@type': 'Place', name: 'Bali, Indonesia' },
    { '@type': 'Place', name: 'Santa Cruz, California' },
  ],
};

const About: React.FC = () => {
  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON_SCHEMA) }}
        />
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
                    <img src="https://picsum.photos/800/1200?random=about1" className="w-full h-full object-cover grayscale opacity-90" alt="Adrian Portrait" loading="lazy" />
                </div>
            </div>

            {/* 4.3 The Path */}
            <div className="mb-24">
                 <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-4 font-bold">The Path</span>
                 <div className="prose prose-xl font-serif text-wood-800 max-w-2xl">
                     <p>
                        Tea came early. My father introduced it when I was young. In 2009, I began exploring Asia. China, Japan, Thailand, Taiwan, Bali. Learning the ways of different cultures. Qigong, Tai Chi, meditation, tea ceremony. Since 2010, I've been trading artwork for Chinese tea. Two practices that had always been connected. This practice now lives at{' '}
                        <a href="https://teajia.com" target="_blank" rel="noopener noreferrer" className="text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors">Teajia</a>, where I share twenty years of tea culture.
                     </p>
                     <p>
                        Along the way, I found new tools. Laser cutting, LEDs, airbrushing, projection mapping. The forms evolved. The intention stayed the same. Bringing the formless into form.
                     </p>
                     <p>
                        Since 2020, I've been developing an artist residency, Makerspace, and gallery with Labyrinth Bali in the Nuanu Project.
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
                 <div className="prose prose-xl font-serif text-wood-800 max-w-2xl font-light">
                    <p>
                        Creating is how I grow. My inner journey. A celebration of creation itself.
                    </p>
                    <p>
                        Through the process, I've learned to speak my truth. To come more and more clear. The more I create, the more authentic I become. And by expressing what is true for me, perhaps others feel permission to do the same.
                    </p>
                 </div>
            </div>

            {/* 4.6 The Team */}
            <div className="mb-24">
                 <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-4 font-bold">The Team</span>
                 <div className="prose prose-xl font-serif text-wood-800 max-w-2xl font-light">
                    <p>
                        I don't work alone. Many have walked this path with me. Learning, discovering, creating. We work hand in hand to bring these arts into form and share them with the planet.
                    </p>
                    <p>
                        A family from different origins. One mother. Earth.
                    </p>
                 </div>
            </div>

            {/* 4.7 What Art Can Mean */}
            <div className="bg-wood-50 p-8 md:p-12 mb-24 border border-wood-200">
                 <span className="font-mono text-xs text-bronze-600 uppercase tracking-widest block mb-6 font-bold">What Art Can Mean</span>
                 <div className="prose prose-lg font-serif text-wood-700 max-w-3xl">
                    <p>
                        A young man was gazing into one of my projection-mapped pieces at a festival. He sat there a long time. When he finally stood, he told me what had happened.
                    </p>
                    <p>
                        He had been carrying suicidal feelings. An unclarity about why life was worth living. But sitting in the presence of the piece, something shifted. It allowed him to go inward and discover his own truth. To release the perception that he needed to end his life. He tapped into something that had always been there inside himself. The art was a gateway. Through it, he felt connected to who he was again.
                    </p>
                    <p>
                        He did the work. The piece just held the space.
                    </p>
                 </div>
            </div>

            {/* 4.8 Close */}
            <div className="text-center pt-12 border-t border-wood-200">
                 <p className="font-serif text-lg text-wood-500 italic mb-6">
                    The Writings hold more. The philosophy behind the work. The glowing crystal. The geometry. The path from formless to form.
                 </p>
                 <Link
                    to="/writings"
                    className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-wood-900 hover:text-bronze-600 font-bold border-b border-wood-900 pb-1"
                 >
                    Go deeper
                 </Link>
            </div>

        </div>
    </section>
  );
};

export default About;
