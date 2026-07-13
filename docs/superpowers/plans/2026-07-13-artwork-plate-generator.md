# Adrian Rasmussen Artwork Plate Generator Implementation Plan

> **Superseded, 2026-07-13:** Do not execute this plan. It has been replaced by
> `2026-07-13-shipment-ready-artwork-registry.md` and the operational procedure in
> `docs/lineage-plate-runbook.md`. The replacement preserves permanent physical
> identities while adding encrypted recovery, verified online backup, activation,
> and exact shipment assignment.

> **Storage amendment, 2026-07-13:** The approved design now requires recoverable online Ownership
> Codes encrypted in the primary database plus a separately encrypted online backup. Sections below
> that require one-time-only plaintext, no recoverable persistence, browser-only manifests, or the
> name “Lineage Code” are stale and must be rewritten before this plan is executed. Do not implement
> those requirements as written.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Adrian Rasmussen backend generator that registers one immutable physical artwork instance and returns its permanent public QR SVG, permanent underside Lineage Code SVG, and private fabrication manifest.

**Architecture:** Adrian Rasmussen D1 remains authoritative for physical-instance issuance and keeper binding. Extend `keeper_pieces` with an immutable public `AR-XXXXXXXX` code and plate lifecycle, generate both vector assets server-side in the existing admin registration transaction, and resolve new codes dynamically through the permanent Adrian Rasmussen QR route. Mandala Codes remains a read-only consumer during this shipment-critical phase.

**Tech Stack:** React 18, TypeScript, Cloudflare Pages Functions, Cloudflare D1, Web Crypto, `qrcode`, Node test runner via `tsx`.

---

## File structure

- Create `migrations/010_artwork_plate_identity.sql`: additive physical-instance and plate-lifecycle columns on `keeper_pieces`.
- Create `utils/artworkPlate.ts`: pure public-code generation, QR matrix rendering, front/back SVG rendering, XML escaping, and asset hashing.
- Modify `functions/api/admin/pieces.js`: validate artwork/edition, issue both codes, persist hashes and lifecycle, return one-time fabrication assets, and activate a plate.
- Modify `functions/qr/[number].js`: D1 lookup for `AR-XXXXXXXX` codes while preserving every legacy redirect.
- Modify `components/AdminPieces.tsx`: download the one-time fabrication package and perform explicit scan-tested activation.
- Modify `tests/living-legacy.test.ts`: pin generation, privacy, registration locking, activation, and dynamic redirect behavior.
- Create `docs/lineage-plate-runbook.md`: the exact physical preflight and shipment checklist.

### Task 1: Pure plate identity and vector renderer

**Files:**
- Create: `utils/artworkPlate.ts`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Write failing unit tests for the public code and vector contract**

Add imports and a focused suite to `tests/living-legacy.test.ts`:

```ts
import {
  buildArtworkPlatePackage,
  generatePublicPlateCode,
  isPublicPlateCode,
  publicPlateUrl,
} from '../utils/artworkPlate';

describe('artwork plate generator', () => {
  it('generates immutable public codes inside the 11-character QR contract', () => {
    const codes = new Set(Array.from({ length: 1000 }, generatePublicPlateCode));
    assert.equal(codes.size, 1000);
    for (const code of codes) {
      assert.match(code, /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      assert.ok(code.length <= 11);
      assert.equal(isPublicPlateCode(code), true);
    }
  });

  it('builds Adrian-owned front and underside SVG assets', async () => {
    const pkg = await buildArtworkPlatePackage({
      publicCode: 'AR-7KQ9M2WX',
      lineageCode: 'K7QM-9XTR-2PHV-N4WB',
      artworkId: 'UL-100',
      editionNumber: 2,
    });

    assert.equal(pkg.publicUrl, 'https://adrianrasmussen.com/qr/AR-7KQ9M2WX');
    assert.match(pkg.frontSvg, /data-error-correction="Q"/);
    assert.match(pkg.frontSvg, /data-quiet-zone="4"/);
    assert.match(pkg.frontSvg, /AR-7KQ9M2WX/);
    assert.match(pkg.frontSvg, /adrianrasmussen\.com\/qr\/AR-7KQ9M2WX/);
    assert.match(pkg.backSvg, /K7QM-9XTR-2PHV-N4WB/);
    assert.match(pkg.backSvg, /does not by itself establish ownership/i);
    assert.doesNotMatch(pkg.frontSvg, /K7QM-9XTR/);
    assert.match(pkg.frontSha256, /^[a-f0-9]{64}$/);
    assert.match(pkg.backSha256, /^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npm run test:unit -- --test-name-pattern="artwork plate generator"
```

