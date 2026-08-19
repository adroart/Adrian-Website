import { useEffect, useState } from 'react';
import {
  loadPublicCollectorDream,
  type CollectorDreamScope,
  type PublicCollectorDream,
} from '../../../utils/collectorDreams';

type PublicDreamStatus = 'loading' | 'ready' | 'error';

const scopeWords: Record<CollectorDreamScope, string> = {
  self: 'A dream for the self',
  family: 'A dream for family and loved ones',
  community: 'A dream for the community',
  planet: 'A dream for the planet',
};

export function PublicDreamView({
  status,
  dream,
  onRetry,
}: {
  status: PublicDreamStatus;
  dream: PublicCollectorDream | null;
  onRetry: () => void;
}) {
  if (status === 'loading') {
    return <p className="collector-copy" role="status">Opening the dream shared by this piece</p>;
  }
  if (status === 'error') {
    return (
      <section className="collector-screen" aria-labelledby="public-dream-error-title">
        <h3 id="public-dream-error-title" className="collector-title">The shared dream could not be opened</h3>
        <p className="collector-copy" role="alert">This part of the piece is unavailable right now.</p>
        <div className="collector-actions">
          <button type="button" className="collector-button-secondary" onClick={onRetry}>Try again</button>
        </div>
      </section>
    );
  }
  if (!dream) {
    return (
      <section className="collector-screen" aria-labelledby="public-dream-closed-title">
        <p className="collector-eyebrow">The dream held here</p>
        <h3 id="public-dream-closed-title" className="collector-title">Held close</h3>
        <p className="collector-copy">No dream has been opened publicly here.</p>
      </section>
    );
  }
  return (
    <section className="collector-screen" aria-labelledby="public-dream-title">
      <p className="collector-eyebrow">{scopeWords[dream.scope]}</p>
      <h3 id="public-dream-title" className="collector-title">A dream shared through this piece</h3>
      <blockquote className="collector-lede">{dream.body}</blockquote>
      <p className="collector-copy">
        {dream.visibility === 'anonymous'
          ? 'Shared without a name'
          : `Shared by ${dream.attribution}`}
      </p>
    </section>
  );
}

export default function PublicDream({ publicCode }: { publicCode: string }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: PublicDreamStatus;
    dream: PublicCollectorDream | null;
  }>({ status: 'loading', dream: null });

  useEffect(() => {
    let active = true;
    setState({ status: 'loading', dream: null });
    void loadPublicCollectorDream(publicCode)
      .then((dream) => {
        if (active) setState({ status: 'ready', dream });
      })
      .catch(() => {
        if (active) setState({ status: 'error', dream: null });
      });
    return () => { active = false; };
  }, [attempt, publicCode]);

  return (
    <PublicDreamView
      {...state}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
