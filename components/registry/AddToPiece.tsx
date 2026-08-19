/**
 * "Add to this piece" at /admin/artworks/:artworkId/add.
 *
 * The additive layer after the fast minimal registration: everything here is
 * optional, attachable later, and never blocks anything. A quiet hub screen
 * holds one row per thing that can join the piece; each row opens its own
 * single screen and returns to the hub with a quiet settled line.
 *
 *   A photograph            -> POST /api/admin/artworks/[id]/media
 *   The story               -> POST /api/admin/artworks/[id]/story
 *   Materials and makers    -> the existing certificate editor
 *                              (/admin/certificates?artworkId=)
 *   A video                 -> POST /api/admin/artworks/[id]/media
 *   A message for its       -> POST /api/admin/artworks/[id]/message,
 *   caretaker                  sealed until its caretaker unlocks
 *
 * Each successful attach regenerates the piece's permanent record server
 * side. The registry unlock is held the same way the registration ceremony
 * holds it; losing it re-prompts in place with every typed value preserved.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CeremonyStyles } from '../ceremony/styles';
import {
  Area,
  Body,
  Brass,
  C,
  ChoiceRow,
  Eyebrow,
  Foot,
  Ground,
  Head,
  Ledger,
  Note,
  RoomBody,
  RoomHead,
  SecretField,
  Spacer,
  TLink,
} from './kit';
import { useRegistryUnlock } from './useRegistryUnlock';
import { titleFor } from '../../utils/adminPieces';

type Step = 'hub' | 'photo' | 'video' | 'story' | 'message' | 'unlock';

type MediaRow = { id: string; kind: string };

type Instance = {
  keeperPieceId: string;
  editionNumber: number;
  publicCode: string;
  held: boolean;
  message: { id: string; createdAt: string; revealedAt: string | null } | null;
};

/** Client-side gates mirroring the migration 038 caps, checked before upload. */
const MEDIA_RULES = {
  photo: {
    types: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 10 * 1024 * 1024,
    cap: '10 MB',
    accept: 'image/jpeg,image/png,image/webp',
  },
  video: {
    types: ['video/mp4'],
    maxBytes: 200 * 1024 * 1024,
    cap: '200 MB',
    accept: 'video/mp4',
  },
} as const;

