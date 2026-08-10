import { useEffect, useRef, useState } from 'react';
import {
  addCollectorDreamMarker,
  createCollectorDream,
  loadCollectorDream,
  setCollectorDreamSharing,
  updateCollectorDream,
  type CollectorDreamMarkerKind,
  type CollectorDreamScope,
  type CollectorDreamState,
  type CollectorDreamVisibility,
} from '../../utils/collectorDreams';

type ScreenStatus = 'loading' | 'ready' | 'error';

const scopeChoices: Array<{ value: CollectorDreamScope; label: string; help: string }> = [
  { value: 'self', label: 'Yourself', help: 'A dream for your own life and becoming.' },
  { value: 'family', label: 'Family and loved ones', help: 'A dream for the people held close to you.' },
  { value: 'community', label: 'Your community', help: 'A dream for the place and people around you.' },
  { value: 'planet', label: 'The planet', help: 'A dream for the wider living world.' },
];

const markerChoices: Array<{ value: CollectorDreamMarkerKind; label: string }> = [
  { value: 'milestone', label: 'A milestone' },
  { value: 'change', label: 'A change' },
  { value: 'encounter', label: 'An encounter' },
  { value: 'fulfillment', label: 'A moment of fulfillment' },
];

function newKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function DreamScreenView({
  status,
  state,
  error,
  onRetry,
  onSave,
  onShare,
  onMarker,
  onComplete,
}: {
  status: ScreenStatus;
  state: CollectorDreamState | null;
  error?: string;
  onRetry: () => void;
  onSave: (input: { body: string; scope: CollectorDreamScope }) => Promise<void> | void;
  onShare: (visibility: CollectorDreamVisibility) => Promise<void> | void;
  onMarker: (input: { kind: CollectorDreamMarkerKind; body: string }) => Promise<void> | void;
  onComplete?: () => void;
}) {
  const [body, setBody] = useState(state?.current?.body ?? '');
  const [scope, setScope] = useState<CollectorDreamScope>(state?.current?.scope ?? 'self');
  const [markerKind, setMarkerKind] = useState<CollectorDreamMarkerKind>('milestone');
  const [markerBody, setMarkerBody] = useState('');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBody(state?.current?.body ?? '');
    setScope(state?.current?.scope ?? 'self');
  }, [state?.current?.body, state?.current?.id, state?.current?.scope]);

  const perform = async (action: () => Promise<void> | void) => {
    setPending(true);
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'The change could not be saved.');
    } finally {
      setPending(false);
    }
  };

  if (status === 'loading') {
    return <p className="collector-copy" role="status">Opening the dream held by this piece</p>;
  }
  if (status === 'error' || !state) {
    return (
      <section className="collector-screen" aria-labelledby="collector-dream-error-title">
        <h3 id="collector-dream-error-title" className="collector-title">The dream is resting</h3>
        <p className="collector-copy" role="alert">{error ?? 'Your dream could not be opened.'}</p>
        <div className="collector-actions">
          <button type="button" className="collector-button-secondary" onClick={onRetry}>Try again</button>
        </div>
      </section>
    );
  }

  const current = state.current;
  const isShared = Boolean(current?.sharedAt && !current.revokedAt);

  return (
    <section className="collector-screen" aria-labelledby="collector-dream-title">
      <p className="collector-eyebrow">The dream held here</p>
      <h3 id="collector-dream-title" className="collector-title">
        {current ? 'Tend this dream' : 'Give this piece a dream'}
      </h3>
      <p className="collector-copy">
        {current
          ? 'Nothing is owed. Return only when life gives you something true to add.'
          : 'This piece can hold one dream. A sentence is enough, and it can remain private.'}
      </p>

      <form
        className="mt-8 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void perform(() => onSave({ body, scope }));
        }}
      >
        <label className="collector-copy" htmlFor="collector-dream-body">Your dream</label>
        <textarea
          id="collector-dream-body"
          name="dream"
          rows={5}
          maxLength={4000}
          required
          value={body}
          disabled={pending}
          onChange={(event) => setBody(event.target.value)}
          className="min-h-32 w-full border border-wood-300 bg-paper-50 p-3 font-body text-base text-wood-900"
        />
        <fieldset className="space-y-4">
          <legend className="collector-copy">Who is this dream for?</legend>
          {scopeChoices.map((choice) => (
            <label key={choice.value} className="flex items-start gap-3 font-body text-base text-wood-800">
              <input
                type="radio"
                name="dreamScope"
                value={choice.value}
                checked={scope === choice.value}
                disabled={pending}
                onChange={() => setScope(choice.value)}
              />
              <span>
                <strong>{choice.label}</strong>
                <span className="mt-1 block font-body text-base text-wood-600">{choice.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="collector-actions">
          <button type="submit" className="collector-button-primary" disabled={pending || !body.trim()}>
            {current ? 'Save the dream' : 'Place the dream'}
          </button>
        </div>
      </form>

      {current && (
        <div className="mt-10 space-y-4 border-t border-wood-200 pt-8">
          <h4 className="font-title text-2xl text-wood-900">Public sharing</h4>
          <p className="collector-copy">
            This dream is private unless you choose to share it. Sharing takes effect immediately and can be withdrawn.
          </p>
          <div className="collector-actions">
            {isShared ? (
              <button
                type="button"
                className="collector-button-secondary"
                disabled={pending}
                onClick={() => void perform(() => onShare('private'))}
              >
                Stop sharing
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="collector-button-secondary"
                  disabled={pending}
                  onClick={() => void perform(() => onShare('anonymous'))}
                >
                  Share without my name
                </button>
                <button
                  type="button"
                  className="collector-button-secondary"
                  disabled={pending}
                  onClick={() => void perform(() => onShare('attributed'))}
                >
                  Share with my name
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {current && (
        <div className="mt-10 space-y-5 border-t border-wood-200 pt-8">
          <h4 className="font-title text-2xl text-wood-900">The living thread</h4>
          <p className="collector-copy">Add a marker only when something real happened. A quiet dream is complete as it is.</p>
          {state.markers.length > 0 && (
            <ol className="space-y-4">
              {state.markers.map((marker) => (
                <li key={marker.id} className="collector-copy">
                  <strong>{markerChoices.find((choice) => choice.value === marker.kind)?.label}</strong>
                  <p>{marker.body}</p>
                </li>
              ))}
            </ol>
          )}
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                await onMarker({ kind: markerKind, body: markerBody });
                setMarkerBody('');
              });
            }}
          >
            <label className="collector-copy" htmlFor="collector-marker-kind">What happened</label>
            <select
              id="collector-marker-kind"
              name="markerKind"
              value={markerKind}
              disabled={pending}
              onChange={(event) => setMarkerKind(event.target.value as CollectorDreamMarkerKind)}
              className="w-full border border-wood-300 bg-paper-50 p-3 font-body text-base text-wood-900"
            >
              {markerChoices.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
            <label className="collector-copy" htmlFor="collector-marker-body">The true event</label>
            <textarea
              id="collector-marker-body"
              name="marker"
              rows={3}
              maxLength={2000}
              required
              value={markerBody}
              disabled={pending}
              onChange={(event) => setMarkerBody(event.target.value)}
              className="min-h-24 w-full border border-wood-300 bg-paper-50 p-3 font-body text-base text-wood-900"
            />
            <div className="collector-actions">
              <button type="submit" className="collector-button-secondary" disabled={pending || !markerBody.trim()}>
                Add this marker
              </button>
            </div>
          </form>
        </div>
      )}

      {actionError && <p className="collector-copy" role="alert">{actionError}</p>}
      {onComplete && current && (
        <div className="collector-actions">
          <button type="button" className="collector-button-primary" onClick={onComplete}>Continue</button>
        </div>
      )}
    </section>
  );
}

export default function DreamScreen({
  keeperPieceId,
  onComplete,
}: {
  keeperPieceId: string;
  onComplete?: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<{
    status: ScreenStatus;
    state: CollectorDreamState | null;
    error?: string;
  }>({ status: 'loading', state: null });
  const activePiece = useRef(keeperPieceId);
  activePiece.current = keeperPieceId;

  useEffect(() => {
    let current = true;
    setScreen({ status: 'loading', state: null });
    void loadCollectorDream(keeperPieceId)
      .then((state) => { if (current) setScreen({ status: 'ready', state }); })
      .catch(() => {
        if (current) setScreen({
          status: 'error', state: null, error: 'Your dream could not be opened.',
        });
      });
    return () => { current = false; };
  }, [attempt, keeperPieceId]);

  const accept = (state: CollectorDreamState) => {
    if (state.keeperPieceId === activePiece.current) setScreen({ status: 'ready', state });
  };
  return (
    <DreamScreenView
      {...screen}
      onRetry={() => setAttempt((value) => value + 1)}
      onComplete={onComplete}
      onSave={async ({ body, scope }) => {
        const current = screen.state?.current;
        accept(current
          ? await updateCollectorDream({
            keeperPieceId, body, scope, expectedVersion: current.version,
            idempotencyKey: newKey('dream-edit'),
          })
          : await createCollectorDream({
            keeperPieceId, body, scope, idempotencyKey: newKey('dream-create'),
          }));
      }}
      onShare={async (visibility) => {
        accept(await setCollectorDreamSharing({
          keeperPieceId,
          visibility,
          idempotencyKey: newKey(
            visibility === 'private' ? 'dream-revoke' : 'dream-share',
          ),
        }));
      }}
      onMarker={async ({ kind, body }) => {
        accept(await addCollectorDreamMarker({
          keeperPieceId, kind, body, idempotencyKey: newKey('dream-marker'),
        }));
      }}
    />
  );
}
