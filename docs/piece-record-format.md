# The Piece Record format

`schema: "adrian-piece-record"` · `schemaVersion: 1` · frozen 2026-08-19

A Piece Record is one self-contained HTML file per physical piece. It is written
to outlive the website. A person in 80 years, holding only this file and a
browser, must be able to read everything in it, and verify that nothing in it
has been altered, with no server, no network, and no JavaScript required for
reading.

Generator: `functions/api/_lib/pieceRecord.js`. Storage:
`records/{publicCode}/{recordHash}.html` (plus a bare `.json` sibling) in the
registry R2 bucket, write-once and content-addressed. Endpoint:
`GET /api/records/:publicCode` serves the newest record.

## Hard properties

- **One file, no dependencies.** All CSS is inline. No external fonts, no
  external requests of any kind. The primary image, when present, is embedded
  as a size-capped `data:` URI (the image plumbing is a TODO hook in v1, the
  slot is reserved). Supplementary media may be referenced by relative link,
  `../media/{sha256}.{ext}`, so a copied folder of records plus a media folder
  stays whole; a missing media folder degrades to text, never breaks the page.
- **Readable with JavaScript disabled.** Every section is plain HTML. The
  optional inline verifier script only adds a "verify this record" affordance;
  the page reads identically without it.
- **Deterministic.** The same input data produces byte-identical output. The
  generator takes `generatedAt` as an argument and has no clock or randomness
  of its own.
- **Print-friendly, quiet, serif.** The site's design rules apply: no icons,
  no badges, no stickers, no em dashes (commas, periods, or "to" for ranges),
  middle dot (·) separators for inline piece details. System serif stack
  (Georgia and kin) so the file needs no font files.
- **Privacy is structural.** The record holds only what already shines. See
  "What the record may never contain" below. The generator fails closed: any
  privacy violation aborts generation, nothing partial is written.

## Sections, in order

1. **The piece** — title, artist ("Adrian Rasmussen"), series, edition label,
   year, dimensions, materials, category, description. Inline details use the
   middle dot: `Unique work · 2024 · Carved wood`.
2. **The certificate** — the resolved certificate content for the artwork
   (materials, makers, origin, techniques, year wording, edition wording,
   certificate wording, opening wording), as resolved by
   `functions/api/_lib/certificateContent.js`. Omitted cleanly when none
   exists.
3. **The light** — the claim count only, anonymous. When the piece carries a
   Founding Lights ordinal, the ordinal number is printed with no name and no
   place.
4. **The lineage** — every public lineage event, printed in sequence: the
   sequence number, the event type, the date, and the link
   `previousHash → eventHash` (full 64-hex, monospace, wrappable). The chain
   is verified by the generator before inclusion, exactly as
   `functions/api/lineage/[publicCode].js` verifies it. Included only when the
   generator is called with `includeLegacySections: true` (the caller applies
   the same launch gate the lineage endpoint applies) and the plate status is
   one the lineage endpoint would serve.
5. **What shines** — tier-1 collector words, anonymous. Words only, with the
   scope of the dream and the date it first shone. Never a name, never a city,
   never an author reference of any kind. Same `includeLegacySections` gate as
   the lineage.
6. **How to verify** — plain-language prose a person can follow with only a
   browser. Reproduced below, normatively.
7. **Footer** — the record hash, the schema name and version, the generated
   date, and the trigger that caused generation (`registration`, `activation`,
   `bind`, `transfer`, `yearly`, `contribution`, `attachment`, `on_demand`).

## The embedded canonical JSON

The full record data is embedded once, verbatim, inside

```html
<script type="application/json" id="piece-record-canonical">…</script>
```

This block is the record of authority; the visible HTML is a rendering of it.
Within the embedded text every `<` character is written as the JSON escape
`\u003c` so the block can never terminate its own script element; this escape
is invisible to JSON parsing and to canonicalization.

### Canonical form and the record hash

Canonicalization is exactly the `stable()` algorithm of
`functions/api/_lib/lineage.js`, applied to the whole record object:

1. In every object, at every depth, sort the keys lexicographically
   (Unicode code-unit order, the order `Object.keys(value).sort()` produces).
2. Leave arrays in their stored order.
3. Serialize with `JSON.stringify` and no added whitespace.

The **record hash** is the SHA-256 of the UTF-8 bytes of that canonical
string, written as 64 lowercase hex characters. It is printed in the footer
and is the file's name in storage.

### Record object shape (v1)

