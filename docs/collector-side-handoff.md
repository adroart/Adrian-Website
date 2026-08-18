# Collector-side handoff — wiring the receiving experience to the registration plate

This document is the **integration contract** between the artist/registration
side (this repo, `adrianrasmussen.com`) and the **collector-facing side** being
built to receive a physical plate. It is written so the two sides connect cleanly
at the seam — the moment a collector holds the piece and scans it.

It is a general contract. If your side is a **separate app or site** it consumes
the public API below; if it is an **extension inside this repo** it renders the
same data through the existing screens; if it is a **print/offline** piece it
must still honor the immutable formats. Points that differ by consumer are marked
**[cross-app]**.

Everything here is drawn from the current code; file references are included so
either side can verify against the source of truth.

---

## 1. The mental model — two identifiers

Each physical piece carries two, and keeping them separate is the whole design:

| | **Public QR code** | **Ownership Code** |
|---|---|---|
| Looks like | `AR-7K9QMX2P` | `K7QM-9XTR-2PHV-N4WB` |
| On the plate | Front, scannable | Underside, under a panel |
| Role | Look-only. Identifies the piece, binds nobody. | The secret that **proves possession** and makes someone the steward. |
| Travels in a URL? | **Yes** (`/qr/AR-…`) | **Never.** Typed by the holder into a form only. |
| Stored as | plaintext (it is public) | SHA-256 **hash** only — plaintext is never persisted anywhere. |

**Your side picks up at the QR.** The Ownership Code is only ever *typed by the
collector into a bind form*; your side must never place it in a URL, a log, a
query string, or its own storage.

---

## 2. The physical artifact contract (immutable — treat as fixed)

Source: `utils/artworkPlate.ts`, `utils/recoveryCode.ts`, `data/qrRegistry.ts`.

- **Front QR encodes a full URL**, not a bare code:
  `https://adrianrasmussen.com/qr/AR-XXXXXXXX`
- **Public code format:** `/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/`
  (`AR-` + 8 chars from a 32-glyph alphabet with no `O 0 I 1`).
- **Underside Ownership Code:** 16 characters from the same alphabet, hyphen-grouped
  `XXXX-XXXX-XXXX-XXXX`. Normalized (hyphens/spaces stripped, uppercased) before
  hashing.
- **Plate:** 50 mm × 62 mm; QR **error-correction level Q**, quiet zone 4.
- **Permanent by contract:** the domain, the `/qr/:code` path, and the code
  formats are declared "do not change — printed/engraved QRs depend on them"
  (`data/qrRegistry.ts` header, `functions/qr/[number].js` header). Your side may
  hard-code these formats; they will not move.

> The `AR-…{8}` regex is independently declared in **six** files and must stay in
> lockstep. If your side re-declares it, copy it exactly.

---

## 3. Upstream lifecycle (what state a piece is in when it reaches a collector)

The artist side runs, before a collector ever holds the piece:
**register → mint (code + Ownership Code created) → download etch files →
engrave → activate (locks the identity) → assign to a buyer → ship.**

A piece is only scannable-to-a-record once it has a `keeper_pieces` row with a
public status. Practically, by the time a collector scans, the plate is `active`.
Your side does not perform any of these steps; it begins at the scan.

---

## 4. The handoff seam — step by step, with the exact API

### Step 1 — Scan the front QR
The QR opens `https://adrianrasmussen.com/qr/AR-XXXXXXXX`.
`functions/qr/[number].js` resolves it:
- valid `AR-…{8}` with a matching registry row → **302** to
  `/works/{pieceId}?instance=AR-XXXXXXXX&ref=qr`
- no matching row → **404**; DB down → **503**
- (`/qr/1`–`/qr/64` and `/qr/oracle` are legacy oracle plaques → redirect to
  `mandalacodes.com`; not part of the plate system.)

**[cross-app]** If your side is a separate scanner/app, you can either follow that
redirect, or read the `AR-…` code straight from the QR URL (or the printed text on
the plate) and call the API in Step 2 yourself.

### Step 2 — Verify the identity (public, unauthenticated)
```
GET https://adrianrasmussen.com/api/registry/{publicCode}
```
`functions/api/registry/[publicCode].js`. **Not gated** by any launch flag — this
is always live. Returns `200 { ok: true, identity }` where `identity` is:

