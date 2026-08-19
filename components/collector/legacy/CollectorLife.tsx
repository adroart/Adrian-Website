import { useEffect, useState } from 'react';

import { fetchCollectorLetters, type CollectorLetter } from '../../utils/collectorLetters';
import DreamScreen from './DreamScreen';
import PieceLetters from './PieceLetters';
import YearlyRitualScreen from './YearlyRitualScreen';

type LifeView = 'dream' | 'ritual' | 'letters';

function CollectorLetters({ keeperPieceId }: { keeperPieceId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: 'loading' | 'ready' | 'error';
    letters: CollectorLetter[];
  }>({ status: 'loading', letters: [] });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', letters: [] });
    void fetchCollectorLetters(keeperPieceId)
      .then((letters) => {
        if (active) setState({ status: 'ready', letters });
      })
      .catch(() => {
        if (active) setState({ status: 'error', letters: [] });
      });
    return () => { active = false; };
  }, [attempt, keeperPieceId]);

  return (
    <PieceLetters
      {...state}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}

export default function CollectorLife({ keeperPieceId }: { keeperPieceId: string }) {
  const [view, setView] = useState<LifeView>('dream');

  return (
    <section className="mt-16 border-t border-wood-200 pt-10" aria-labelledby="collector-life-title">
      <p className="collector-eyebrow">Private to the current steward</p>
      <h3 id="collector-life-title" className="collector-title">What this piece carries with you</h3>
      <div className="collector-actions" aria-label="Choose a private collector practice">
        <button
          type="button"
          className={view === 'dream' ? 'collector-button-primary' : 'collector-button-secondary'}
          aria-pressed={view === 'dream'}
          onClick={() => setView('dream')}
        >
          Dream
        </button>
        <button
          type="button"
          className={view === 'ritual' ? 'collector-button-primary' : 'collector-button-secondary'}
          aria-pressed={view === 'ritual'}
          onClick={() => setView('ritual')}
        >
          Yearly return
        </button>
        <button
          type="button"
          className={view === 'letters' ? 'collector-button-primary' : 'collector-button-secondary'}
          aria-pressed={view === 'letters'}
          onClick={() => setView('letters')}
        >
          Letters
        </button>
      </div>
      <div className="mt-10">
        {view === 'dream' && <DreamScreen keeperPieceId={keeperPieceId} />}
        {view === 'ritual' && <YearlyRitualScreen keeperPieceId={keeperPieceId} />}
        {view === 'letters' && <CollectorLetters keeperPieceId={keeperPieceId} />}
      </div>
    </section>
  );
}
