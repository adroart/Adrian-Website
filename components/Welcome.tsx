
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const Welcome: React.FC = () => {
  return (
    <section className="min-h-screen bg-stone-950 flex flex-col items-center justify-center px-6 py-16 dark-preserve">
      <div className="max-w-sm w-full text-center">
        {/* Name */}
        <h1 className="font-serif text-3xl text-paper-50 mb-2 tracking-tight font-medium">
          Adrian Rasmussen
        </h1>
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-500 mb-12 font-semibold">
          Technician of the Sacred
        </p>

        {/* Links */}
        <div className="flex flex-col gap-3 mb-16">
          <Link
            to="/creations"
            className="w-full py-4 border border-stone-700 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-paper-50 hover:text-stone-950 transition-colors"
          >
            Creations
          </Link>
          <Link
            to="/shop"
            className="w-full py-4 border border-stone-700 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-paper-50 hover:text-stone-950 transition-colors"
          >
            Shop
          </Link>
          <Link
            to="/inquire"
            className="w-full py-4 border border-stone-700 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-paper-50 hover:text-stone-950 transition-colors"
          >
            Commission a Piece
          </Link>
          <Link
            to="/writings"
            className="w-full py-4 border border-stone-700 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-paper-50 hover:text-stone-950 transition-colors"
          >
            Writings
          </Link>
          <a
            href="https://teajia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 border border-stone-700 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold hover:bg-paper-50 hover:text-stone-950 transition-colors flex items-center justify-center gap-2"
          >
            Teajia <ArrowUpRight size={12} />
          </a>
        </div>

        {/* Full site link */}
        <Link
          to="/"
          className="font-label text-[11px] uppercase tracking-[0.2em] text-stone-600 hover:text-paper-50 transition-colors font-semibold border-b border-stone-700 pb-1"
        >
          Enter Full Site
        </Link>
      </div>
    </section>
  );
};

export default Welcome;
