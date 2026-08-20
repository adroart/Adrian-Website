/**
 * A browser-only fetch stub for the artist-ceremony DEMO chapters of the
 * guided walkthrough.
 *
 * `installCeremonyDemoStub()` patches `window.fetch` so the two ceremony
 * screens (RegisterCeremony, AddToPiece) can run inside the walkthrough with
 * no real backend behind them: every request whose path starts with `/api/`
 * is answered here, in memory, with payload shapes that match exactly what
 * those two components read out of their responses. Any request outside
 * `/api/` passes straight through to the real fetch, untouched.
 *
 * Nothing here talks to the network, nothing is written to storage, and the
 * "registry secret" the demo unlock screen accepts is never inspected beyond
 * "did the visitor type something" — it is never stored or logged.
 *
 * Call the returned function to uninstall and restore the original fetch;
 * `CeremonyStation` does this itself on unmount.
 */

/** Whether the demo registry is unlocked. Module-local: it starts false and,
 *  once opened in a sitting, stays open for every ceremony station after it,
 *  the same way the real step-up unlock survives across ceremony screens. */
let unlocked = false;

/* Exported so the plate chapter's purpose-made station sequence
   (CeremonyStation.tsx) can build the SAME piece's real plate SVGs with
   utils/artworkPlate.ts, rather than inventing a second demo identity. */
export const DEMO_PUBLIC_CODE = 'AR-DEM45678';
export const DEMO_OWNERSHIP_CODE = 'DEM2-3456-789C-DEFG';
export const DEMO_ARTWORK_ID = 'UL-100';
export const DEMO_EDITION_NUMBER = 1;
const DEMO_KEEPER_PIECE_ID = 'kp-demo-0001';
const DEMO_INVITATION_ID = 'iv-demo-0001';
const DEMO_INVITATION_TOKEN = 'demo-invitation-token-45678';

type DemoMedia = { id: string; kind: string };
type DemoMessageSummary = { id: string; createdAt: string; revealedAt: string | null };
type DemoInstance = {
  keeperPieceId: string;
  editionNumber: number;
  publicCode: string;
  held: boolean;
  message: DemoMessageSummary | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === 'string') return new URL(input, window.location.origin);
    if (input instanceof URL) return new URL(input.toString(), window.location.origin);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url, window.location.origin);
    }
  } catch {
    return null;
  }
  return null;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

async function readJsonBody(input: RequestInfo | URL, init?: RequestInit): Promise<Record<string, unknown>> {
  try {
    if (typeof init?.body === 'string') return JSON.parse(init.body);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const value = await input.clone().json();
      if (value && typeof value === 'object') return value as Record<string, unknown>;
    }
  } catch {
    // Malformed or absent body: the demo treats it as empty.
  }
  return {};
}