Expected: FAIL because `utils/artworkPlate.ts` does not exist.

- [ ] **Step 3: Implement the pure generator**

Create `utils/artworkPlate.ts`:

```ts
import QRCode from 'qrcode';

const PUBLIC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_LENGTH = 8;
export const PUBLIC_PLATE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const PLATE_QR_ERROR_CORRECTION = 'Q' as const;
export const PLATE_QR_QUIET_ZONE = 4;

export interface ArtworkPlateInput {
  publicCode: string;
  lineageCode: string;
  artworkId: string;
  editionNumber: number;
}

export interface ArtworkPlatePackage {
  publicCode: string;
  publicUrl: string;
  frontFilename: string;
  backFilename: string;
  manifestFilename: string;
  frontSvg: string;
  backSvg: string;
  frontSha256: string;
  backSha256: string;
}

export function generatePublicPlateCode(): string {
  const out: string[] = [];
  while (out.length < PUBLIC_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(PUBLIC_LENGTH));
    for (const byte of bytes) {
      if (byte >= 256 - (256 % PUBLIC_ALPHABET.length)) continue;
      out.push(PUBLIC_ALPHABET[byte % PUBLIC_ALPHABET.length]);
      if (out.length === PUBLIC_LENGTH) break;
    }
  }
  return `AR-${out.join('')}`;
}

export function isPublicPlateCode(value: string): boolean {
  return PUBLIC_PLATE_PATTERN.test(value);
}

export function publicPlateUrl(publicCode: string): string {
  if (!isPublicPlateCode(publicCode)) throw new Error('invalid_public_plate_code');
  return `https://adrianrasmussen.com/qr/${publicCode}`;
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function qrRects(url: string): { rects: string; modules: number } {
  const qr = QRCode.create(url, { errorCorrectionLevel: PLATE_QR_ERROR_CORRECTION });
  const modules = qr.modules.size;
  const total = modules + PLATE_QR_QUIET_ZONE * 2;
  const size = 300;
  const cell = size / total;
  const rects: string[] = [];

  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      if (!qr.modules.get(x, y)) continue;
      rects.push(
        `<rect x="${((x + PLATE_QR_QUIET_ZONE) * cell).toFixed(4)}" ` +
          `y="${((y + PLATE_QR_QUIET_ZONE) * cell).toFixed(4)}" ` +
          `width="${cell.toFixed(4)}" height="${cell.toFixed(4)}"/>`,
      );
    }
  }
  return { rects: rects.join(''), modules };
}

function renderFront(input: ArtworkPlateInput, url: string): string {
  const { rects, modules } = qrRects(url);
  const edition = input.editionNumber > 0 ? ` · edition ${input.editionNumber}` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="42mm" height="50mm" viewBox="0 0 420 500" ` +
    `data-error-correction="Q" data-quiet-zone="4" data-modules="${modules}">` +
    `<rect width="420" height="500" fill="#fff"/>` +
    `<g transform="translate(60 20)" fill="#000">${rects}</g>` +
    `<text x="210" y="360" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" letter-spacing="3">${xml(input.publicCode)}</text>` +
    `<text x="210" y="397" text-anchor="middle" font-family="Arial,sans-serif" font-size="13">${xml(url.replace('https://', ''))}</text>` +
    `<text x="210" y="432" text-anchor="middle" font-family="Arial,sans-serif" font-size="14">${xml(input.artworkId + edition)}</text>` +
    `<text x="210" y="466" text-anchor="middle" font-family="Arial,sans-serif" font-size="11">Scan to open this artwork's living history</text>` +
    `</svg>`;
}

