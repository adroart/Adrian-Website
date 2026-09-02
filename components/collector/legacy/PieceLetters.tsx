import { useId } from 'react';

import type { CollectorLetter } from '../../../utils/collectorLetters';

export type PieceLettersProps = {
  status: 'loading' | 'ready' | 'error';
  letters: readonly CollectorLetter[];
  onRetry: () => void;
  error?: string | null;
  headingLevel?: 'h2' | 'h3' | 'h4';
};

const KIND_LABELS: Record<CollectorLetter['kind'], string> = {
  'kin-claim': 'Kinship',
  anniversary: 'Anniversary',
  transfer: 'Transfer',
};

const styles = `
  .piece-letters {
    width: 100%;
    max-width: 48rem;
    margin: 0 auto;
    color: #2f2922;
    font-family: var(--font-label);
  }
  .piece-letters, .piece-letters * { box-sizing: border-box; }
  .piece-letters__header { margin-bottom: 1.5rem; }
  .piece-letters__title {
    margin: 0;
    color: #261f19;
    font-family: "Cinzel", Georgia, serif;
    font-size: clamp(1.75rem, 5vw, 2.75rem);
    font-weight: 400;
    line-height: 1.15;
  }
  .piece-letters__intro,
  .piece-letters__state {
    color: #5d5145;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.125rem;
    line-height: 1.65;
  }
  .piece-letters__intro { margin: 0.65rem 0 0; }
  .piece-letters__state { padding: 1.25rem 0; }
  .piece-letters__state p { margin: 0; }
  .piece-letters__retry {
    min-height: 44px;
    margin-top: 1rem;
    border: 1px solid #8a6845;
    background: transparent;
    color: #3c2f24;
    padding: 0.65rem 1.1rem;
    font: inherit;
  }
  .piece-letters__retry:focus-visible {
    outline: 2px solid #8a6845;
    outline-offset: 3px;
  }
  .piece-letters__list { display: grid; gap: 1rem; margin: 0; padding: 0; list-style: none; }
  .piece-letters__letter {
    border: 1px solid rgba(83, 61, 40, 0.24);
    background: rgba(246, 239, 227, 0.72);
    padding: clamp(1.1rem, 4vw, 1.75rem);
  }
  .piece-letters__meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.4rem 1rem;
    margin: 0 0 0.8rem;
    color: #725a42;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    line-height: 1.45;
    text-transform: uppercase;
  }
  .piece-letters__body {
    margin: 0;
    color: #342a21;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: 1.15rem;
    line-height: 1.7;
  }
`;

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

export default function PieceLetters({
  status,
  letters,
  onRetry,
  error,
  headingLevel = 'h4',
}: PieceLettersProps) {
  const componentId = useId();
  const titleId = `${componentId}-piece-letters-title`;
  const Heading = headingLevel;

  return (
    <section className="piece-letters" aria-labelledby={titleId} aria-busy={status === 'loading'}>
      <style>{styles}</style>
      <header className="piece-letters__header">
        <Heading id={titleId} className="piece-letters__title">Letters from this piece</Heading>
        <p className="piece-letters__intro">
          These messages remain with the artwork as its keeping continues.
        </p>
      </header>
      {status === 'loading' && (
        <div className="piece-letters__state" role="status" aria-live="polite">
          <p>Gathering letters.</p>
        </div>
      )}
      {status === 'error' && (
        <div className="piece-letters__state" role="alert" aria-live="assertive">
          <p>{error || 'Letters could not be reached.'}</p>
          <button type="button" className="piece-letters__retry" onClick={onRetry}>Try again</button>
        </div>
      )}
      {status === 'ready' && letters.length === 0 && (
        <div className="piece-letters__state" role="status">
          <p>No letters have arrived yet.</p>
        </div>
      )}
      {status === 'ready' && letters.length > 0 && (
        <ol className="piece-letters__list" aria-label="Letters in this artwork's record">
          {letters.map((letter) => (
            <li key={letter.id}>
              <article className="piece-letters__letter">
                <p className="piece-letters__meta">
                  <span>{KIND_LABELS[letter.kind]}</span>
                  <time dateTime={letter.createdAt}>{formattedDate(letter.createdAt)}</time>
                </p>
                <p className="piece-letters__body">{letter.body}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
