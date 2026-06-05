/**
 * OracleGateway — a directory of the oracles Adrian has made.
 *
 * The oracle decks themselves live on their own domains now (Universal
 * Language at mandalacodes.com). This page is a quiet hub that names each
 * oracle and points outward. New oracles slot into the ORACLES array.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { useMetaTags } from '../hooks/useMetaTags';

interface OracleEntry {
  /** Short display name. */
  name: string;
  /** One-line description. */
  blurb: string;
  /** External URL the oracle lives at. */
  href: string;
  /** Friendly label for the link (shown small under the name). */
  hrefLabel: string;
}

const ORACLES: OracleEntry[] = [
  {
    name: 'Universal Language',
    blurb:
      'A 64-card oracle deck drawn from the I Ching, the Gene Keys, and Human Design. Each card carries a single multi-dimensional wooden sculpture and the three readings together.',
    href: 'https://mandalacodes.com/oracle/universal-language',
    hrefLabel: 'mandalacodes.com',
  },
];

const OracleGateway: React.FC = () => {
  useMetaTags({
    title: 'The Oracles | Adrian Rasmussen',
    description:
      'A directory of the oracle decks and reading tools Adrian has made. Each lives at its own home; this page points the way.',
  });

  return (
    <article className="bg-paper-50 text-wood-900 min-h-screen">
      <div className="max-w-2xl mx-auto px-5 sm:px-7 pt-24 sm:pt-32 pb-20 sm:pb-28">
        <p className="font-label text-[11px] uppercase tracking-[0.32em] text-bronze-600 mb-6">
          The Oracles
        </p>
        <h1 className="font-serif text-[34px] sm:text-[44px] leading-[1.05] tracking-[-0.01em] text-wood-900 mb-6 sm:mb-8">
          The oracles I have made
        </h1>
        <p className="font-serif text-[18px] sm:text-[20px] text-wood-700 leading-[1.55] sm:leading-[1.5] max-w-prose">
          Each oracle is a separate piece of work and lives at its own home.
          This page is a directory, a way in for anyone arriving here looking
          for the reading itself.
        </p>

        <ul className="mt-14 sm:mt-16 space-y-12 sm:space-y-14">
          {ORACLES.map((oracle) => (
            <li
              key={oracle.name}
              className="border-t border-wood-200 pt-7 sm:pt-8"
            >
              <h2 className="font-serif text-[24px] sm:text-[28px] leading-[1.15] tracking-[-0.005em] text-wood-900">
                {oracle.name}
              </h2>
              <p className="font-sans text-[16px] sm:text-[17px] text-wood-700 leading-[1.7] mt-3 max-w-prose">
                {oracle.blurb}
              </p>
              <a
                href={oracle.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-5 font-label text-[11px] uppercase tracking-[0.32em] text-bronze-700 hover:text-bronze-900 transition-colors pb-1 border-b border-bronze-500/40 hover:border-bronze-700"
              >
                Open at {oracle.hrefLabel}{' '}
                <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>

        <p className="font-sans text-[14px] italic text-wood-500 leading-[1.6] mt-20 max-w-prose">
          More oracles will arrive here as they are finished. If you have a
          reading you would like Adrian to make, the inquiry is{' '}
          <Link
            to="/inquire"
            className="underline decoration-wood-300 underline-offset-[3px] hover:text-bronze-700 hover:decoration-bronze-500 transition-colors"
          >
            on the inquire page
          </Link>
          .
        </p>
      </div>
    </article>
  );
};

export default OracleGateway;