function renderBack(input: ArtworkPlateInput): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="25mm" viewBox="0 0 700 250">` +
    `<rect width="700" height="250" fill="#fff"/>` +
    `<text x="350" y="48" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" letter-spacing="4">LINEAGE CODE</text>` +
    `<text x="350" y="112" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" letter-spacing="4">${xml(input.lineageCode)}</text>` +
    `<text x="350" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="14">adrianrasmussen.com</text>` +
    `<text x="350" y="196" text-anchor="middle" font-family="Arial,sans-serif" font-size="12">This code begins a stewardship request.</text>` +
    `<text x="350" y="218" text-anchor="middle" font-family="Arial,sans-serif" font-size="12">It does not by itself establish ownership.</text>` +
    `</svg>`;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function buildArtworkPlatePackage(
  input: ArtworkPlateInput,
): Promise<ArtworkPlatePackage> {
  if (!isPublicPlateCode(input.publicCode)) throw new Error('invalid_public_plate_code');
  if (!Number.isInteger(input.editionNumber) || input.editionNumber < 0) {
    throw new Error('invalid_edition_number');
  }
  const publicUrl = publicPlateUrl(input.publicCode);
  const frontSvg = renderFront(input, publicUrl);
  const backSvg = renderBack(input);
  const base = `${input.publicCode}-${input.artworkId.toLowerCase()}-ed${input.editionNumber}`;
  return {
    publicCode: input.publicCode,
    publicUrl,
    frontFilename: `${base}-front.svg`,
    backFilename: `${base}-lineage.svg`,
    manifestFilename: `${base}-manifest.json`,
    frontSvg,
    backSvg,
    frontSha256: await sha256(frontSvg),
    backSha256: await sha256(backSvg),
  };
}
```

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npm run test:unit -- --test-name-pattern="artwork plate generator"
```

Expected: PASS, including 1,000 unique public codes and both asset hashes.

- [ ] **Step 5: Commit the pure generator**

```bash
git add utils/artworkPlate.ts tests/living-legacy.test.ts
git commit -m "feat(lineage): generate artwork plate assets"
```

### Task 2: Persist physical-instance identity and lock active plates

**Files:**
- Create: `migrations/010_artwork_plate_identity.sql`
- Modify: `functions/api/admin/pieces.js`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Add failing admin tests**

Extend the existing in-memory `keeper_pieces` harness and admin suite to assert:

```ts
it('returns one complete fabrication package and persists no plaintext', async () => {
  const res = await register({ request: registerReq('UL-100', 2), env });
  const json = await res.json();
  assert.equal(res.status, 201);
  assert.match(json.plate.publicCode, /^AR-[A-Z2-9]{8}$/);
  assert.match(json.plate.frontSvg, /data-error-correction="Q"/);
  assert.match(json.plate.backSvg, new RegExp(json.recoveryCode));
  assert.equal(rows[0].public_code, json.plate.publicCode);
  assert.equal(rows[0].plate_status, 'generated');
  assert.equal(JSON.stringify(rows[0]).includes(json.recoveryCode), false);
  assert.equal(JSON.stringify(rows[0]).includes(json.plate.backSvg), false);
});

it('locks the permanent codes after physical activation', async () => {
  const created = await register({ request: registerReq('UL-100', 2), env });
  const json = await created.json();
  const activated = await register({
    request: new Request('https://adrianrasmussen.com/api/admin/pieces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': 'test' },
      body: JSON.stringify({ id: rows[0].id, publicCode: json.plate.publicCode }),
    }),
    env,
  });
  assert.equal(activated.status, 200);
  assert.equal(rows[0].plate_status, 'active');

  const retry = await register({ request: registerReq('UL-100', 2), env });
  assert.equal(retry.status, 409);
  assert.equal((await retry.json()).error, 'plate_active');
});
```

Also add tests that unknown artwork IDs and negative/non-integer editions return 400.

- [ ] **Step 2: Run the admin tests and confirm failure**

```bash
npm run test:unit -- --test-name-pattern="fabrication package|locks the permanent|unknown artwork|invalid edition"
```

Expected: FAIL because the D1 shape and API response do not contain plate identity.

- [ ] **Step 3: Add the D1 migration**

Create `migrations/010_artwork_plate_identity.sql`:

```sql
ALTER TABLE keeper_pieces ADD COLUMN public_code TEXT;
ALTER TABLE keeper_pieces ADD COLUMN plate_status TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE keeper_pieces ADD COLUMN plate_generated_at TEXT;
ALTER TABLE keeper_pieces ADD COLUMN plate_activated_at TEXT;
ALTER TABLE keeper_pieces ADD COLUMN front_svg_sha256 TEXT;
ALTER TABLE keeper_pieces ADD COLUMN back_svg_sha256 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_keeper_pieces_public_code
  ON keeper_pieces(public_code)
  WHERE public_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_keeper_pieces_plate_status
  ON keeper_pieces(plate_status);
```

Existing rows remain `legacy`; no current printed QR is invalidated.

- [ ] **Step 4: Extend the admin registration endpoint**

In `functions/api/admin/pieces.js`:

