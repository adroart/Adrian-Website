# Atlas Ledger, Architecture Decisions

A short record of the choices behind the ledger and the reasoning that
led to each one. The intent is that a future contributor (or a future
Adrian) can read this and understand why the system looks the way it
does, without having to re-litigate the same questions.

## Why an append-only event log instead of mutable records

A piece of art moves. It is placed, it is moved, sometimes it is sold
on again, sometimes a steward asks for privacy and later changes their
mind. A row in a database that gets overwritten with each change throws
away the history. The story of how the work has travelled is itself
worth preserving, and is in many cases the more interesting record. An
append-only log keeps all of it. Current state is computed by replaying
the events, which is cheap, and is implemented once in
`utils/ledgerProjection.ts`.

## Why the hash chain (instead of just trusting the database)

The ledger is meant to be a long-lived record of provenance. That
implies a need to detect tampering, both accidental (a botched manual
edit, a corrupted file) and deliberate (a future operator quietly
altering history). Each event includes the hash of the previous event,
so any modification to a past record breaks every link after it. The
break is detectable in one pass by `verifyChain` in `utils/ledger.ts`.
This is the same primitive that backs both git and most blockchains,
without the rest of the apparatus either of them carries.

## Why JSON in R2 instead of a database

The write rate is tiny. New events happen on the order of weeks, not
seconds. A database would be more machinery than the workload demands,
would need its own backups, and would introduce a service that could
fail independently of the rest of the site. Three JSON files in R2 are
trivially diffable, trivially mirrorable, and trivially auditable. The
trade is that we cannot do partial updates or transactions, but the
write path is single-threaded (one Worker invocation per change) and
the file size is small for the foreseeable life of the project.

## Why a public GitHub mirror (and not blockchain)

The durability problem is real, the question was which solution to
adopt. Blockchain options were considered and rejected: putting actual
ledger data on chain is prohibitively expensive at scale, putting only
hashes on chain gives a timestamp but no data redundancy, and any
specific chain is a single point of failure on a longer timescale than
we are comfortable with. The GitHub mirror, by contrast, is free,
needs no wallets, and is archived continuously by the Software Heritage
Foundation (UNESCO-backed) and crawled by the Internet Archive. That
gives multi-region, multi-organisation redundancy at zero cost. The
mirror code is in `functions/api/atlas/_mirror.ts`, disabled unless
three env vars are set.

A yearly hash anchor on Bitcoin or Ethereum may be added later as a
tamper-evident timestamp, but it is not required and is not the
primary durability story.

## Why city centroids only (privacy + simplicity)

The ledger never stores street addresses or user-provided coordinates.
Every location is a curated city centroid from `data/cities.ts`,
referenced by id. This protects stewards (no one can derive a home
address from the public site), removes a category of input validation
problems, and keeps the visual language of the globe coherent. If a
piece moves to a city we have not yet catalogued, the city is added
once, then reused.

## Why steward keys instead of accounts

A collector should not need to make an account, choose a password, or
remember a username to update where a piece they own lives. They hold a
piece of paper with a key printed on it. They type the key in, the
session is bound to their specific piece, and that is the entire
authentication model. The key is high-entropy (about ninety-five bits),
generated server-side, shown to Adrian once for the certificate of
authenticity, and stored only as a SHA-256 hash. Loss of a key is
recoverable manually by Adrian issuing a new one. This is the right
shape of trust for the relationship: small, specific, polite.

## Why three audiences with different views

The visitor sees the globe and the public projection: places, dates,
pieces, no people. The steward sees their own piece and can update its
location or its visibility. The admin (Adrian) sees the whole ledger,
the steward roster, and the outreach status. Three views, three levels
of trust, one ledger underneath. Splitting them at the API boundary
(rather than the data boundary) keeps the system simple: there is one
ledger, and the three endpoints just project different slices of it.

## What is deferred to later phases

These were considered and intentionally left out of the first version,
either because they are not yet needed, or because they would add
complexity that should be earned by use first.

- Kinship threads: a way to record that two pieces are intentionally
  related (a diptych, a gift, a paired commission).
- Hexagram grid view: an alternate visual layout that lays the
  Universal Language pieces out in their I-Ching arrangement.
- Time scrubber: a UI for replaying the ledger forward in time.
- Synchronicity surfacing: highlighting cities or moments where
  several pieces converge.
- NFTs: deliberately omitted. They commit the ledger to a single chain,
  expose us to off-chain rot, remove our ability to edit or move the
  canonical record, and add wallet and gas UX that is the opposite of
  the project's voice. The only scenario where one might be considered
  is a specific collector request, and even then the in-house ledger
  remains canonical.
- Annual letter: a yearly written reflection on the year's movements,
  bound into the printed book.
- Intentions: optional, private notes from stewards on why they hold
  the piece.

Each of these is a possible addition. None of them should be added
without a concrete reason that comes from use.