export function installCeremonyDemoStub(): () => void {
  const originalFetch = window.fetch.bind(window);

  /* Per-install demo records: each time a ceremony station mounts the stub
     fresh, the "with the piece" state starts clean, exactly like arriving at
     a fresh demo. */
  let demoSeq = 0;
  const mediaByArtwork = new Map<string, DemoMedia[]>();
  const storyByArtwork = new Map<string, string>();
  const messageBodyByKeeper = new Map<string, string>();
  const instancesByArtwork = new Map<string, DemoInstance[]>();

  const mediaListFor = (artworkId: string): DemoMedia[] => {
    let list = mediaByArtwork.get(artworkId);
    if (!list) { list = []; mediaByArtwork.set(artworkId, list); }
    return list;
  };

  const instancesFor = (artworkId: string): DemoInstance[] => {
    let list = instancesByArtwork.get(artworkId);
    if (!list) {
      list = [{
        keeperPieceId: DEMO_KEEPER_PIECE_ID,
        editionNumber: 1,
        publicCode: DEMO_PUBLIC_CODE,
        held: false,
        message: null,
      }];
      instancesByArtwork.set(artworkId, list);
    }
    return list;
  };

  const patched: typeof window.fetch = async (input, init) => {
    const url = requestUrl(input);
    const path = url?.pathname ?? '';
    if (!path.startsWith('/api/')) return originalFetch(input as RequestInfo, init);
    const method = requestMethod(input, init);

    if (path === '/api/admin/registry-unlock') {
      if (method === 'GET') return jsonResponse({ ok: true, unlocked });
      if (method === 'POST') {
        const body = await readJsonBody(input, init);
        const secret = typeof body.secret === 'string' ? body.secret.trim() : '';
        if (!secret) return jsonResponse({ ok: false, error: 'registry_secret_required' }, 400);
        unlocked = true;
        return jsonResponse({ ok: true, expiresIn: 600 });
      }
    }

    if (path === '/api/admin/registry-unlock/refresh' && method === 'POST') {
      return jsonResponse({ ok: true, expiresIn: 600 });
    }

    if (path === '/api/admin/register-artwork' && method === 'POST') {
      const body = await readJsonBody(input, init);
      const newArtwork = body.newArtwork as { title?: unknown; series?: unknown } | undefined;
      const artwork = newArtwork
        ? { title: typeof newArtwork.title === 'string' ? newArtwork.title : '', series: typeof newArtwork.series === 'string' ? newArtwork.series : null }
        : { title: '', series: null };
      return jsonResponse({
        ok: true,
        keeperPieceId: DEMO_KEEPER_PIECE_ID,
        publicCode: DEMO_PUBLIC_CODE,
        ownershipCode: DEMO_OWNERSHIP_CODE,
        artwork,
        record: { status: 'generated' },
      }, 201);
    }

    /* the held-piece entrance's invitation, POST /api/admin/invitations,
       answering createArtworkInvitation's real response shape
       (functions/api/_lib/artworkInvitations.js): { invitationId, token }.
       The demo never inspects the request body beyond acknowledging it. */
    if (path === '/api/admin/invitations' && method === 'POST') {
      return jsonResponse({
        ok: true,
        invitationId: DEMO_INVITATION_ID,
        token: DEMO_INVITATION_TOKEN,
      }, 201);
    }

    const mediaMatch = path.match(/^\/api\/admin\/artworks\/([^/]+)\/media$/);
    if (mediaMatch) {
      const artworkId = decodeURIComponent(mediaMatch[1]);
      if (method === 'GET') {
        return jsonResponse({ ok: true, artworkId, media: mediaListFor(artworkId) });
      }
      if (method === 'POST') {
        const body = await readJsonBody(input, init);
        const kind = body.kind === 'video' ? 'video' : 'photo';
        demoSeq += 1;
        const media: DemoMedia = { id: `demo-media-${demoSeq}`, kind };
        mediaListFor(artworkId).push(media);
        return jsonResponse({
          ok: true,
          artworkId,
          media,
          records: { total: 0, generated: 0, unchanged: 0, failed: 0, outcomes: [] },
        }, 201);
      }
    }

    const storyMatch = path.match(/^\/api\/admin\/artworks\/([^/]+)\/story$/);
    if (storyMatch) {
      const artworkId = decodeURIComponent(storyMatch[1]);
      if (method === 'GET') {
        return jsonResponse({ ok: true, artworkId, story: storyByArtwork.get(artworkId) ?? null });
      }
      if (method === 'POST') {
        const body = await readJsonBody(input, init);
        const story = typeof body.story === 'string' ? body.story : '';
        storyByArtwork.set(artworkId, story);
        return jsonResponse({ ok: true, artworkId, story }, 200);
      }
    }

    const messageMatch = path.match(/^\/api\/admin\/artworks\/([^/]+)\/message$/);
    if (messageMatch) {
      const artworkId = decodeURIComponent(messageMatch[1]);
      if (method === 'GET') {
        const keeperPieceId = url?.searchParams.get('keeperPieceId') ?? '';
        if (keeperPieceId) {
          const body = messageBodyByKeeper.get(keeperPieceId);
          return jsonResponse({
            ok: true,
            artworkId,
            keeperPieceId,
            message: typeof body === 'string' ? { body } : null,
          });
        }
        return jsonResponse({ ok: true, artworkId, instances: instancesFor(artworkId) });
      }
      if (method === 'POST') {
        const body = await readJsonBody(input, init);
        const keeperPieceId = typeof body.keeperPieceId === 'string' && body.keeperPieceId
          ? body.keeperPieceId
          : DEMO_KEEPER_PIECE_ID;
        const text = typeof body.body === 'string' ? body.body : '';
        demoSeq += 1;
        const summary: DemoMessageSummary = {
          id: `demo-message-${demoSeq}`,
          createdAt: new Date().toISOString(),
          revealedAt: null,
        };
        messageBodyByKeeper.set(keeperPieceId, text);
        instancesByArtwork.set(artworkId, instancesFor(artworkId).map(instance => (
          instance.keeperPieceId === keeperPieceId ? { ...instance, message: summary } : instance
        )));
        return jsonResponse({ ok: true, artworkId, keeperPieceId, message: summary }, 201);
      }
    }

    return jsonResponse({ ok: false, error: 'demo_stub_not_handled' }, 404);
  };

  window.fetch = patched;
  return () => { window.fetch = originalFetch; };
}