```jsonc
{
  "artworkId": "UL-105",                 // /^[A-Z]{2,3}-[0-9]{3}$/
  "title": "…",                          // ≤120 chars
  "series": "Universal Language" | null, // ≤80
  "edition": {                           // one of:
    "kind": "unique",   "number": null, "size": null,        "label": "Unique work"
    // or
    "kind": "numbered", "number": 3,    "size": 10 | null,   "label": "Edition 3 of 10"
  },
  "publicCode": "AR-7K9QMX2P",
  "artistName": "Adrian Rasmussen",      // constant
  "plateStatus": "registered" | "generated" | "active" | "superseded",
  "publicProvenance": [ { "year": "2026", "event": "created", "note": "…"? } ],
  "creatorHistory": [ { "entryType": "material", "title": "…", "detail": "…"|null,
                        "role": "…"|null, "occurredAt": "…"|null } ]
  // superseded plates only:
  // "successorDisclosure": "withheld" | "disclosed",
  // "currentPublicCode": "AR-……"   (only when disclosed)
}
```
`publicProvenance[].event` ∈ `created | exhibited | sold | commissioned |
restored | transferred`. `creatorHistory[].entryType` ∈ `contributor |
creation_place | intention | material | technique | note` (a `contributor` always
carries a `role`).

Error responses: bad code → **404** `{ok:false,error:'not_found'}`; integrity
failure → **409** `identity_integrity_error`; DB down → **503**
`registry_unavailable`; non-GET → **405**.

**Deliberately absent (privacy — your side will never receive these, and must not
try to reconstruct them):** any owner/steward identity or email, the Ownership
Code or its hash, ciphertext/nonce/verifier, prices, display location, and all
internal database ids.

### Step 3 — Show the record (certificate + history)
- **Certificate of authenticity:**
  `GET /api/certificates/{artworkId}?publicCode=AR-XXXXXXXX` → `{ certificate: … }`.
  Always available (even on a direct visit) so nothing feels withheld.
- **Verified event history (lineage):**
  `GET /api/lineage/{publicCode}` → `200`:
  ```jsonc
  { "ok": true,
    "artwork": { "pieceId": "UL-105", "editionNumber": 3, "publicCode": "AR-…" },
    "events": [ { "sequence": 1, "eventType": "issued", "eventAt": "ISO",
                  "previousHash": "64-hex"|null, "eventHash": "64-hex",
                  "publicPayload": { … secret-free … } } ] }
  ```
  The chain is hash-verified server-side; a break returns **409**
  `lineage_integrity_error`. Allowed `eventType`s: `issued, activated,
  link_corrected, voided, superseded, transferred, fulfillment_*, first_bound,
  migration_baseline`. Every payload is stripped of anything matching
  `email|ip|user-agent|ownership|recovery|verifier|cipher|nonce|secret|password|token|key`.
  **Gated by `livingLegacy`** (returns 404 while the flag is off — see §7).

### Step 4 — Become the steward (the ownership handoff)
```
POST https://adrianrasmussen.com/api/keeper/bind
Body: { "publicCode": "AR-XXXXXXXX", "ownershipCode": "K7QM-9XTR-2PHV-N4WB", "note"?: "…" }
```
`functions/api/keeper/bind.js`. **Requirements:**
- A signed-in **verified-email** session (Better Auth session cookie). No email
  fallback. Unverified → **403** `verified_email_required`.
- The body must contain **only** `publicCode` + `ownershipCode` (+ optional `note`).
  Sending `pieceId`, `editionNumber`, or `recoveryCode` → **400**
  `identity_fields_forbidden`. The artwork/edition are always derived server-side
  from the code.
- **Gated by `livingLegacy`** (404 while off).

Outcomes your side must handle:

| Result | Status | Meaning / body |
|---|---|---|
| First bind (never claimed, code matches) | **200** | `{ok:true, keeper:{pieceId, editionNumber, claimedAt}}` — you are now the steward |
| Already yours (re-scan) | **200** | same shape, idempotent |
| Not registered | **404** | `not_registered` |
| Code mismatch | **403** | `code_mismatch` |
| Plate not ready (not active / backup or recovery unverified) | **409** | `plate_not_ready` / `plate_recovery_not_qualified` / `identity_recovery_not_qualified` |
| Contested — request opened | **202** | `{ok:true, status:'claim_requested', claim:{…, outcome:'opened'|'duplicate'}}` — piece already has a steward; a governed request is recorded, nothing rebinds |
| Contested — rate limited | **429** | `claim_rate_limited` |
| Contested — you are already current | **409** | `already_current_steward` |
| Concurrent bind | **409** | `bind_conflict` |

The reference client classifies these in `components/legacy/KeeperPanel.tsx`
(`classifyStewardBindResult`): 202 → *pending*, 2xx+ok → *bound*, else *error*.