1. Import `FULL_ARCHIVE`, `generatePublicPlateCode`, and `buildArtworkPlatePackage`.
2. Accept `PATCH` and route it to `activatePlate`.
3. Reject piece IDs not present in `FULL_ARCHIVE`.
4. Reject non-integer or negative edition numbers.
5. Treat `plate_status = 'active'` as permanently locked even without a keeper.
6. Generate public-code collisions in a bounded five-attempt loop, retrying only the D1 unique conflict.
7. Persist `public_code`, `plate_status = 'generated'`, timestamps, and SVG hashes in the same registration write as the Lineage Code verifier.
8. Return `{ lineageCode, plate }` once; never include either SVG on GET.

Use this activation implementation:

```js
async function activatePlate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  const id = typeof body?.id === 'string' ? body.id : '';
  const publicCode = typeof body?.publicCode === 'string' ? body.publicCode : '';
  if (!id || !publicCode) {
    return jsonResponse({ ok: false, error: 'id_and_public_code_required' }, 400);
  }
  const now = new Date().toISOString();
  const result = await env.DB
    .prepare(
      `UPDATE keeper_pieces
          SET plate_status = 'active', plate_activated_at = ?1
        WHERE id = ?2 AND public_code = ?3 AND plate_status = 'generated'`,
    )
    .bind(now, id, publicCode)
    .run();
  if (!result.meta?.changes) {
    return jsonResponse({ ok: false, error: 'plate_not_generated' }, 409);
  }
  return jsonResponse({ ok: true, id, publicCode, plateStatus: 'active', activatedAt: now });
}
```

The POST response plate object must be:

```js
recoveryCode: lineageCode,
piece: {
  id: pieceRowId,
  pieceId,
  editionNumber,
  registeredAt: nowIso,
},
plate: {
  publicCode: plate.publicCode,
  publicUrl: plate.publicUrl,
  frontFilename: plate.frontFilename,
  backFilename: plate.backFilename,
  manifestFilename: plate.manifestFilename,
  frontSvg: plate.frontSvg,
  backSvg: plate.backSvg,
  frontSha256: plate.frontSha256,
  backSha256: plate.backSha256,
}
```

The existing `recoveryCode` response field remains for compatibility, but the
admin interface and physical artifact label it **Lineage Code**. The D1 column
remains `recovery_code_hash` in this focused migration to avoid a destructive
table rewrite; its meaning is documented as the permanent Lineage Code verifier.

- [ ] **Step 5: Run the admin registration tests**

```bash
npm run test:unit -- --test-name-pattern="admin piece registration|fabrication package|permanent codes"
```

Expected: PASS. GET responses contain `publicCode` and `plateStatus` but contain no Lineage Code, digest, or SVG body.

- [ ] **Step 6: Commit the persistence layer**

```bash
git add migrations/010_artwork_plate_identity.sql functions/api/admin/pieces.js tests/living-legacy.test.ts
git commit -m "feat(lineage): persist physical plate identity"
```

### Task 3: Resolve new permanent artwork QR codes on Adrian Rasmussen

**Files:**
- Modify: `functions/qr/[number].js`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Write failing resolver tests**

Add tests for these exact cases:

```ts
it('resolves an issued AR code through D1 to its artwork instance', async () => {
  const res = await onRequest({
    params: { number: 'AR-7KQ9M2WX' },
    request: new Request('https://adrianrasmussen.com/qr/AR-7KQ9M2WX'),
    env: { DB: plateLookupDb({ piece_id: 'UL-100', edition_number: 2 }) },
  });
  assert.equal(res.status, 302);
  assert.equal(
    res.headers.get('location'),
    'https://adrianrasmussen.com/works/UL-100?instance=AR-7KQ9M2WX&edition=2&ref=qr',
  );
});

it('returns 404 for an unknown AR code instead of inventing a work route', async () => {
  const res = await onRequest({
    params: { number: 'AR-7KQ9M2WX' },
    request: new Request('https://adrianrasmussen.com/qr/AR-7KQ9M2WX'),
    env: { DB: plateLookupDb(null) },
  });
  assert.equal(res.status, 404);
});

it('preserves every legacy QR redirect', async () => {
  assert.equal((await qr('1')).headers.get('location'), 'https://mandalacodes.com/oracle/universal-language/1?ref=qr');
  assert.equal((await qr('oracle')).headers.get('location'), 'https://mandalacodes.com/oracle/universal-language?ref=qr');
  assert.equal((await qr('UL-100')).headers.get('location'), 'https://adrianrasmussen.com/works/UL-100?ref=qr');
});
```