```json
{
  "schema": "adrian-piece-record",
  "schemaVersion": 1,
  "generatedAt": "2026-08-19T00:00:00.000Z",
  "trigger": "registration",
  "piece": {
    "publicCode": "AR-XXXXXXXX",
    "artworkId": "UL-001",
    "title": "Earth's Breath",
    "artist": "Adrian Rasmussen",
    "series": "Universal Language",
    "edition": { "kind": "unique" },
    "editionLabel": "Unique work",
    "year": "2024",
    "dimensions": "24 in",
    "materials": ["Carved wood"],
    "category": "Multidimensional Art",
    "description": "…"
  },
  "catalog": { "snapshotHash": "…64-hex…", "source": "mockData" },
  "certificate": { "…normalized certificate fields…": "…" },
  "light": { "claimCount": 1, "claimOrdinal": 47 },
  "lineage": {
    "included": true,
    "events": [
      {
        "sequence": 1,
        "eventType": "issued",
        "eventAt": "2026-08-01T00:00:00.000Z",
        "previousHash": null,
        "eventHash": "…64-hex…",
        "publicPayload": { "…": "…" }
      }
    ]
  },
  "shines": {
    "included": true,
    "entries": [
      { "words": "…", "scope": "self", "shoneAt": "2026-08-05T00:00:00.000Z" }
    ]
  },
  "media": { "primaryImage": null }
}
```

Nullable fields are written as `null`, never omitted, so the canonical bytes
of a given schemaVersion always carry the same keys. `edition` is
`{"kind":"unique"}` or `{"kind":"numbered","number":n,"size":s-or-null}`.
`catalog` and `certificate` are `null` when unavailable. When a section is
gated off, `lineage` and `shines` are `{"included": false}` and the printed
section says the living record is not yet published. `media.primaryImage` is
`null` in v1 (TODO hook); when populated it becomes
`{"dataUri": "data:image/…", "sha256": "…", "byteLength": n}` with the data
URI capped at 2 MiB.

## How to verify (normative prose, printed in every record)

The section printed in the file must say, in Adrian's quiet register, exactly
this procedure, because it is exactly what the code does:

> This file carries its own proof. Inside the page source is a block marked
> `piece-record-canonical`. Copy the text inside it. Read it as JSON. Then
> write it back out in canonical form: in every object, at every level, put
> the keys in alphabetical order, and print the whole thing as JSON with no
> spaces or line breaks. Take the SHA-256 of that text. The 64-character
> result must equal the record hash printed at the foot of this page, and
> must equal the hash in this file's name. If it does, nothing in this record
> has been changed since the day it was written.
>
> The lineage is a chain. The first event has no previous hash. Every later
> event names, as its previous hash, the event hash of the event before it.
> Read down the list and check each link. An unbroken chain means the history
> printed here is whole, in order, with nothing removed from the middle.

The optional inline verifier does the same two checks with WebCrypto SHA-256
(`crypto.subtle.digest`) and reports "verified" or the first failure. It
never fetches anything.

## What the record may never contain

Never, in any field, at any depth, under any trigger:

- birth details of any person,
- prices, amounts, or currencies,
- owner identity or email, or any name joined to a piece,
- any identity and city together; the record carries no city at all,
- the ownership code, its hash, verifier, ciphertext, or nonce,
- internal identifiers (`kp-`, `tp-`, `dream-`, `consent-`, `auth-` prefixed),
- IP addresses or user agents.

The generator enforces this with a final strip-pass over the assembled
canonical JSON. Every key at every depth is tested against the lineage privacy
pattern (`email|ip|user-agent|ownership|recovery|verifier|cipher|nonce|secret|
password|token|key`, as in `lineage.js`) extended with
`birth|price|amount|currency|city|location`. Every string value at every depth
is tested for email addresses, internal id prefixes, and IP-address shapes.
Any match throws, and the record is not generated.

## Shine semantics (the privacy core)

"What shines" holds tier-1 contributions only, under once-shone-stays-shone:

- Included: content that has ever shone (`public_shared_at` is set on the
  dream row), even if consent later changed, because other people have
  already read it and the record does not rewrite what was seen.
- Excluded going forward: content carrying an abuse-management removal mark
  (a row in `collector_shine_removals` naming the content; absence of that
  table means no removals).
- Words appear with no name, ever, including content that was shared as
  attributed on the live site. The permanent record is anonymous.

## Storage and immutability

- R2 key: `records/{publicCode}/{recordHash}.html`, with the canonical JSON
  beside it at `records/{publicCode}/{recordHash}.json`.
- Written with `onlyIf: { etagDoesNotMatch: '*' }` (write-once), then read
  back and byte-compared before being reported verified, exactly as
  `functions/api/_lib/identityBackup.js` does for identity backups.
- The `piece_records` D1 row (migration 037) is inserted only after the
  bytes verify. The table forbids UPDATE and DELETE, and a trigger pins
  `r2_key` to `records/{public_code}/{record_hash}.html`.
- Catalog metadata is snapshotted append-only into
  `artwork_catalog_snapshots` (migration 035) via
  `functions/api/_lib/catalogSnapshot.js`, so the record's `catalog`
  reference stays resolvable even after the live catalog changes.

## Versioning

`schemaVersion` is frozen at 1. Any change to the canonical shape, the
canonicalization, or the hash procedure requires `schemaVersion: 2` and a new
section in this document. Existing records are never regenerated in place;
new records are new files under new hashes.
