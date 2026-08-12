import { useEffect, useRef, useState } from 'react';
import {
  completeYearlyRitual,
  loadYearlyRitual,
  type CollectorDreamScope,
  type YearlyRitualAction,
  type YearlyRitualEligibility,
} from '../../utils/collectorDreams';

type ScreenStatus = 'loading' | 'ready' | 'error';

const ritualChoices: Array<{ value: YearlyRitualAction; label: string; help: string }> = [
  { value: 'reinforce', label: 'Reinforce this dream', help: 'Carry these same words into another year.' },
  { value: 'plant-new', label: 'Plant a new dream', help: 'Honor this chapter and begin another.' },
  { value: 'fulfilled', label: 'Mark this dream fulfilled', help: 'Let the record remember that this came true.' },
];

const newDreamScopes: Array<{ value: CollectorDreamScope; label: string }> = [
  { value: 'self', label: 'Yourself' },
  { value: 'family', label: 'Family and loved ones' },
  { value: 'community', label: 'Your community' },
  { value: 'planet', label: 'The planet' },
];

function newKey() {
  return `dream-ritual-${crypto.randomUUID()}`;
}

function ineligibleMessage(reason: YearlyRitualEligibility['reason']) {
  if (reason === 'birth_profile_missing') {
    return 'Birth details are needed to place the yearly return near your birthday. You can add them later without making them public.';
  }
  if (reason === 'birth_profile_invalid') {
    return 'Birth details need to be corrected before the yearly return can be placed.';
  }
  if (reason === 'current_dream_missing') return 'Place a dream in the piece before beginning the yearly return.';
  if (reason === 'already_completed') return 'This birthday year is complete. The piece will hold your choice until the next return.';
  return 'The yearly return rests until the month around your birthday.';
}

export function YearlyRitualView({
  status,
  eligibility,
  selectedAction,
  error,
  onSelectAction,
  onComplete,
  onRetry,
}: {
  status: ScreenStatus;
  eligibility: YearlyRitualEligibility | null;
  selectedAction: YearlyRitualAction;
  error?: string;
  onSelectAction: (action: YearlyRitualAction) => void;
  onComplete: (input: {
    action: YearlyRitualAction;
    body?: string;
    scope?: CollectorDreamScope;
  }) => Promise<void> | void;
  onRetry: () => void;
}) {
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<CollectorDreamScope>('self');
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (status === 'loading') {
    return <p className="collector-copy" role="status">Opening this year&apos;s return</p>;
  }
  if (status === 'error' || !eligibility) {
    return (
      <section className="collector-screen" aria-labelledby="collector-ritual-error-title">
        <h3 id="collector-ritual-error-title" className="collector-title">The yearly return is resting</h3>
        <p className="collector-copy" role="alert">{error ?? 'The yearly return could not be opened.'}</p>
        <div className="collector-actions">
          <button type="button" className="collector-button-secondary" onClick={onRetry}>Try again</button>
        </div>
      </section>
    );
  }
  if (!eligibility.eligible) {
    return (
      <section className="collector-screen" aria-labelledby="collector-ritual-title">
        <p className="collector-eyebrow">The yearly return</p>
        <h3 id="collector-ritual-title" className="collector-title">A quiet annual moment</h3>
        <p className="collector-copy">{ineligibleMessage(eligibility.reason)}</p>
      </section>
    );
  }

  return (
    <section className="collector-screen" aria-labelledby="collector-ritual-title">
      <p className="collector-eyebrow">The yearly return</p>
      <h3 id="collector-ritual-title" className="collector-title">What should this piece carry forward?</h3>
      <blockquote className="collector-lede">{eligibility.currentDream?.body}</blockquote>
      <form
        className="mt-8 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setActionError(null);
          void Promise.resolve(onComplete({
            action: selectedAction,
            ...(selectedAction === 'plant-new' ? { body, scope } : {}),
          })).catch((caught) => {
            setActionError(caught instanceof Error ? caught.message : 'The yearly choice could not be saved.');
          }).finally(() => setPending(false));
        }}
      >
        <fieldset className="space-y-4">
          <legend className="collector-copy">Choose one way to return</legend>
          {ritualChoices.map((choice) => (
            <label key={choice.value} className="flex items-start gap-3 font-body text-base text-wood-800">
              <input
                type="radio"
                name="ritualAction"
                value={choice.value}
                checked={selectedAction === choice.value}
                disabled={pending}
                onChange={() => onSelectAction(choice.value)}
              />
              <span>
                <strong>{choice.label}</strong>
                <span className="mt-1 block font-body text-base text-wood-600">{choice.help}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {selectedAction === 'plant-new' && (
          <div className="space-y-5 border-t border-wood-200 pt-6">
            <label className="collector-copy" htmlFor="collector-new-dream">The new dream</label>
            <textarea
              id="collector-new-dream"
              name="newDream"
              rows={5}
              maxLength={4000}
              required
              value={body}
              disabled={pending}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-32 w-full border border-wood-300 bg-paper-50 p-3 font-body text-base text-wood-900"
            />
            <fieldset className="space-y-4">
              <legend className="collector-copy">Who is the new dream for?</legend>
              {newDreamScopes.map((choice) => (
                <label key={choice.value} className="flex items-start gap-3 font-body text-base text-wood-800">
                  <input
                    type="radio"
                    name="newDreamScope"
                    value={choice.value}
                    checked={scope === choice.value}
                    disabled={pending}
                    onChange={() => setScope(choice.value)}
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
          </div>
        )}

        {actionError && <p className="collector-copy" role="alert">{actionError}</p>}
        <div className="collector-actions">
          <button
            type="submit"
            className="collector-button-primary"
            disabled={pending || (selectedAction === 'plant-new' && !body.trim())}
          >
            Complete this year&apos;s return
          </button>
        </div>
      </form>
    </section>
  );
}

export default function YearlyRitualScreen({ keeperPieceId }: { keeperPieceId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [selectedAction, setSelectedAction] = useState<YearlyRitualAction>('reinforce');
  const [screen, setScreen] = useState<{
    status: ScreenStatus;
    eligibility: YearlyRitualEligibility | null;
    error?: string;
  }>({ status: 'loading', eligibility: null });
  const activePiece = useRef(keeperPieceId);
  activePiece.current = keeperPieceId;

  useEffect(() => {
    let current = true;
    setScreen({ status: 'loading', eligibility: null });
    void loadYearlyRitual(keeperPieceId)
      .then((eligibility) => {
        if (current) setScreen({ status: 'ready', eligibility });
      })
      .catch(() => {
        if (current) setScreen({
          status: 'error', eligibility: null,
          error: 'The yearly return could not be opened.',
        });
      });
    return () => { current = false; };
  }, [attempt, keeperPieceId]);

  return (
    <YearlyRitualView
      {...screen}
      selectedAction={selectedAction}
      onSelectAction={setSelectedAction}
      onRetry={() => setAttempt((value) => value + 1)}
      onComplete={async ({ action, body, scope }) => {
        const result = await completeYearlyRitual({
          keeperPieceId, action, body, scope, idempotencyKey: newKey(),
        });
        if (result.ritual.keeperPieceId === activePiece.current) {
          setScreen({ status: 'ready', eligibility: result.eligibility });
        }
      }}
    />
  );
}
