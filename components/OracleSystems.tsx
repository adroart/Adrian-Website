import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'iching',
    label: 'I Ching',
    subtitle: 'The Book of Changes',
    intro:
      'The oldest of the three, refined over more than three thousand years. Sixty-four hexagrams, each a configuration of heaven and earth, naming a pattern in the present moment.',
  },
  {
    id: 'genekeys',
    label: 'Gene Keys',
    subtitle: 'A contemplative path',
    intro:
      'A modern synthesis. Each of the sixty-four keys names a Shadow you move through, a Gift that opens, and a Siddhi held at the highest expression. Less a tool for divination than a practice of attention.',
  },
  {
    id: 'humandesign',
    label: 'Human Design',
    subtitle: 'A map of energy',
    intro:
      'A schematic of how energy moves through a body. Each of the sixty-four gates carries a quality. Channels show how those qualities connect, circuits show the larger pattern they belong to.',
  },
] as const;

const OracleSystems: React.FC = () => {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    const id = hash.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      window.requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [hash]);

  return (
    <article className="bg-paper-50 text-wood-900 min-h-screen">
      <div className="max-w-2xl mx-auto px-5 sm:px-7 pt-24 sm:pt-32 pb-20 sm:pb-28">
        <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-600 mb-6">
          The Three Systems
        </p>
        <h1 className="font-serif text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.01em] text-wood-900 mb-6 sm:mb-8">
          A lineage of changes
        </h1>
        <p className="font-serif text-[18px] sm:text-[20px] text-wood-700 leading-[1.55] sm:leading-[1.5] max-w-prose">
          The Universal Language reads through three lenses, three vocabularies for the same shape of energy. The I Ching arrives from ancient China. The Gene Keys and Human Design arrive in the last century, descendants and elaborations. None of this is mine. The cards are an offering of gratitude.
        </p>

        <p className="font-sans text-[14px] italic text-wood-500 leading-[1.6] mt-8 max-w-prose">
          {/* DRAFT — prose to be refined by Adrian */}
          The text below is a working draft. The histories, the names, the lineages each deserve more care than a placeholder can give. Read it as a sketch.
        </p>

        <nav className="mt-12 sm:mt-14 flex flex-wrap gap-x-6 gap-y-2 border-y border-wood-200 py-5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="font-label text-[11px] uppercase tracking-[0.28em] text-wood-600 hover:text-bronze-700 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>

        {/* ── I Ching ───────────────────────────────────────────────────── */}
        <section id="iching" className="pt-16 sm:pt-20 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-4">
            One · I Ching
          </p>
          <h2 className="font-serif text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-wood-900">
            The Book of Changes
          </h2>
          <p className="font-serif text-[15px] text-wood-500 italic mt-2">
            attributed to Fu Xi, King Wen, the Duke of Zhou, and Confucius
          </p>

          <div className="space-y-5 mt-8 font-sans text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              The I Ching is the oldest text in active spiritual use anywhere in the world. Its earliest layers are attributed to the legendary Fu Xi, who is said to have observed the markings on a tortoise shell rising from the Yellow River and seen, in those eight three-line figures, the structure of the cosmos. Whether or not that origin is literal, the symbols themselves came to encode a way of reading change as it moves through any moment.
            </p>
            <p>
              King Wen of Zhou ordered the sixty-four hexagrams and assigned each its name. His son, the Duke of Zhou, wrote the line statements. Confucius and his school added the Ten Wings, commentaries that turned the oracle into a philosophical text. Across two thousand years more, scholars and mystics returned to those sixty-four images, finding in them whatever the moment required.
            </p>
            <p>
              The system reaches the West late. James Legge translates it in 1882. But the translation that opens the I Ching to the modern imagination is Richard Wilhelm's, completed in German in 1924 after twenty years in China studying with the scholar Lao Nai-hsuan. Cary F. Baynes carries it into English in 1950, with a foreword by Carl Jung that frames the book as a study of synchronicity. Almost every Western reader who has touched the I Ching since has touched it through their hands.
            </p>
            <p className="text-wood-500 italic text-[15px]">
              {/* DRAFT */}
              [More on the structure: trigrams as elemental forces, hexagrams as their combinations, the role of the moving line, the practice of casting with yarrow stalks or coins. To be expanded.]
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-wood-200">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
              In gratitude to
            </p>
            <p className="font-serif text-[18px] text-wood-900">
              Richard Wilhelm and Cary F. Baynes
            </p>
            <p className="font-serif text-[15px] text-wood-600 leading-[1.6] mt-1.5 max-w-prose">
              Whose translation, with Jung's foreword, is the lineage every English reader of the I Ching is standing inside of.
            </p>
          </div>
        </section>

        {/* ── Gene Keys ─────────────────────────────────────────────────── */}
        <section id="genekeys" className="pt-20 sm:pt-24 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-4">
            Two · Gene Keys
          </p>
          <h2 className="font-serif text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-wood-900">
            The contemplative path
          </h2>
          <p className="font-serif text-[15px] text-wood-500 italic mt-2">
            transmitted by Richard Rudd, 2002 onward
          </p>

          <div className="space-y-5 mt-8 font-sans text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              The Gene Keys are the youngest of the three systems. Richard Rudd received the transmission over a long, contemplative period beginning in the early 2000s, after years of training in Human Design and a lifetime of reading the I Ching. The work is published as a book in 2013.
            </p>
            <p>
              Where the I Ching reads the moment and Human Design reads the body, the Gene Keys read a person across a lifetime. Each of the sixty-four keys names three frequencies of the same archetype: the Shadow, a habitual pattern under stress; the Gift, what opens when the Shadow is met with awareness; and the Siddhi, the highest expression, often glimpsed before it is lived. The system is offered not as something to know but as something to contemplate, slowly, until it begins to read you back.
            </p>
            <p>
              The sixty-four Gene Keys correspond directly to the sixty-four hexagrams of the I Ching and to the sixty-four codons of human DNA. This correspondence is not Rudd's invention. It is named in Martin Schönberger's 1973 work, in the writings of Terence McKenna, and most fully developed inside Human Design. Rudd's contribution is the Shadow-Gift-Siddhi spectrum, and the practice of holding all three frequencies as one continuous teaching.
            </p>
            <p className="text-wood-500 italic text-[15px]">
              {/* DRAFT */}
              [More on the Golden Path, the Activation Sequence, the Venus Sequence, the Pearl Sequence, and the way Rudd intends the work to be lived rather than studied. To be expanded.]
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-wood-200">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
              In gratitude to
            </p>
            <p className="font-serif text-[18px] text-wood-900">
              Richard Rudd
            </p>
            <p className="font-serif text-[15px] text-wood-600 leading-[1.6] mt-1.5 max-w-prose">
              Whose synthesis offers the I Ching, Human Design, and the wisdom traditions back to a contemporary reader as a contemplative life.
            </p>
            <p className="font-serif text-[14px] text-wood-500 mt-3">
              <a
                href="https://genekeys.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-wood-300 underline-offset-[3px] hover:text-bronze-700 hover:decoration-bronze-500 transition-colors"
              >
                genekeys.com
              </a>
            </p>
          </div>
        </section>

        {/* ── Human Design ──────────────────────────────────────────────── */}
        <section id="humandesign" className="pt-20 sm:pt-24 scroll-mt-20">
          <p className="font-label text-[10px] uppercase tracking-[0.3em] text-bronze-600 mb-4">
            Three · Human Design
          </p>
          <h2 className="font-serif text-[28px] sm:text-[34px] leading-[1.1] tracking-[-0.005em] text-wood-900">
            A map of energy
          </h2>
          <p className="font-serif text-[15px] text-wood-500 italic mt-2">
            received by Ra Uru Hu, Ibiza, January 1987
          </p>

          <div className="space-y-5 mt-8 font-sans text-[16px] sm:text-[17px] text-wood-800 leading-[1.7]">
            <p>
              Human Design enters the world through Alan Robert Krakower, who later took the name Ra Uru Hu. In January of 1987, on the island of Ibiza, he reports an eight-day-and-night encounter with a voice he calls the Voice. What he transcribes during that period becomes the system: a synthesis of the I Ching, Western astrology, the Hindu chakra system, the Kabbalistic Tree of Life, and the science of the neutrino, woven into a single chart called the bodygraph.
            </p>
            <p>
              The bodygraph names which centres in a person are defined and which are open. It locates sixty-four gates against the calendar of the sun and the moment of birth. It tells the reader their Type, their Strategy, their Authority — practical instruction for how to make decisions in alignment with their design rather than against it.
            </p>
            <p>
              Ra spent the rest of his life teaching the system, often in long, recorded lectures. He died in 2011. His teachings have since been carried forward by his students through the International Human Design School and the many independent teachers and analysts working today.
            </p>
            <p className="text-wood-500 italic text-[15px]">
              {/* DRAFT */}
              [More on the four Types — Manifestor, Generator, Projector, Reflector — the nine centres, the meaning of definition versus openness, and how to read a chart. To be expanded.]
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-wood-200">
            <p className="font-label text-[10px] uppercase tracking-[0.28em] text-bronze-600 mb-3">
              In gratitude to
            </p>
            <p className="font-serif text-[18px] text-wood-900">
              Ra Uru Hu
            </p>
            <p className="font-serif text-[15px] text-wood-600 leading-[1.6] mt-1.5 max-w-prose">
              Whose transmission gave the West a map of energetic design and a vocabulary for living in alignment with one's own nature.
            </p>
          </div>
        </section>

        {/* ── Closing ───────────────────────────────────────────────────── */}
        <section className="pt-20 sm:pt-24 mt-20 border-t border-wood-200">
          <p className="font-serif text-[17px] sm:text-[18px] text-wood-700 leading-[1.7] max-w-prose">
            The Universal Language Oracle does not improve on these systems. It carries them, sixty-four cards holding the same sixty-four images that have travelled three thousand years through three traditions. Whatever clarity the cards offer belongs to the lineages that arrived first.
          </p>

          <Link
            to="/oracle/universal-language"
            className="inline-block mt-10 font-label text-[11px] uppercase tracking-[0.32em] text-bronze-700 hover:text-bronze-900 transition-colors"
          >
            Return to the Oracle <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </article>
  );
};

export default OracleSystems;
