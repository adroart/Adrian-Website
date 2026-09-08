import React, { useEffect, useState } from 'react';

import { fetchCollectorField, type CollectorFieldState } from '../utils/collectorField';

/** A piece counts as "at rest" once it is registered to a keeper, whether or
 *  not that keeper has shared a city. That is the same rule the field's own
 *  brightness uses: `identity.status !== 'unregistered'`. */
function countPiecesAtRest(state: CollectorFieldState): number {
  let count = 0;
  for (const artwork of state.lights) {
    for (const identity of artwork.identity) {
      if (identity.status !== 'unregistered') count += 1;
    }
  }
  return count;
}

function restingLine(count: number): string {
  if (count === 0) return 'No piece has come to rest yet.';
  if (count === 1) return 'One piece has come to rest.';
  return `${count} pieces have come to rest.`;
}

/** The atlas record lives on mandalacodes.com; the globe stays there. This
 *  page is the quiet local mention: what the atlas is, and a link across.
 *  The count below reads the same public ledger the mandalacodes proxy
 *  consumes (GET /api/atlas, this site's own database). When that ledger
 *  can't be reached, the line is left off rather than shown broken. */
const AtlasPage: React.FC = () => {
  const [restingCount, setRestingCount] = useState<number | null>(null);

  useEffect(() => {
    let current = true;
    fetchCollectorField()
      .then((state) => {
        if (current) setRestingCount(countPiecesAtRest(state));
      })
      .catch(() => {
        // Decoration, not the point of the page. Say nothing rather than
        // show a broken count.
      });
    return () => {
      current = false;
    };
  }, []);

  return (
    <section className="bg-paper-50 min-h-screen pt-32 pb-32 px-6">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="font-serif text-5xl text-wood-900 mb-8 font-medium">Atlas</h1>

        <p className="font-serif text-xl text-wood-700 leading-[1.7] font-light max-w-[62ch]">
          Every piece that leaves the studio can come to rest on a shared map, marked by the place it now calls home.
        </p>

        {restingCount !== null && (
          <p className="font-serif text-base text-wood-500 mt-6">
            {restingLine(restingCount)}
          </p>
        )}

        <div className="mt-12">
          <a
            href="https://mandalacodes.com/atlas"
            className="font-serif text-lg text-bronze-600 underline underline-offset-4 decoration-1 hover:text-bronze-800 transition-colors"
          >
            See the atlas
          </a>
        </div>
      </div>
    </section>
  );
};

export default AtlasPage;
