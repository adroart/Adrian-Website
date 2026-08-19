import { useEffect, useState } from 'react';

import {
  fetchCollectorField,
  type CollectorFieldState,
} from '../../utils/collectorField';
import FieldExperience from './FieldExperience';

type FieldPageState = {
  status: 'loading' | 'ready' | 'error';
  data: CollectorFieldState | null;
  error?: string;
};

export function CollectorFieldPageView({
  status,
  data,
  error,
  onRetry,
}: FieldPageState & { onRetry: () => void }) {
  return (
    <div
      className="min-h-screen bg-[#0f0d0b] px-3 pb-20 pt-24 sm:px-6 lg:px-10"
      data-testid="collector-field-page"
    >
      <div className="mx-auto max-w-7xl">
        <FieldExperience
          status={status}
          data={data}
          error={error}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}

export default function CollectorFieldPage() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<FieldPageState>({
    status: 'loading',
    data: null,
  });

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', data: null });
    void fetchCollectorField()
      .then((data) => {
        if (current) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (current) {
          setState({
            status: 'error',
            data: null,
            error: 'The field could not be reached.',
          });
        }
      });
    return () => { current = false; };
  }, [attempt]);

  return (
    <CollectorFieldPageView
      {...state}
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