const MESSAGE_MAX = 2000;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('file_unreadable'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      if (comma < 0) { reject(new Error('file_unreadable')); return; }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

const AddToPiece: React.FC<{ onStepChange?: (step: Step) => void }> = ({ onStepChange }) => {
  const navigate = useNavigate();
  const params = useParams<{ artworkId: string }>();
  const artworkId = (params.artworkId || '').toUpperCase();
  const base = `/api/admin/artworks/${encodeURIComponent(artworkId)}`;

  const [step, setStep] = useState<Step>('hub');
  const stepRef = useRef<Step>('hub');
  stepRef.current = step;
  const [returnTo, setReturnTo] = useState<Step>('hub');
  const [settled, setSettled] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');

  const [media, setMedia] = useState<MediaRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [story, setStory] = useState('');
  const [storedStory, setStoredStory] = useState<string | null>(null);
  const [storyLoaded, setStoryLoaded] = useState(false);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [instancesLoaded, setInstancesLoaded] = useState(false);
  const [chosenInstance, setChosenInstance] = useState<Instance | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState('');

  const unlockLost = () => {
    if (stepRef.current !== 'hub' && stepRef.current !== 'unlock') {
      setReturnTo(stepRef.current);
      setStep('unlock');
    }
  };
  const { state: unlockState, unlock } = useRegistryUnlock(unlockLost);

  useEffect(() => {
    onStepChange?.(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /* Quietly learn what is already with the piece; nothing depends on it. */
  useEffect(() => {
    let cancelled = false;
    void fetch(`${base}/media`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => { if (!cancelled && Array.isArray(data?.media)) setMedia(data.media); })
      .catch(() => {});
    void fetch(`${base}/story`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (cancelled) return;
        setStoredStory(typeof data?.story === 'string' ? data.story : null);
        setStoryLoaded(true);
      })
      .catch(() => { if (!cancelled) setStoryLoaded(true); });
    void fetch(`${base}/message`, { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (cancelled) return;
        if (Array.isArray(data?.instances)) setInstances(data.instances);
        setInstancesLoaded(true);
      })
      .catch(() => { if (!cancelled) setInstancesLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  const lockedResponse = (code: string) =>
    ['registry_locked', 'registry_unlock_required', 'unlock_absolute_cap'].includes(code);

  const settle = (line: string) => {
    setSettled(line);
    setError('');
    setFile(null);
    setStep('hub');
  };

  const open = (next: Step) => {
    setError('');
    setFile(null);
    setStep(next);
  };

  /* ── actions ─────────────────────────────────────────────────────── */

  const pickFile = (kind: 'photo' | 'video', picked: File | null) => {
    setError('');
    if (!picked) { setFile(null); return; }
    const rules = MEDIA_RULES[kind];
    if (!(rules.types as readonly string[]).includes(picked.type)) {
      setFile(null);
      setError(kind === 'photo'
        ? 'The photograph is a JPEG, PNG, or WebP file.'
        : 'The video is an MP4 file.');
      return;
    }
    if (picked.size > rules.maxBytes) {
      setFile(null);
      setError(`The file is larger than ${rules.cap}. Choose a smaller one.`);
      return;
    }
    setFile(picked);
  };

  const uploadMedia = async (kind: 'photo' | 'video') => {
    if (busy || !file) return;
    setBusy(true);
    setError('');
    try {
      const bytes = await fileToBase64(file);
      const response = await fetch(`${base}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, contentType: file.type, bytes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data?.error === 'string' ? data.error : '';
        if (lockedResponse(code)) {
          setReturnTo(kind);
          setStep('unlock');
          return;
        }
        setError('It could not be added. The same file can be tried again.');
        return;
      }
      if (data?.media) setMedia(list => [...list.filter(row => row.id !== data.media.id), data.media]);
      settle(kind === 'photo' ? 'The photograph is with the piece.' : 'The video is with the piece.');
    } catch {
      setError('It could not be added. The same file can be tried again.');
    } finally {
      setBusy(false);
    }
  };

  const saveStory = async () => {
    if (busy) return;
    const text = story.trim();
    if (!text) { setError('The story needs its words.'); return; }
    if (text.length > 5000) { setError('The story holds up to 5000 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${base}/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data?.error === 'string' ? data.error : '';
        if (lockedResponse(code)) {
          setReturnTo('story');
          setStep('unlock');
          return;
        }
        setError('The story could not be kept. The same words can be tried again.');
        return;
      }
      setStoredStory(text);
      settle('The story is with the piece.');
    } catch {
      setError('The story could not be kept. The same words can be tried again.');
    } finally {
      setBusy(false);
    }
  };

  const chooseInstance = (instance: Instance) => {
    setChosenInstance(instance);
    setCurrentMessage(null);
    setError('');
    if (instance.message) {
      void fetch(`${base}/message?keeperPieceId=${encodeURIComponent(instance.keeperPieceId)}`, {
        cache: 'no-store',
      })
        .then(response => response.json())
        .then(data => {
          if (typeof data?.message?.body === 'string') setCurrentMessage(data.message.body);
        })
        .catch(() => {});
    }
  };

  const openMessage = () => {
    setMessageBody('');
    setChosenInstance(null);
    setCurrentMessage(null);
    if (instances.length === 1) chooseInstance(instances[0]);
    open('message');
  };

  const sealMessage = async () => {
    if (busy || !chosenInstance) return;
    const text = messageBody.replace(/\s+/g, ' ').trim();
    if (!text) { setError('The message needs its words.'); return; }
    if (text.length > MESSAGE_MAX) { setError('The message holds up to 2000 characters.'); return; }
    if (text.includes('@')) {
      setError('The message stays free of addresses. Take the @ out.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${base}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keeperPieceId: chosenInstance.keeperPieceId, body: text }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data?.error === 'string' ? data.error : '';
        if (lockedResponse(code)) {
          setReturnTo('message');
          setStep('unlock');
          return;
        }
        setError(code === 'invalid_message_body'
          ? 'The message could not be sealed as written. Keep it to one plain paragraph.'
          : 'The message could not be sealed. The same words can be tried again.');
        return;
      }
      setInstances(list => list.map(item => item.keeperPieceId === chosenInstance.keeperPieceId
        ? { ...item, message: data?.message ?? item.message }
        : item));
      setMessageBody('');
      settle('Sealed into the piece. Its caretaker will meet it when they unlock.');
    } catch {
      setError('The message could not be sealed. The same words can be tried again.');
    } finally {
      setBusy(false);
    }
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
    setStep(returnTo);
  };

  /* ── the screens ─────────────────────────────────────────────────── */

  const title = titleFor(artworkId);

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

  const photoCount = media.filter(row => row.kind === 'photo').length;
  const videoCount = media.filter(row => row.kind === 'video').length;
  const sealedCount = instances.filter(instance => instance.message).length;

  let screen: React.ReactNode = null;

  if (step === 'hub') {
    screen = (
      <Ground light="a" wash>
        <Eyebrow>{title} · {artworkId}</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head>Add to this piece.</Head>
        </div>
        <Body top={18}>
          Nothing here is required, and nothing waits on anything else. Whatever you add
          joins the piece and its permanent record.
        </Body>
        {settled && <Note top={14}>{settled}</Note>}
        <RoomBody top={20}>
          <ChoiceRow
            title="A photograph"
            note={photoCount > 0 ? 'With the piece.' : undefined}
            onClick={() => open('photo')}
          />
          <ChoiceRow
            title="The story"
            note={storedStory ? 'With the piece.' : undefined}
            onClick={() => { setStory(storedStory || ''); open('story'); }}
          />
          <ChoiceRow
            title="Materials and makers"
            note="Certificate facts, kept in the certificate editor."
            onClick={() => navigate(`/admin/certificates?${new URLSearchParams({ artworkId })}`)}
          />
          <ChoiceRow
            title="A video"
            note={videoCount > 0 ? 'With the piece.' : undefined}
            onClick={() => open('video')}
          />
          <ChoiceRow
            title="A message for its caretaker"
            note={sealedCount > 0 ? 'Sealed in the piece.' : undefined}
            onClick={openMessage}
          />
        </RoomBody>
        <Spacer />
        <Foot
          link={(
            <TLink onClick={() => navigate(`/admin/artworks/${encodeURIComponent(artworkId)}`)}>
              Done for now
            </TLink>
          )}
        />
      </Ground>
    );
  }

  if (step === 'photo' || step === 'video') {
    const kind = step;
    const rules = MEDIA_RULES[kind];
    screen = (
      <Ground light="b" pad="40px 30px 30px">
        <RoomHead
          title={kind === 'photo' ? 'A photograph' : 'A video'}
          onBack={() => { setError(''); setFile(null); setStep('hub'); }}
        />
        <Body top={20}>
          {kind === 'photo'
            ? 'One photograph of the piece as it is. JPEG, PNG, or WebP, up to 10 MB.'
            : 'One video of the piece. MP4, up to 200 MB.'}
        </Body>
        <input
          ref={fileInput}
          type="file"
          accept={rules.accept}
          style={{ display: 'none' }}
          onChange={event => pickFile(kind, event.target.files?.[0] ?? null)}
        />
        <div style={{ position: 'relative', paddingTop: 20 }}>
          {file ? (
            <Ledger label="Chosen file" value={file.name} warm />
          ) : (
            <ChoiceRow
              title="Choose the file"
              onClick={() => fileInput.current?.click()}
            />
          )}
          {file && (
            <div style={{ paddingTop: 8 }}>
              <TLink onClick={() => fileInput.current?.click()}>Choose a different file</TLink>
            </div>
          )}
        </div>
        {wrongNote}
        <Spacer />
        <Foot>
          {file && (
            <Brass onClick={() => { void uploadMedia(kind); }}>
              {busy ? 'Adding' : kind === 'photo' ? 'Add the photograph' : 'Add the video'}
            </Brass>
          )}
        </Foot>
      </Ground>
    );
  }

  if (step === 'story') {
    screen = (
      <Ground light="c" pad="40px 30px 30px">
        <RoomHead title="The story" onBack={() => { setError(''); setStep('hub'); }} />
        <Body top={20}>
          {storyLoaded && storedStory
            ? 'The story as it stands. What you keep here replaces it.'
            : 'The words that travel with the piece, in its record.'}
        </Body>
        <div style={{ position: 'relative', paddingTop: 6 }}>
          <Area
            value={story}
            rows={8}
            onChange={setStory}
          />
        </div>
        {wrongNote}
        <Spacer />
        <Foot>
          <Brass onClick={() => { void saveStory(); }}>
            {busy ? 'Keeping' : 'Keep the story'}
          </Brass>
        </Foot>
      </Ground>
    );
  }

  if (step === 'message') {
    const editionLabel = (instance: Instance) => instance.editionNumber === 0
      ? 'Unique work'
      : `Number ${instance.editionNumber}`;
    screen = (
      <Ground light="f" pad="40px 30px 30px">
        <RoomHead
          title="A message for its caretaker"
          onBack={() => { setError(''); setStep('hub'); }}
        />
        {!chosenInstance ? (
          <>
            <Body top={20}>
              The message belongs to one physical piece. It stays sealed until whoever
              keeps that piece unlocks it.
            </Body>
            <RoomBody top={16}>
              {instancesLoaded && instances.length === 0 && (
                <Note top={4}>No registered piece of this work yet. Register one first.</Note>
              )}
              {instances.map(instance => (
                <ChoiceRow
                  key={instance.keeperPieceId}
                  title={editionLabel(instance)}
                  note={[
                    instance.publicCode,
                    instance.held ? 'in someone’s hands' : 'unclaimed',
                    instance.message ? 'a message is sealed in it' : undefined,
                  ].filter(Boolean).join(' · ')}
                  onClick={() => chooseInstance(instance)}
                />
              ))}
            </RoomBody>
          </>
        ) : (
          <>
            <div style={{ position: 'relative', paddingTop: 16 }}>
              <Ledger label="Piece" value={`${editionLabel(chosenInstance)} · ${chosenInstance.publicCode}`} warm />
            </div>
            {chosenInstance.message && (
              <Note top={14}>
                A message is already sealed in this piece. Writing again replaces it
                before it is met.
              </Note>
            )}
            {currentMessage && (
              <Body top={10} size={14}>{currentMessage}</Body>
            )}
            <div style={{ position: 'relative', paddingTop: 6 }}>
              <Area
                value={messageBody}
                rows={6}
                hint="One plain paragraph"
                onChange={value => setMessageBody(value.replace(/[\r\n]+/g, ' '))}
              />
            </div>
            <Note top={12}>
              One paragraph, sealed until its caretaker unlocks. No addresses.
            </Note>
            {wrongNote}
            <Spacer />
            <Foot
              link={instances.length > 1 ? (
                <TLink onClick={() => { setError(''); setChosenInstance(null); }}>
                  A different piece
                </TLink>
              ) : undefined}
            >
              <Brass onClick={() => { void sealMessage(); }}>
                {busy ? 'Sealing' : 'Seal it into the piece'}
              </Brass>
            </Foot>
          </>
        )}
        {!chosenInstance && wrongNote}
      </Ground>
    );
  }

  if (step === 'unlock') {
    screen = (
      <Ground light="e">
        <Eyebrow>The registry</Eyebrow>
        <div style={{ position: 'relative', paddingTop: 14 }}>
          <Head>Unlock the registry.</Head>
        </div>
        <Body top={18}>
          Adding to a piece writes to the private registry. The secret opens it for this
          sitting. Nothing you entered was lost.
        </Body>
        <div style={{ position: 'relative', paddingTop: 26 }}>
          <SecretField label="Registry secret" value={secret} onChange={setSecret} />
        </div>
        {wrongNote}
        <Spacer />
        <Foot
          link={<TLink onClick={() => { setError(''); setStep('hub'); }}>Back</TLink>}
        >
          <Brass onClick={() => { void submitSecret(); }}>
            {busy ? 'Unlocking' : 'Unlock and continue'}
          </Brass>
        </Foot>
      </Ground>
    );
  }

  // The unlock state is only consulted lazily: everything stays readable
  // while locked, and the write paths re-prompt exactly when the server says.
  void unlockState;

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

export default AddToPiece;