- [ ] **Step 2: Run the resolver tests and confirm failure**

```bash
npm run test:unit -- --test-name-pattern="issued AR code|unknown AR code|legacy QR redirect"
```

Expected: FAIL because the current wildcard treats `AR-` codes as artwork IDs.

- [ ] **Step 3: Add the D1 resolution branch without changing legacy routes**

Change the handler signature to `onRequest({ params, request, env })`. After the two oracle branches and before the existing wildcard, add:

```js
if (/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
  if (!env?.DB) return new Response('Registry unavailable', { status: 503 });
  const row = await env.DB
    .prepare(
      `SELECT piece_id, edition_number
         FROM keeper_pieces
        WHERE public_code = ?1
          AND plate_status IN ('generated', 'active')`,
    )
    .bind(code)
    .first();
  if (!row) return new Response('Not found', { status: 404 });

  const origin = new URL(request.url).origin;
  const query = new URLSearchParams({
    instance: code,
    edition: String(row.edition_number || 0),
    ref: 'qr',
  });
  return Response.redirect(
    `${origin}/works/${encodeURIComponent(row.piece_id)}?${query.toString()}`,
    302,
  );
}
```

Do not validate or reroute legacy non-`AR-` artwork codes; they may already be engraved.

- [ ] **Step 4: Run resolver and full Living Legacy tests**

```bash
npm run test:unit -- --test-name-pattern="issued AR code|unknown AR code|legacy QR redirect"
npm run test:unit
```

Expected: all resolver tests pass, followed by the full current unit suite passing.

- [ ] **Step 5: Commit the permanent resolver**

```bash
git add 'functions/qr/[number].js' tests/living-legacy.test.ts
git commit -m "feat(qr): resolve physical artwork instances"
```

### Task 4: Download and activate the fabrication package from the admin desk

**Files:**
- Modify: `components/AdminPieces.tsx`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Add API-shape assertions before changing the UI**

In the admin registration tests, assert the response includes all three filenames and both SHA-256 values, and the list endpoint includes only:

```ts
{
  id,
  pieceId,
  editionNumber,
  publicCode,
  plateStatus,
  keeperBound,
  registeredAt,
  plateActivatedAt,
}
```

Explicitly assert `lineageCode`, `frontSvg`, `backSvg`, `recovery_code_hash`, `front_svg_sha256`, and `back_svg_sha256` are absent from GET output.

- [ ] **Step 2: Run those assertions and confirm the list serializer fails**

```bash
npm run test:unit -- --test-name-pattern="GET lists registered pieces"
```

Expected: FAIL until `publicCode`, `plateStatus`, and `plateActivatedAt` are added to the safe serializer.

- [ ] **Step 3: Add one-time fabrication state and downloads**

Replace the one-string `issuedCode` state in `components/AdminPieces.tsx` with:

```ts
interface IssuedPlate {
  id: string;
  lineageCode: string;
  pieceId: string;
  editionNumber: number;
  publicCode: string;
  publicUrl: string;
  frontFilename: string;
  backFilename: string;
  manifestFilename: string;
  frontSvg: string;
  backSvg: string;
  frontSha256: string;
  backSha256: string;
}

const [issuedPlate, setIssuedPlate] = useState<IssuedPlate | null>(null);
const [qaConfirmed, setQaConfirmed] = useState(false);
const [activating, setActivating] = useState(false);

function downloadText(filename: string, value: string, type: string): void {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

Build the private manifest only in browser memory:

```ts
const manifest = JSON.stringify(
  {
    schemaVersion: 1,
    publicCode: issuedPlate.publicCode,
    publicUrl: issuedPlate.publicUrl,
    artworkId: issuedPlate.pieceId,
    editionNumber: issuedPlate.editionNumber,
    lineageCode: issuedPlate.lineageCode,
    frontSvgSha256: issuedPlate.frontSha256,
    backSvgSha256: issuedPlate.backSha256,
    warning: 'PRIVATE FABRICATION FILE. Do not upload or commit.',
  },
  null,
  2,
);
```

Map the POST response into UI state without renaming the server's compatibility
field:

```ts
setIssuedPlate({
  id: d.piece.id,
  lineageCode: d.recoveryCode,
  pieceId: d.piece.pieceId,
  editionNumber: d.piece.editionNumber,
  ...d.plate,
});
```

Add buttons for:

- `Download public QR SVG`
- `Download underside SVG`
- `Download private manifest`

Add a required checkbox with this exact copy:

> I fabricated this exact plate, scanned the metal QR on a phone, confirmed the correct artwork and edition, and checked the underside Lineage Code.

Only then enable `Activate permanent plate`, which sends:

```ts
await fetch('/api/admin/pieces', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: issuedPlate.id, publicCode: issuedPlate.publicCode }),
});
```

On success, clear the one-time plaintext/SVG state and reload the safe piece list.

- [ ] **Step 4: Update the registered-piece table**

Show `publicCode`, `Generated` or `Active`, and activation date. For an active plate, render the public URL as a link. Never add a “regenerate” control for active rows.

- [ ] **Step 5: Run typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: both exit 0. The Vite build includes `/admin/pieces` without a TypeScript error.

- [ ] **Step 6: Commit the registration desk**

```bash
git add components/AdminPieces.tsx functions/api/admin/pieces.js tests/living-legacy.test.ts
git commit -m "feat(admin): download and activate lineage plates"
```

### Task 5: Physical preflight, regression verification, and first-plate rehearsal

**Files:**
- Create: `docs/lineage-plate-runbook.md`
- Modify: `README.md`
- Modify: `TODO.md`

- [ ] **Step 1: Write the operator runbook**

Create `docs/lineage-plate-runbook.md` with this exact sequence:

```markdown
# Lineage plate runbook

