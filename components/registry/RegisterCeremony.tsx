/**
 * The register-an-artwork ceremony at /admin/register.
 *
 * One fast pass, paced like the collector walk: one question per screen, a
 * quiet ground, brass on the one thing you can act on. It replaces the old
 * inline registration form and calls the unified endpoint
 * POST /api/admin/register-artwork, which registers the permanent identity,
 * snapshots the catalog metadata, and writes the first Piece Record in one
 * idempotent operation. A physical plate stays optional and later.
 *
 * The verified-sale branch survives from the old form: arriving with
 * ?artworkId=&artistArtworkRecordId= (optionally &saleId=) verifies, locks
 * the work and edition, and after registering links the identity to the
 * sales record with the same retry state.
 *
 * While the registry unlock is open the ceremony heartbeats the sliding
 * refresh every five minutes; if the unlock lapses or hits its absolute cap
 * the ceremony re-prompts for the secret with every typed value preserved.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CeremonyStyles } from '../ceremony/styles';
import {
  Body,
  Brass,
  C,
  CodeBlock,
  Capsule,
  ChoiceRow,
  Eyebrow,
  Field,
  Foot,
  Ground,
  Head,
  Ledger,
  Note,
  Row,
  RoomBody,
  RoomHead,
  SecretField,
  Spacer,
  TLink,
} from './kit';
import {
  ARTWORK_ID_INPUT_PATTERN,
  ChoosableArtwork,
  filterArtworks,
  loadChoosableArtworks,
  suggestNextArtworkId,
  takenArtworkIds,
} from './artworkChoices';
import { useRegistryUnlock } from './useRegistryUnlock';
import { titleFor } from '../../utils/adminPieces';
import { loadArtworkWorkspace } from '../../utils/artworkWorkspace';
import {
  beginArtistSaleAttempt,
  finishArtistSaleAttempt,
  parseArtistSaleDetailResponse,
  parseArtistSaleMutationResponse,
  type FrozenArtistSaleAttempt,
  type LinkArtistSaleIdentityRequest,
} from '../../utils/artistSales';

type Step = 'threshold' | 'work' | 'newwork' | 'edition' | 'unlock' | 'confirm' | 'done';

type Selection = {
  mode: 'catalog' | 'new';
  id: string;
  title: string;
  series: string | null;
  editionKind: 'unique' | 'numbered' | 'unspecified';
  editionSize: number | null;
};

type EditionForm = { kind: 'unique' | 'numbered'; number: string; size: string };

type Result = {
  artworkId: string;
  title: string;
  series: string | null;
  editionLabel: string;
  publicCode: string;
  keeperPieceId: string;
  ownershipCode?: string;
  record: { status: 'generated' | 'deferred'; reason?: string };
};

type LinkedStatus = 'generic' | 'loading' | 'ready' | 'error';

const DEFAULT_EDITION: EditionForm = { kind: 'unique', number: '1', size: '' };

function editionLabelFor(edition: EditionForm): string {
  if (edition.kind === 'unique') return 'Unique work';
  const size = edition.size.trim();
  return size ? `Number ${edition.number} of ${size}` : `Number ${edition.number}`;
}

const REGISTER_ERRORS: Record<string, string> = {
  artwork_id_taken: 'That catalog number is already taken in the registry.',
  reserved_artwork_id: 'Numbers beginning with AR are reserved for public codes. Choose another prefix.',
  edition_conflict: 'The edition does not match what the registry already holds for this work.',
  edition_size_below_issued: 'The edition size is smaller than a number already issued for this work.',
  edition_metadata_required: 'The edition could not be fixed for this work. Choose it again.',
  edition_size_required: 'A numbered edition of a new work needs its edition size.',
};

const RegisterCeremony: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registrationQuery = searchParams.toString();

  /* ── the verified-sale branch: parse and verify the linked selector ── */
  const linkedParams = new URLSearchParams(registrationQuery);
  const linkedArtworkIds = linkedParams.getAll('artworkId');
  const linkedRecordIds = linkedParams.getAll('artistArtworkRecordId');
  const linkedSaleIds = linkedParams.getAll('saleId');
  const linkedKeys = [...linkedParams.keys()].sort().join('\0');
  const linkedArtworkId = linkedArtworkIds.length === 1 ? linkedArtworkIds[0] : '';
  const linkedRecordId = linkedRecordIds.length === 1 ? linkedRecordIds[0] : '';
  const linkedSaleId = linkedSaleIds.length === 1 ? linkedSaleIds[0] : '';
  const hasLinkedSelector = linkedParams.has('artworkId')
    || linkedParams.has('artistArtworkRecordId') || linkedParams.has('saleId');
  const hasExactLinkedSelector = Boolean(linkedArtworkId && linkedRecordId
    && (linkedKeys === 'artistArtworkRecordId\0artworkId'
      || (linkedKeys === 'artistArtworkRecordId\0artworkId\0saleId' && linkedSaleId)));

  const [step, setStep] = useState<Step>('threshold');
  const stepRef = useRef<Step>('threshold');
  stepRef.current = step;
  const [relock, setRelock] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [edition, setEdition] = useState<EditionForm>(DEFAULT_EDITION);
  const [newWork, setNewWork] = useState({ title: '', id: '', series: '' });
  const [search, setSearch] = useState('');
  const [artworks, setArtworks] = useState<ChoosableArtwork[]>([]);
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const attemptKey = useRef<string | null>(null);

  const [linkedStatus, setLinkedStatus] = useState<LinkedStatus>(
    hasExactLinkedSelector ? 'loading' : hasLinkedSelector ? 'error' : 'generic',
  );
  const [linkedTarget, setLinkedTarget] = useState<{
    saleId: string;
    artworkRecordId: string;
    expectedVersion: number;
  } | null>(null);
  const [relationshipLinked, setRelationshipLinked] = useState(false);
  const [linkPending, setLinkPending] = useState(false);
  const linkAttemptRef = useRef<FrozenArtistSaleAttempt<LinkArtistSaleIdentityRequest> | null>(null);

  const unlockLost = () => {
    // Losing the unlock never loses typed state. Mid ceremony the unlock
    // screen re-prompts in place; after registration nothing needs it, and
    // earlier steps meet the unlock screen at its usual place anyway.
    if (stepRef.current === 'confirm') {
      setRelock(true);
      setStep('unlock');
    }
  };
  const { state: unlockState, unlock } = useRegistryUnlock(unlockLost);

  useEffect(() => {
    let cancelled = false;
    void loadChoosableArtworks().then(list => {
      if (!cancelled) setArtworks(list);
    });
    return () => { cancelled = true; };
  }, []);

  /* An already-open unlock never asks again: if the opening check resolves
     while the unlock screen is up, the ceremony walks on by itself. */
  useEffect(() => {
    if (step === 'unlock' && !relock && unlockState === 'unlocked') setStep('confirm');
  }, [step, relock, unlockState]);

  /* verify the linked sales record exactly as the old form did */
  useEffect(() => {
    setResult(null);
    setLinkedTarget(null);
    setRelationshipLinked(false);
    setLinkPending(false);
    linkAttemptRef.current = null;
    attemptKey.current = null;
    if (!hasExactLinkedSelector) {
      setLinkedStatus(hasLinkedSelector ? 'error' : 'generic');
      return;
    }
    const controller = new AbortController();
    setLinkedStatus('loading');
    void loadArtworkWorkspace({
      artworkId: linkedArtworkId,
      artistArtworkRecordId: linkedRecordId,
    }, controller.signal).then(async workspace => {
      if (controller.signal.aborted) return;
      const saleId = workspace.sale?.verifiedSaleId;
      if (workspace.catalog?.artworkId !== linkedArtworkId
        || workspace.salesRecord?.artworkRecordId !== linkedRecordId
        || workspace.salesRecord.state !== 'identified'
        || workspace.identity !== null || !saleId
        || (linkedSaleId && linkedSaleId !== saleId)) {
        throw new Error('registration_target_mismatch');
      }
      const response = await fetch(`/api/admin/collector-sales/${encodeURIComponent(saleId)}`, {
        cache: 'no-store', signal: controller.signal,
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) throw new Error('registration_target_unavailable');
      const detail = parseArtistSaleDetailResponse(value);
      const item = detail.items.find(candidate => candidate.artworkRecordId === linkedRecordId);
      if (!item || item.artworkId !== linkedArtworkId || item.identificationStatus !== 'identified'
        || !item.edition || item.keeperPieceId !== null) {
        throw new Error('registration_target_mismatch');
      }
      setSelection({
        mode: 'catalog',
        id: linkedArtworkId,
        title: titleFor(linkedArtworkId),
        series: null,
        editionKind: item.edition.kind,
        editionSize: item.edition.kind === 'numbered' ? item.edition.size ?? null : null,
      });
      setEdition({
        kind: item.edition.kind,
        number: item.edition.kind === 'numbered' ? String(item.edition.number) : '1',
        size: item.edition.kind === 'numbered' && item.edition.size
          ? String(item.edition.size) : '',
      });
      setLinkedTarget({ saleId, artworkRecordId: linkedRecordId, expectedVersion: item.recordVersion });
      setLinkedStatus('ready');
    }).catch((caught: unknown) => {
      if (controller.signal.aborted
        || (caught instanceof DOMException && caught.name === 'AbortError')) return;
      setLinkedStatus('error');
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationQuery]);

  const linkedMode = linkedStatus !== 'generic';

  /* ── actions ─────────────────────────────────────────────────────── */

  const begin = () => {
    setError('');
    if (linkedStatus === 'loading' || linkedStatus === 'error') return;
    if (linkedStatus === 'ready') {
      setStep(unlockState === 'unlocked' ? 'confirm' : 'unlock');
      return;
    }
    setStep('work');
  };

  const pickWork = (artwork: ChoosableArtwork) => {
    if (artwork.editionKind === 'conflict') return;
    setSelection({
      mode: 'catalog',
      id: artwork.id,
      title: artwork.title,
      series: artwork.series,
      editionKind: artwork.editionKind,
      editionSize: artwork.editionSize,
    });
    setEdition(artwork.editionKind === 'numbered'
      ? { kind: 'numbered', number: '1', size: artwork.editionSize ? String(artwork.editionSize) : '' }
      : DEFAULT_EDITION);
    attemptKey.current = null;
    setError('');
    setStep('edition');
  };

  const takenIds = useMemo(() => takenArtworkIds(artworks), [artworks]);
  const idSuggestion = suggestNextArtworkId(takenIds, newWork.id);

  const continueNewWork = () => {
    const id = newWork.id.trim().toUpperCase();
    const title = newWork.title.trim();
    if (!title) { setError('The work needs its title.'); return; }
    if (!ARTWORK_ID_INPUT_PATTERN.test(id)) {
      setError('The catalog number is two or three letters, a dash, and three digits, like SIG-104.');
      return;
    }
    if (id.startsWith('AR-')) {
      setError('Numbers beginning with AR are reserved for public codes. Choose another prefix.');
      return;
    }
    if (takenIds.has(id)) {
      setError('That catalog number is already taken.');
      return;
    }
    setSelection({
      mode: 'new',
      id,
      title,
      series: newWork.series.trim() || null,
      editionKind: 'unspecified',
      editionSize: null,
    });
    setEdition(DEFAULT_EDITION);
    attemptKey.current = null;
    setError('');
    setStep('edition');
  };

  const continueEdition = () => {
    if (!selection) return;
    if (edition.kind === 'numbered') {
      const number = Number(edition.number);
      if (!Number.isInteger(number) || number < 1) {
        setError('The edition number starts at 1.');
        return;
      }
      const sizeNeeded = selection.editionKind !== 'numbered';
      const size = edition.size.trim() ? Number(edition.size) : null;
      if (sizeNeeded && size === null) {
        setError('The edition size fixes the edition. It is needed for this work.');
        return;
      }
      if (size !== null && (!Number.isInteger(size) || size < number)) {
        setError('The edition size is a whole number, at least the edition number.');
        return;
      }
    }
    setError('');
    setStep(unlockState === 'unlocked' ? 'confirm' : 'unlock');
  };

  const submitSecret = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const opened = await unlock(secret);
    setBusy(false);
    if (!opened) {
      setError('The registry did not open. Check the secret and try again.');
      return;
    }
    setSecret('');
    setRelock(false);
    setStep('confirm');
  };

  const completeLinkedRegistration = async (keeperPieceId: string): Promise<boolean> => {
    if (!linkedTarget) return true;
    const attempt = beginArtistSaleAttempt(linkAttemptRef.current, {
      action: 'linkIdentity',
      artworkRecordId: linkedTarget.artworkRecordId,
      keeperPieceId,
      expectedVersion: linkedTarget.expectedVersion,
    });
    linkAttemptRef.current = attempt;
    setLinkPending(true);
    try {
      const response = await fetch(`/api/admin/collector-sales/${encodeURIComponent(linkedTarget.saleId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.request),
      });
      const value = await response.json().catch(() => null);
      if (!response.ok) {
        linkAttemptRef.current = finishArtistSaleAttempt(attempt, { kind: 'http', status: response.status });
        throw Object.assign(new Error('identity_link_failed'), { status: response.status });
      }
      const mutation = parseArtistSaleMutationResponse(value).result;
      if (!('identificationStatus' in mutation)
        || mutation.artworkRecordId !== linkedTarget.artworkRecordId
        || mutation.keeperPieceId !== keeperPieceId
        || mutation.identificationStatus !== 'identity_linked') {
        throw new Error('identity_link_mismatch');
      }
      const completed = await loadArtworkWorkspace({
        artworkId: linkedArtworkId,
        keeperPieceId,
        artistArtworkRecordId: linkedRecordId,
      });
      if (completed.salesRecord?.state !== 'identity_linked'
        || completed.salesRecord.artworkRecordId !== linkedRecordId
        || completed.identity?.keeperPieceId !== keeperPieceId
        || completed.nextAction?.href.includes('/admin/registrations')) {
        throw new Error('identity_link_incomplete');
      }
      linkAttemptRef.current = finishArtistSaleAttempt(attempt, { kind: 'success' });
      setRelationshipLinked(true);
      setError('');
      return true;
    } catch (caught) {
      if (!(caught && typeof caught === 'object' && 'status' in caught)) {
        linkAttemptRef.current = attempt;
      }
      setError('The identity was registered, but its exact sales relationship is not yet confirmed. Retry the same identity link before leaving.');
      return false;
    } finally {
      setLinkPending(false);
    }
  };

  const register = async () => {
    if (busy || !selection) return;
    setBusy(true);
    setError('');
    try {
      if (hasLinkedSelector && linkedStatus !== 'ready') throw new Error('registration_target_unverified');
      attemptKey.current ||= crypto.randomUUID();
      const editionPayload = edition.kind === 'unique'
        ? { kind: 'unique' as const }
        : {
            kind: 'numbered' as const,
            number: Number(edition.number),
            size: edition.size.trim() ? Number(edition.size) : null,
          };
      const body = selection.mode === 'new'
        ? {
            newArtwork: {
              id: selection.id,
              title: selection.title,
              ...(selection.series ? { series: selection.series } : {}),
            },
            edition: editionPayload,
            idempotencyKey: attemptKey.current,
          }
        : {
            artworkId: selection.id,
            edition: editionPayload,
            idempotencyKey: attemptKey.current,
          };
      const response = await fetch('/api/admin/register-artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data?.error === 'string' ? data.error : '';
        if (['registry_locked', 'registry_unlock_required', 'unlock_absolute_cap'].includes(code)) {
          setRelock(true);
          setStep('unlock');
          return;
        }
        setError(REGISTER_ERRORS[code]
          || 'This artwork could not be registered. The same attempt can be retried safely.');
        return;
      }
      setResult({
        artworkId: selection.id,
        title: data.artwork?.title || selection.title,
        series: data.artwork?.series ?? selection.series,
        editionLabel: editionLabelFor(edition),
        publicCode: data.publicCode,
        keeperPieceId: data.keeperPieceId,
        ownershipCode: typeof data.ownershipCode === 'string' ? data.ownershipCode : undefined,
        record: data.record?.status === 'generated'
          ? { status: 'generated' }
          : { status: 'deferred', reason: data.record?.reason },
      });
      attemptKey.current = null;
      setStep('done');
      await completeLinkedRegistration(data.keeperPieceId);
    } catch {
      setError('This artwork could not be registered. The same attempt can be retried safely.');
    } finally {
      setBusy(false);
    }
  };

  const copyOwnershipCode = async () => {
    if (!result?.ownershipCode) return;
    try {
      await navigator.clipboard.writeText(result.ownershipCode);
      setResult({ ...result, ownershipCode: undefined });
    } catch {
      setError('The Ownership Code could not be copied. Copy it by hand, then dismiss it before leaving this screen.');
    }
  };

  const startOver = () => {
    setSelection(null);
    setEdition(DEFAULT_EDITION);
    setNewWork({ title: '', id: '', series: '' });
    setSearch('');
    setResult(null);
    setError('');
    attemptKey.current = null;
    setStep('threshold');
  };

  /* ── the screens ─────────────────────────────────────────────────── */

  const wrongNote = error ? (
    <p
      role="alert"
      style={{
        margin: '14px 0 0',
        fontFamily: "'Lora', Georgia, serif",
        fontSize: 12.5,
        lineHeight: 1.66,
        color: C.wrong,
      }}
    >
      {error}
    </p>
  ) : null;

  let screen: React.ReactNode = null;

  if (step === 'threshold') {
    screen = (
      <Ground light="a" wash>
        <Eyebrow>The registry</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head>Register an artwork.</Head>
        </div>
        <Body top={18}>
          Registration gives one work its permanent digital identity: a public code the
          world can see, and an Ownership Code held by whoever keeps it.
        </Body>
        <Note top={14}>
          A physical plate is optional and can come later. Everything else can be added
          after.
        </Note>
        {linkedStatus === 'loading' && (
          <Note top={14}>Verifying the linked sales record.</Note>
        )}
        {linkedStatus === 'ready' && (
          <Note top={14}>
            Sales record {linkedRecordId} · {linkedArtworkId}. The work and edition are
            set by the verified sale.
          </Note>
        )}
        {linkedStatus === 'error' && (
          <>
            {!error && (
              <p
                role="alert"
                style={{
                  margin: '14px 0 0',
                  fontFamily: "'Lora', Georgia, serif",
                  fontSize: 12.5,
                  lineHeight: 1.66,
                  color: C.wrong,
                }}
              >
                The linked catalog artwork and sales record could not be verified.
                Registration is unavailable from this link.
              </p>
            )}
            <div style={{ position: 'relative', paddingTop: 20 }}>
              <Row label="Open verified sales" onClick={() => navigate('/admin/collector-sales')} last />
            </div>
          </>
        )}
        <Spacer />
        {linkedStatus !== 'error' && (
          <Foot>
            <Brass lifted onClick={begin}>Begin</Brass>
          </Foot>
        )}
      </Ground>
    );
  }

  if (step === 'work') {
    const list = filterArtworks(artworks, search);
    screen = (
      <Ground light="b" pad="40px 30px 24px">
        <RoomHead title="Choose the work" onBack={() => setStep('threshold')} />
        <div style={{ position: 'relative', paddingTop: 18 }}>
          <Field
            label="Search"
            value={search}
            hint="Title, number, or series"
            lit={search.length > 0}
            onChange={setSearch}
          />
        </div>
        <RoomBody>
          <ChoiceRow
            title="Name a new work"
            note="For a work that is not in the catalog yet. It stays private to the registry until it joins the public catalog."
            onClick={() => { setError(''); setStep('newwork'); }}
          />
          {list.map(artwork => (
            <ChoiceRow
              key={artwork.id}
              title={artwork.title}
              note={[
                artwork.id,
                artwork.series || undefined,
                artwork.editionKind === 'numbered'
                  ? `edition of ${artwork.editionSize}`
                  : artwork.editionKind === 'unique'
                    ? 'unique work'
                    : artwork.editionKind === 'conflict'
                      ? 'edition metadata conflict, resolve in the registry first'
                      : undefined,
                artwork.draft ? 'registry only' : undefined,
              ].filter(Boolean).join(' · ')}
              onClick={() => pickWork(artwork)}
            />
          ))}
          {list.length === 0 && (
            <Note top={16}>Nothing in the catalog matches. Name it as a new work instead.</Note>
          )}
        </RoomBody>
      </Ground>
    );
  }

  if (step === 'newwork') {
    screen = (
      <Ground light="f" pad="40px 30px 30px">
        <RoomHead title="Name a new work" onBack={() => { setError(''); setStep('work'); }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, paddingTop: 22 }}>
          <Field
            label="Title"
            value={newWork.title}
            lit={newWork.title.length > 0}
            onChange={value => { setNewWork(w => ({ ...w, title: value })); attemptKey.current = null; }}
          />
          <Field
            label="Catalog number"
            value={newWork.id}
            hint="SIG-104"
            lit={newWork.id.length > 0}
            onChange={value => { setNewWork(w => ({ ...w, id: value.toUpperCase() })); attemptKey.current = null; }}
          />
          {idSuggestion && (
            <div style={{ margin: '-14px 0 0' }}>
              <TLink tone={C.brass} onClick={() => setNewWork(w => ({ ...w, id: idSuggestion }))}>
                Next free in this series: {idSuggestion} · use it
              </TLink>
            </div>
          )}
          <Field
            label="Series, optional"
            value={newWork.series}
            lit={newWork.series.length > 0}
            onChange={value => setNewWork(w => ({ ...w, series: value }))}
          />
        </div>
        <Note top={18}>
          A new work lives only in the registry until it joins the public catalog.
        </Note>
        {wrongNote}
        <Spacer />
        <Foot>
          <Brass onClick={continueNewWork}>Continue</Brass>
        </Foot>
      </Ground>
    );
  }

  if (step === 'edition' && selection) {
    const kindFixed = selection.editionKind === 'unique' || selection.editionKind === 'numbered';
    const sizeFixed = selection.editionKind === 'numbered' && selection.editionSize !== null;
    screen = (
      <Ground light="c">
        <Eyebrow>{selection.title} · {selection.id}</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head>The edition.</Head>
        </div>
        <Note top={12}>Asked once, and set at registration.</Note>
        <div style={{ position: 'relative', paddingTop: 24 }}>
          {kindFixed ? (
            <Body>
              {selection.editionKind === 'unique'
                ? 'This work is recorded as a unique piece.'
                : `This work is a numbered edition${selection.editionSize ? ` of ${selection.editionSize}` : ''}.`}
            </Body>
          ) : (
            <Capsule
              options={['Unique work', 'Numbered edition']}
              active={edition.kind === 'unique' ? 0 : 1}
              onPick={index => {
                setEdition(e => ({ ...e, kind: index === 0 ? 'unique' : 'numbered' }));
                attemptKey.current = null;
                setError('');
              }}
            />
          )}
        </div>
        {edition.kind === 'numbered' && (
          <div style={{ position: 'relative', display: 'flex', gap: 24, paddingTop: 26 }}>
            <Field
              label="Number"
              value={edition.number}
              lit
              onChange={value => { setEdition(e => ({ ...e, number: value })); attemptKey.current = null; }}
            />
            {sizeFixed ? (
              <div style={{ flex: 1, minWidth: 0, padding: '0 2px 11px' }}>
                <Eyebrow>Edition size</Eyebrow>
                <Body top={8}>{selection.editionSize}</Body>
              </div>
            ) : (
              <Field
                label="Edition size"
                value={edition.size}
                hint={selection.editionKind === 'numbered' ? undefined : 'Fixes the edition'}
                lit={edition.size.length > 0}
                onChange={value => { setEdition(e => ({ ...e, size: value })); attemptKey.current = null; }}
              />
            )}
          </div>
        )}
        {wrongNote}
        <Spacer />
        <Foot
          link={<TLink onClick={() => { setError(''); setStep(selection.mode === 'new' ? 'newwork' : 'work'); }}>Back</TLink>}
        >
          <Brass onClick={continueEdition}>Continue</Brass>
        </Foot>
      </Ground>
    );
  }

  if (step === 'unlock') {
    screen = (
      <Ground light="e">
        <Eyebrow>The registry</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head>{relock ? 'The registry closed.' : 'Unlock the registry.'}</Head>
        </div>
        <Body top={18}>
          {relock
            ? 'The unlock reached its time limit. Nothing you entered was lost. Enter the registry secret to continue where you were.'
            : 'Registration writes to the private registry. The secret opens it for this sitting.'}
        </Body>
        <div style={{ position: 'relative', paddingTop: 26 }}>
          <SecretField label="Registry secret" value={secret} onChange={setSecret} />
        </div>
        {wrongNote}
        <Spacer />
        <Foot
          link={linkedMode ? undefined : (
            <TLink onClick={() => { setError(''); setStep(selection ? 'edition' : 'threshold'); }}>Back</TLink>
          )}
        >
          <Brass onClick={() => { void submitSecret(); }}>
            {busy ? 'Unlocking' : relock ? 'Unlock and continue' : 'Unlock'}
          </Brass>
        </Foot>
      </Ground>
    );
  }

  if (step === 'confirm' && selection) {
    screen = (
      <Ground light="g">
        <Eyebrow>Confirm</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head size={30}>Ready to register.</Head>
        </div>
        <div style={{ position: 'relative', paddingTop: 20 }}>
          <Ledger label="Work" value={selection.title} warm />
          <Ledger label="Number" value={selection.id} />
          {selection.series && <Ledger label="Series" value={selection.series} />}
          <Ledger label="Edition" value={editionLabelFor(edition)} />
          {linkedTarget && <Ledger label="Sales record" value={linkedTarget.artworkRecordId} />}
        </div>
        <Note top={18}>
          Registering writes the permanent identity: its public code, its Ownership Code
          shown once to you, and the first record of the piece.
        </Note>
        {wrongNote}
        <Spacer />
        <Foot
          link={linkedMode ? undefined : (
            <TLink onClick={() => { setError(''); setStep('edition'); }}>Back</TLink>
          )}
        >
          <Brass lifted onClick={() => { void register(); }}>
            {busy ? 'Registering' : 'Register'}
          </Brass>
        </Foot>
      </Ground>
    );
  }

  if (step === 'done' && result) {
    const codeShowing = Boolean(result.ownershipCode);
    const linkSettled = !linkedTarget || relationshipLinked;
    screen = (
      <Ground light="k" pad="44px 30px 26px">
        <Eyebrow tone={C.brass}>The registry</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 12 }}>
          <Head size={30}>Artwork registered.</Head>
        </div>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Ledger label="Work" value={`${result.title} · ${result.artworkId}`} warm />
          <Ledger label="Edition" value={result.editionLabel} />
          <Ledger label="Public code" value={result.publicCode} />
          <Ledger label="Invitation reference" value={result.keeperPieceId} />
        </div>
        <Note top={12}>
          {result.record.status === 'generated'
            ? 'Its record is written.'
            : 'Its record will be written shortly.'}
        </Note>
        {linkedTarget && relationshipLinked && (
          <Note top={8}>Sales record linked to {result.keeperPieceId}.</Note>
        )}
        {linkedTarget && !relationshipLinked && (
          <>
            {wrongNote}
            <div style={{ position: 'relative', paddingTop: 16 }}>
              <Brass full onClick={() => { void completeLinkedRegistration(result.keeperPieceId); }}>
                {linkPending ? 'Linking identity' : 'Retry the identity link'}
              </Brass>
            </div>
          </>
        )}
        {codeShowing ? (
          <>
            <Body top={20}>
              Copy the Ownership Code now. It is shown this once and cannot be shown here
              again.
            </Body>
            <CodeBlock>{result.ownershipCode!}</CodeBlock>
            {!linkedTarget || relationshipLinked ? wrongNote : null}
            <Spacer />
            <Foot
              link={(
                <TLink onClick={() => { setError(''); setResult({ ...result, ownershipCode: undefined }); }}>
                  Dismiss it, I have saved it
                </TLink>
              )}
            >
              <Brass onClick={() => { void copyOwnershipCode(); }}>Copy the code</Brass>
            </Foot>
          </>
        ) : (
          <RoomBody top={20}>
            {linkSettled && (
              <>
                <Row
                  label="View and save codes"
                  onClick={() => navigate(`/admin/artworks/${encodeURIComponent(result.artworkId)}?${new URLSearchParams({
                    instance: result.keeperPieceId,
                    ...(linkedTarget ? { record: linkedTarget.artworkRecordId } : {}),
                  })}`)}
                />
                <Row
                  label="Prepare a physical plate"
                  onClick={() => navigate(`/admin/pieces/wizard?${new URLSearchParams({ keeperPieceId: result.keeperPieceId })}`)}
                />
                <Row
                  label="Assign to a keeper"
                  onClick={() => navigate(`/admin/invitations?${new URLSearchParams({ keeperPieceId: result.keeperPieceId })}`)}
                />
                <Row
                  label="Add to this piece"
                  onClick={() => navigate(`/admin/artworks/${encodeURIComponent(result.artworkId)}`)}
                />
                <Row label="Finish for now" onClick={() => navigate('/admin/pieces')} last />
              </>
            )}
            {linkedStatus === 'generic' && (
              <div style={{ paddingTop: 14 }}>
                <TLink onClick={startOver}>Register another artwork</TLink>
              </div>
            )}
          </RoomBody>
        )}
      </Ground>
    );
  }

  return (
    <div
      className="collector-root"
      data-marks="0"
      style={{ display: 'flex', justifyContent: 'center', padding: '20px 0 44px' }}
    >
      <CeremonyStyles />
      <div
        style={{
          position: 'relative',
          width: 390,
          maxWidth: '100%',
          height: 'min(780px, max(640px, calc(100vh - 150px)))',
          borderRadius: 24,
          overflow: 'hidden',
          background: C.ground,
          border: `1px solid ${C.hairStrong}`,
          boxShadow: '0 32px 64px -24px rgba(0,0,0,.55)',
        }}
      >
        {screen}
      </div>
    </div>
  );
};

export default RegisterCeremony;
