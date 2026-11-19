import React, { useEffect, useState } from 'react';
import { useAccount } from '../../lib/account/useAccount';
import { C, F } from './tokens';

type Reflection = { id: string; body: string; createdAt: string };
type PrivateReflection = Reflection & {
  visibility: 'private' | 'offered' | 'public';
  yours: boolean;
  active: boolean;
  successorAccess: boolean;
  canPublish: boolean;
};
type Milestone = { id: string; place: string; country: string; grain: 'city' | 'region'; year: number; visibility?: 'private' | 'public'; yours?: boolean; successorAccess?: boolean };
type Place = { id: string; city: string; region: string | null; country: string };
type PublicRecord = { reflections: Reflection[]; milestones: Milestone[] };
type PrivateRecord = {
  role: 'keeper' | 'contributor' | null;
  reflections: PrivateReflection[];
  milestones: Milestone[];
};

const entryStyle: React.CSSProperties = { borderTop: `1px solid ${C.hairStrong}`, padding: '12px 0', overflowWrap: 'anywhere' };
const textStyle: React.CSSProperties = { color: C.ink, fontFamily: F.body, fontSize: 'var(--text-body)', lineHeight: 1.5 };
const fieldStyle: React.CSSProperties = {
  width: '100%', minHeight: 'var(--control-h)', padding: '8px 10px', background: C.ground, color: C.ink,
  border: `1px solid ${C.hairStrong}`, borderRadius: 'var(--radius-none)', font: 'inherit',
};
const actionStyle: React.CSSProperties = {
  color: C.ink, fontFamily: F.body, fontSize: 'var(--text-small)', minHeight: 'var(--control-h)', background: 'transparent',
  border: 0, padding: '0 8px', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer',
};
const formStyle: React.CSSProperties = { display: 'grid', gap: 12, padding: '12px 0' };

class RecordRequestError extends Error {}

async function recordRequest<T>(publicCode: string, query: Record<string, string>, init: RequestInit = {}): Promise<T> {
  const params = new URLSearchParams({ publicCode, ...query });
  const response = await fetch(`/api/collector/record?${params}`, { cache: 'no-store', ...init });
  const result = await response.json();
  if (!response.ok || result?.ok !== true) throw new RecordRequestError(result?.error);
  return result;
}

type Write = (
  input: Record<string, string | number | boolean>,
) => Promise<boolean>;

function SuccessorChoice({ id, kind, allowed, write, busy }: {
  id: string; kind: 'reflection' | 'milestone'; allowed: boolean; write: Write; busy: boolean;
}) {
  const [selected, setSelected] = useState(allowed);
  useEffect(() => setSelected(allowed), [allowed]);
  return <div style={{ marginTop: 'var(--space-2)' }}>
    <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', minHeight: 'var(--control-h)' }}>
      <input type="checkbox" checked={selected} disabled={busy} onChange={event => {
        const value = event.target.checked;
        setSelected(value);
        void write({ action: 'successor-access', id, kind, allow: value }).then(saved => {
          if (!saved) setSelected(allowed);
        });
      }} />
      Later caretakers may read this
    </label>
    <p>Only you can change this choice, including after passing the piece on. This does not allow public sharing.</p>
  </div>;
}