1. Open `/admin/pieces` while signed in as Adrian.
2. Select the exact archive artwork and physical edition.
3. Register once and immediately download the front SVG, underside SVG, and private manifest.
4. Confirm the public code is `AR-XXXXXXXX` and the manifest artwork/edition match the physical object.
5. Keep the private manifest out of source control and cloud sharing; move it to the encrypted succession vault.
6. Fabricate the front at high contrast with the four-module white quiet zone intact.
7. Attach the reversible plate without damaging original artwork material.
8. Scan the fabricated metal QR on one iPhone and one Android phone, in bright and dim light and at an angle.
9. Confirm the browser lands on `adrianrasmussen.com/works/<artworkId>` with the correct `instance` and `edition` values.
10. Flip the plate and compare every Lineage Code group with the private manifest.
11. Check the confirmation box and activate the permanent plate.
12. Scan once more after activation.
13. Photograph the mounted front and underside for the private artwork record.
14. Mark the shipping record ready only after every check passes.
```

- [ ] **Step 2: Replace the manual static-registry instruction**

Update `README.md` and `TODO.md` so newly issued `AR-XXXXXXXX` artwork plates are registered in D1 through `/admin/pieces`. Keep `data/qrRegistry.ts` documented as the permanent legacy/static registry for already printed codes and oracle redirects.

- [ ] **Step 3: Run the complete verification set**

```bash
npm run test:unit
npm run typecheck
npm run build
npx playwright test tests/e2e.spec.ts --project=chromium --reporter=list
git diff --check
```

Expected:

- Unit suite passes with the new plate, admin, and resolver tests.
- TypeScript exits 0.
- Vite production build exits 0.
- Chromium smoke suite passes.
- `git diff --check` prints nothing.

- [ ] **Step 4: Rehearse locally against Pages Functions**

Run:

```bash
npm run dev:full
```

In the local site:

1. Register a non-production test piece/edition in the local D1 database.
2. Download all three files.
3. Open both SVGs and confirm their identity values.
4. Scan the front SVG from a second phone screen.
5. Activate the local registration.
6. Confirm a second POST for the same artwork/edition returns `409 plate_active`.
7. Confirm the public QR still resolves after activation.

- [ ] **Step 5: Commit the runbook and documentation**

```bash
git add docs/lineage-plate-runbook.md README.md TODO.md
git commit -m "docs(lineage): add physical plate preflight"
```

## Deployment gate

Do not produce the first real metal plate until:

1. Migration `010_artwork_plate_identity.sql` is applied to the remote `adrian-website` D1 database.
2. The deployed admin endpoint returns the one-time package.
3. The deployed `/qr/AR-XXXXXXXX` route resolves through D1.
4. A disposable prototype plate passes the full physical runbook.
5. The production database and existing Mandala ledger are backed up.

The complete lineage-authority move from Mandala Codes to Adrian Rasmussen must receive its own reconciliation/migration plan. It is intentionally not smuggled into this shipment-critical generator build.
