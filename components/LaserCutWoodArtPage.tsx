import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import GalleryTileCard from './GalleryTileCard';
import Breadcrumb from './Breadcrumb';
import { img } from '../utils/cloudinary';
import { isLaserCutWoodArtwork } from '../utils/artworkFilters';
import { useMetaTags } from '../hooks/useMetaTags';

function safeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

const LaserCutWoodArtPage: React.FC = () => {
  const pieces = useMemo(
    () => FULL_ARCHIVE.filter(isLaserCutWoodArtwork),
    [],
  );

  const availablePieces = useMemo(
    () => pieces.filter(piece => piece.availability !== 'SOLD'),
    [pieces],
  );

  const schema = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Laser-Cut Wood Art by Adrian Rasmussen',
    description:
      'Layered laser-cut wood art by Adrian Rasmussen, including sacred geometry, mandalas, light codes, and multi-dimensional wooden sculptures made in Bali.',
    url: 'https://adrianrasmussen.com/creations/laser-cut-wood-art',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: pieces.length,
      itemListElement: pieces.slice(0, 64).map((piece, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `https://adrianrasmussen.com/creations/${piece.id}`,
        name: piece.title,
      })),
    },
    creator: {
      '@type': 'Person',
      name: 'Adrian Rasmussen',
      url: 'https://adrianrasmussen.com/about',
    },
  }), [pieces]);

  useMetaTags({
    title: 'Laser-Cut Wood Art',
    description:
      'Layered laser-cut wood art by Adrian Rasmussen, including sacred geometry, mandalas, light codes, and multi-dimensional wooden sculptures made in Bali.',
    image:
      'https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/Mandala-1_tyujra',
  });

  return (
    <section className="bg-paper-50 min-h-screen pt-24 pb-32 animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
      />

      <div className="w-full h-[36vh] min-h-[300px] max-h-[520px] overflow-hidden relative">
        <img
          src={img('Mandala-1_tyujra', { w: 1400, h: 788 })}
          srcSet={[640, 960, 1200, 1600].map(w => `${img('Mandala-1_tyujra', { w, h: Math.round(w * 9 / 16) })} ${w}w`).join(', ')}
          sizes="100vw"
          alt="Layered laser-cut wood mandala artwork by Adrian Rasmussen."
          className="w-full h-full object-cover"
          decoding="async"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-paper-50 to-transparent" />
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-10 pt-12 pb-14">
        <Breadcrumb
          crumbs={[
            { label: 'Creations', to: '/creations' },
            { label: 'Laser-Cut Wood Art' },
          ]}
          className="mb-8"
        />

        <div className="max-w-4xl">
          <h1 className="font-serif text-5xl md:text-7xl text-wood-900 mb-6 font-medium">
            Laser-Cut Wood Art
          </h1>
          <p className="font-serif text-xl md:text-2xl text-wood-600 font-light leading-[1.65] max-w-3xl">
            Adrian Rasmussen creates layered laser-cut wood art as physical sacred geometry. The work begins with precise digital forms, then becomes hand-finished sculpture through paint, stacking, crystal, light, and surface.
          </p>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-10 pb-16">
        <div className="grid md:grid-cols-[1.3fr_0.7fr] gap-10 md:gap-16 border-y border-wood-200 py-12">
          <div className="max-w-3xl">
            <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-5">
              Layered Wood, Cut With Precision, Finished By Hand
            </h2>
            <div className="space-y-5 font-sans text-base md:text-lg text-wood-650 leading-[1.8]">
              <p>
                This page gathers Adrian&apos;s work where laser-cut wood is central to the form. Some pieces are mandalas, some are light codes, some are multi-dimensional wooden sculptures from Universal Language, and some are singular works outside any series.
              </p>
              <p>
                The search phrase is broad, but the artwork is specific: original laser-cut wood art for collectors who want depth, symmetry, sacred geometry, and the evidence of a human hand.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 content-start">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold mb-2">Pieces</p>
              <p className="font-serif text-4xl text-wood-900">{pieces.length}</p>
            </div>
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold mb-2">Available</p>
              <p className="font-serif text-4xl text-wood-900">{availablePieces.length}</p>
            </div>
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold mb-2">Materials</p>
              <p className="font-serif text-2xl text-wood-900">Wood, paint, crystal, light</p>
            </div>
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 font-semibold mb-2">Studio</p>
              <p className="font-serif text-2xl text-wood-900">Bali</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-10 pb-16">
        <div className="grid md:grid-cols-3 gap-8 border-b border-wood-200 pb-12">
          <div>
            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-700 font-semibold mb-4">
              Mandala Work
            </h3>
            <p className="font-sans text-wood-650 leading-[1.75] mb-5">
              Original sacred geometry mandalas in layered laser-cut wood, built for stillness, center, and contemplative space.
            </p>
            <Link
              to="/creations/multidimensional-art/mandala"
              className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
            >
              View mandalas
            </Link>
          </div>

          <div>
            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-700 font-semibold mb-4">
              Universal Language
            </h3>
            <p className="font-sans text-wood-650 leading-[1.75] mb-5">
              A complete series of sixty-four multi-dimensional wooden sculptures connected to a symbolic cycle of change.
            </p>
            <Link
              to="/creations/multidimensional-art/universal-language"
              className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
            >
              View the series
            </Link>
          </div>

          <div>
            <h3 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-700 font-semibold mb-4">
              Commissions
            </h3>
            <p className="font-sans text-wood-650 leading-[1.75] mb-5">
              Commission inquiries can begin with an existing piece, a symbolic direction, a desired scale, or a space that needs a specific presence.
            </p>
            <Link
              to="/inquire"
              className="font-label text-xs uppercase tracking-[0.2em] text-wood-900 hover:text-bronze-600 font-semibold border-b border-wood-900 hover:border-bronze-600 pb-1 transition-colors"
            >
              Begin an inquiry
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-6 md:px-10">
        <div className="flex items-end justify-between gap-6 mb-10">
          <div>
            <p className="font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold mb-3">
              Selected Works
            </p>
            <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium">
              Layered Laser-Cut Wood Pieces
            </h2>
          </div>
          <p className="hidden md:block font-label text-xs uppercase tracking-[0.2em] text-wood-500 font-semibold tabular-nums">
            {pieces.length} pieces
          </p>
        </div>

        <div className="columns-2 md:columns-4 gap-3 sm:gap-5 md:gap-3 lg:gap-5 xl:gap-8 card-stagger">
          {pieces.map(piece => (
            <GalleryTileCard
              key={piece.id}
              art={piece}
              showDetails
              subtitleOverride={piece.series || piece.category}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default LaserCutWoodArtPage;