function PlaceForm({ publicCode, write, busy, onClose }: {
  publicCode: string; write: Write; busy: boolean; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [search, setSearch] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
  const [selectedId, setSelectedId] = useState('');
  const [grain, setGrain] = useState<'city' | 'region'>('city');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [id] = useState(() => crypto.randomUUID());
  const selected = places.find(place => place.id === selectedId);
  return (
    <div style={formStyle}>
      <h3>Add a place milestone</h3>
      <form style={formStyle} onSubmit={async event => {
        event.preventDefault();
        setSearch('loading');
        setSelectedId('');
        try {
          const result = await recordRequest<{ places: Place[] }>(publicCode, { view: 'places', q: query.trim() });
          setPlaces(result.places);
          setSearch('done');
        } catch {
          setPlaces([]);
          setSearch('failed');
        }
      }}>
        <label>Find a city or region
          <input style={fieldStyle} type="search" value={query} minLength={2} maxLength={60} required
            onChange={event => setQuery(event.target.value)} />
        </label>
        <p>Choose a city or region listed in the Atlas directory. Street addresses stay out of this record.</p>
        <button style={actionStyle} type="submit" disabled={search === 'loading' || busy}>Find places</button>
        {search === 'done' && places.length === 0 && <p role="status">No matching places in the directory.</p>}
        {search === 'failed' && <p role="alert">Places could not be checked. Try again.</p>}
      </form>
      {search === 'done' && places.length > 0 && (
        <form style={formStyle} onSubmit={async event => {
          event.preventDefault();
          if (await write({ action: 'milestone', id, placeId: selectedId, grain, year: Number(year), visibility })) onClose();
        }}>
          <div>
            <label htmlFor="record-milestone-place">Place</label>
            <select id="record-milestone-place" style={fieldStyle} value={selectedId} required onChange={event => {
              setSelectedId(event.target.value);
              setGrain('city');
            }}>
              <option value="">Choose a place</option>
              {places.map(place => <option key={place.id} value={place.id}>
                {[place.city, place.region, place.country].filter(Boolean).join(', ')}
              </option>)}
            </select>
          </div>
          {selected?.region && <div>
            <label htmlFor="record-milestone-grain">Show</label>
            <select id="record-milestone-grain" style={fieldStyle} value={grain} onChange={event => setGrain(event.target.value === 'region' ? 'region' : 'city')}>
              <option value="city">{selected.city}</option>
              <option value="region">{selected.region}</option>
            </select>
          </div>}
          <label>Year
            <input style={fieldStyle} type="number" min={1900} max={new Date().getFullYear()} value={year} required
              onChange={event => setYear(event.target.value)} />
          </label>
          <div>
            <label htmlFor="record-milestone-visibility">Visibility</label>
            <select id="record-milestone-visibility" style={fieldStyle} value={visibility}
              onChange={event => setVisibility(event.target.value === 'public' ? 'public' : 'private')}>
              <option value="private">Keep private</option>
              <option value="public">Share in its public history</option>
            </select>
          </div>
          {visibility === 'public' && <p>This place and year will stay in the public history.</p>}
          <button style={actionStyle} type="submit" disabled={busy || !selected}>Save milestone</button>
        </form>
      )}
      <button style={actionStyle} type="button" disabled={busy} onClick={onClose}>Back to milestones</button>
    </div>
  );
}

function ReflectionForm({ write, busy, onClose }: { write: Write; busy: boolean; onClose: () => void }) {
  const [body, setBody] = useState('');
  const [id] = useState(() => crypto.randomUUID());
  return (
    <form style={formStyle} onSubmit={async event => {
      event.preventDefault();
      if (await write({ action: 'reflect', id, body })) onClose();
    }}>
      <label>Your reflection
        <textarea style={fieldStyle} value={body} required maxLength={2000} rows={5}
          onChange={event => setBody(event.target.value)} />
      </label>
      <p>Only you can read it until you choose to share it.</p>
      <button style={actionStyle} type="submit" disabled={busy || !body.trim()}>Keep my reflection</button>
      <button style={actionStyle} type="button" disabled={busy} onClick={onClose}>Back to reflections</button>
    </form>
  );
}

const errorCopy: Record<string, string> = {
  adult_status_required: 'A birth date on your profile is needed for public sharing.',
  minor_publicity_forbidden: 'Public sharing is available when you are an adult.',
  user_not_synced: 'Your profile must be ready before you can share publicly.',
  record_permission_required: 'This action is no longer available to your account.',
};

function Entries({ publicCode, tab, signedIn }: {
  publicCode: string;
  tab: 'places' | 'writing';
  signedIn: boolean;
}) {
  const [published, setPublished] = useState<PublicRecord>();
  const [privately, setPrivately] = useState<PrivateRecord>();
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [exportRetry, setExportRetry] = useState<Record<string, string | number | boolean> | null>(null);
  const [editor, setEditor] = useState<'milestone' | 'reflection' | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void recordRequest<PublicRecord>(publicCode, { view: 'public' }, { signal })
      .then(result => { if (!signal.aborted) setPublished(result); })
      .catch(() => { if (!signal.aborted) setPublished(undefined); });
    if (signedIn) {
      void recordRequest<PrivateRecord>(publicCode, { view: 'private' }, { signal })
        .then(result => { if (!signal.aborted) setPrivately(result); })
        .catch(() => { if (!signal.aborted) setPrivately(undefined); });
    }
    return () => controller.abort();
  }, [publicCode, signedIn, revision]);

  const write: Write = async input => {
    setBusy(true);
    setMessage('');
    try {
      const result = await recordRequest<{ recordRefresh?: { status: string } }>(publicCode, {}, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      });
      setExportRetry(result.recordRefresh?.status === 'failed' || result.recordRefresh?.status === 'skipped' ? input : null);
      setPrivately(undefined);
      setRevision(value => value + 1);
      setConfirmation(null);
      return true;
    } catch (error) {
      const code = error instanceof RecordRequestError ? error.message : '';
      setMessage(Object.hasOwn(errorCopy, code)
        ? errorCopy[code]
        : 'The change could not be confirmed. Try again.');
      if (code === 'record_permission_required') {
        setPrivately(undefined);
        setEditor(null);
        setRevision(value => value + 1);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const places = [...published?.milestones ?? [], ...privately?.milestones ?? []]
    .sort((first, second) => first.year - second.year);
  const privateReflections = privately?.reflections.filter(reflection => reflection.visibility !== 'public') ?? [];
  const publicReflections = published?.reflections ?? [];
  const review = tab === 'writing' ? privateReflections.find(reflection => reflection.id === confirmation) : undefined;
  const closeEditor = () => { setEditor(null); setMessage(''); };
  if (tab === 'places' && editor !== 'milestone' && !places.length && privately?.role !== 'keeper') return null;
  if (tab === 'writing' && editor !== 'reflection' && !publicReflections.length && !privateReflections.length
    && privately?.role !== 'contributor') return null;
  if (review) {
    return (
      <section style={{ ...textStyle, ...formStyle }} aria-labelledby="reflection-sharing-title">
        <h3 id="reflection-sharing-title">{review.yours ? 'Offer for public sharing' : 'Review public sharing'}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{review.body}</p>
        <p>{review.yours
          ? 'The caretaker can read your reflection and choose to share the words without your name. Once public, the words stay with the piece.'
          : 'Share these words without the author’s name. Once public, the words stay with the piece.'}</p>
        {message && <p role="alert">{message}</p>}
        <button type="button" style={actionStyle} disabled={busy} onClick={() => void write({
          action: review.yours ? 'offer' : 'publish', id: review.id,
        })}>{review.yours ? 'Offer reflection' : 'Share this reflection'}</button>
        <button type="button" style={actionStyle} disabled={busy} onClick={() => {
          setConfirmation(null);
          setMessage('');
        }}>Back to reflections</button>
      </section>
    );
  }

  return (
    <section style={textStyle}>
      {message && <p role="alert">{message}</p>}
      {exportRetry && <div role="status" style={{ marginBlock: 'var(--space-3)' }}>
        <p>Your entry is saved. The downloadable Piece Record still needs to be refreshed.</p>
        <button type="button" style={actionStyle} disabled={busy} onClick={() => void write(exportRetry)}>Retry record export</button>
      </div>}
      {tab === 'places' && (editor === 'milestone'
        ? <PlaceForm publicCode={publicCode} write={write} busy={busy} onClose={closeEditor} />
        : <>
            {places.map(place => (
              <article key={place.id} style={entryStyle}>
                <p><strong>{place.year}</strong> · {place.place}, {place.country}</p>
                {place.yours && place.visibility === 'private' && <SuccessorChoice id={place.id} kind="milestone" allowed={Boolean(place.successorAccess)} write={write} busy={busy} />}
              </article>
            ))}
            {privately?.role === 'keeper' && (
              <button type="button" style={actionStyle} onClick={() => setEditor('milestone')}>Add a place milestone</button>
            )}
          </>)}
      {tab === 'writing' && (editor === 'reflection'
        ? <ReflectionForm write={write} busy={busy} onClose={closeEditor} />
        : <>
            {publicReflections.map(reflection => (
              <article key={reflection.id} style={entryStyle}>
                <h3>Reflection</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{reflection.body}</p>
              </article>
            ))}
            {privateReflections.map(reflection => (
              <article key={reflection.id} style={entryStyle}>
                <h3>{reflection.yours ? 'Your reflection' : reflection.canPublish ? 'Reflection offered for sharing' : 'Reflection shared with you'}</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{reflection.body}</p>
                {reflection.yours && <SuccessorChoice id={reflection.id} kind="reflection" allowed={Boolean(reflection.successorAccess)} write={write} busy={busy} />}
                {reflection.yours && reflection.visibility === 'private' && reflection.active && (
                  <button type="button" style={actionStyle} disabled={busy} onClick={() => setConfirmation(reflection.id)}>Offer to the caretaker</button>
                )}
                {reflection.yours && reflection.visibility === 'offered' && (
                  <button type="button" style={actionStyle} disabled={busy} onClick={() => void write({ action: 'withdraw', id: reflection.id })}>Withdraw offer</button>
                )}
                {!reflection.yours && reflection.canPublish && privately?.role === 'keeper' && (
                  <button type="button" style={actionStyle} disabled={busy} onClick={() => setConfirmation(reflection.id)}>Review public sharing</button>
                )}
              </article>
            ))}
            {privately?.role === 'contributor' && (
              <button style={actionStyle} type="button" onClick={() => setEditor('reflection')}>Write a reflection</button>
            )}
          </>)}
    </section>
  );
}

export const RecordEntries: React.FC<{ publicCode: string; tab: 'places' | 'writing' }> = props => {
  const account = useAccount();
  const userId = account.isLoaded && account.isSignedIn ? account.userId : null;
  return <Entries key={`${props.publicCode}:${userId ?? 'guest'}`} {...props} signedIn={Boolean(userId)} />;
};