**[cross-app] — the one real constraint.** The bind authenticates with **this
site's own verified-email session cookie**, same-origin to `adrianrasmussen.com`.
A collector app on a **different domain cannot** send that cookie. So a
cross-domain side has two honest options:
1. **Hand the steward step back to this site** — send the collector to
   `/works/{artworkId}?instance={publicCode}&ref=qr&claim=1` (the canonical steward
   deep link), where the built-in KeeperPanel handles sign-in + bind. Your side
   owns discovery/presentation; this site owns the authenticated bind. *(Simplest,
   recommended.)*
2. **Server-to-server bridge** — mirror the existing machine-auth HMAC pattern
   (`functions/api/_lib/claimBridge.js`) so your backend can act on a verified
   collector without forwarding a browser cookie. Heavier; only if you must keep
   the collector entirely inside your app.

---

## 5. What each side owns (responsibility boundary)

**Registration / plate side (this repo) owns:**
- Issuing the permanent `AR-…` identity and the Ownership Code, and the encrypted
  recovery of that code.
- The D1 registry, the append-only lineage chain, and the offline master ledger.
- The public API endpoints in §4 and the data they return.
- The verified-email steward bind and the governed contested-claim process.

**Collector side (what you build) owns:**
- The receiving/arrival experience, presentation, and any collector-only UI.
- Reading the `AR-…` code from the scan and **calling this side's API** for
  identity/lineage — not inventing its own identity source.
- Handing the typed Ownership Code to `/api/keeper/bind` (or the deep link) —
  **never** storing it or the code itself.

**Neither side** should duplicate the identity/lineage data model or the code
formats; both read them from this contract.

---

## 6. Invariants both sides must honor

1. **Two-identifier separation.** Public code = look, in URLs. Ownership Code =
   secret, typed only, never in a URL/log/store.
2. **Code formats are fixed.** `AR-…{8}` and artwork id `[A-Z]{2,3}-[0-9]{3}`.
   Copy the regexes exactly if you re-declare them.
3. **No personal data in public surfaces.** The public API already strips it; your
   side must not add owner names, emails, prices, or location to anything public.
4. **The URL scheme is permanent.** `https://adrianrasmussen.com/qr/AR-…` and
   `/works/:id?instance=…&ref=qr` will not change; engraved plates depend on it.
5. **Binding requires a verified email.** Possession of the code + a verified
   account is the proof; there is no bypass.
6. **A claimed code is never a bearer override again.** After anyone has ever
   bound a piece, a different claimant enters the governed 202 flow — it never
   silently rebinds.

---

## 7. Current gating & live state

`launchFlags.ts` → `livingLegacy: false` right now. That means, on the collector
side today:

- **Live regardless of the flag:** the QR resolver, `/api/registry/:publicCode`
  (identity), and the certificate. Your side can build and test against these now.
- **Gated OFF until launch:** the temple-paced arrival, public lineage history,
  the "collector field" constellation, and the **entire KeeperPanel including
  `/api/keeper/bind`** (endpoint returns 404 while off).

So: build and verify the **discovery + certificate** path against the live API
immediately; the **steward-bind** path is wired but stays dark until
`livingLegacy` is flipped on at launch. Private admin issuance can run ahead of
that via the `ARTWORK_REGISTRY_ADMIN_ENABLED` runtime variable.

---

## 8. Alignment checklist for your side

- [ ] Read the `AR-…` code from the QR URL / plate; validate it against
      `/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/` before using it.
- [ ] Fetch identity from `GET /api/registry/:publicCode`; render from that exact
      shape; handle 404 / 409 / 503.
- [ ] Never request, store, or display anything the public API omits (owner,
      email, price, location, the Ownership Code or its hash).
- [ ] For history, consume `/api/lineage/:publicCode` and expect it to be dark
      until `livingLegacy` is on.
- [ ] For stewardship, either deep-link to
      `/works/:artworkId?instance=:publicCode&ref=qr&claim=1` **[recommended]** or
      build the HMAC server bridge; require a verified-email session; send only
      `{publicCode, ownershipCode, note?}`; handle every status in §4 Step 4,
      especially the **202 contested** case.
- [ ] Treat the domain, `/qr/` path, and code formats as permanent.

---

*Source of truth for this contract:* `utils/artworkPlate.ts`,
`utils/recoveryCode.ts`, `utils/publicRegistry.ts`, `utils/publicLineage.ts`,
`data/qrRegistry.ts`, `functions/qr/[number].js`,
`functions/api/registry/[publicCode].js`, `functions/api/lineage/[publicCode].js`,
`functions/api/keeper/bind.js`, `functions/api/_lib/lineage.js`,
`components/WorksPage.tsx`, `components/collector/*`, `components/legacy/*`,
`launchFlags.ts`.
