# Artist-Verified Sales and Collector Reconnection

**Date:** 2026-08-10

**Status:** Approved design

**Phase:** Collector journey Phase 3, sale door

## Purpose

Give Adrian a private, permanent place to reconstruct past and present art sales, including sales
where he remembers the collector but cannot yet identify the artwork. The workflow supports a
personal email reconnection, later artwork identification, optional invitation, and a truthful
certificate record without making registration compulsory.

This is a registry input built around artist verification. Commerce systems may propose records in
the future, but no payment provider or email message can decide which artwork moved.

## Fixed rules

- One sale can contain any number of artworks.
- A sale and its artwork history persist even if no artwork is ever registered or claimed.
- Registration and invitation remain explicit later actions. Recording a sale does neither.
- Adrian is the only authority that can connect an uncertain sale or collector to an exact artwork.
- Personal email is sufficient for the first release. There is no inbox sync, automated
  conversation thread, or inbound-email parser.
- Sale facts, buyer identity, correspondence, references, notes, and prices are private.
- Creator messages and selected authenticity pictures remain sealed while an artwork is unclaimed.
  Claiming makes those selected ledger entries public.
- Prices never become public. Adrian and the current logged-in keeper can see the artwork's complete
  historical price ledger. Former keepers lose private access after transfer.
- A collector-submitted picture remains private identification evidence unless Adrian deliberately
  promotes it as the artwork's certificate image.
- Public and hashed lineage contain no buyer identity, price, correspondence, private reference, or
  private media location.
- Corrections append. Historical facts and ledger entries are not silently overwritten or deleted.

## Domain model

### Reconnection case

A private case begins with as little as a collector email and Adrian's note about what he remembers.
It may remain unresolved indefinitely and may eventually resolve to one or several artworks.

The case records status, recipient email, optional name, Adrian's private context, when contact was
initiated, and append-only progress notes. The ordinary email conversation remains in Adrian's
email. He records only the facts and media that belong in the art system.

Future email-to-record automation must feed this same case boundary. It may add proposed material,
but it may not identify artwork, create public history, register a piece, invite a keeper, or change
ownership without Adrian's confirmation.

### Verified sale

A private sale header records:

- Sale occurrence with precision of exact date, month, year, or unknown
- The separate time Adrian entered and verified it
- Buyer email when known
- Currency and optional private total
- Optional source reference and private notes

Unknown historical facts stay unknown. The system never invents dates, prices, editions, or
artwork matches.

### Sale artwork entry

Each sale contains one or more artwork entries. An entry can begin unresolved, point to a catalog
artwork without a registered identity, or point to an exact registered instance. It records an
optional private artwork price. Shared and artwork-specific creator messages are separate permanent
ledger entries, so Adrian can add them at any time without editing the sale fact.

An unresolved entry may hold private identification pictures and observations. Adrian can later
resolve it to an existing catalog artwork, create the missing catalog artwork, and then register an
exact instance when he is ready to invite the collector.

Resolution is audited. A later correction supersedes the earlier proposed match without erasing it.

### Artwork ledger entry

Adrian can append a ledger entry at any time, before or after a sale, registration, claim, or
transfer. An entry contains a message, a picture, or both. It records its actual creation time and
authenticated creator. Shared sale material can be linked to every artwork in that sale, while each
artwork can also receive specific entries.

Media has two distinct roles:

- **Identification evidence:** private, preserved as submitted, never automatically published.
- **Certificate image:** explicitly selected or uploaded by Adrian, permanently connected to the
  artwork ledger, sealed until claim, and public after claim.

Selecting a better certificate image changes the preferred display through a new ledger action. It
does not delete the prior image or collector submission.

### Historical price entry

Each verified original sale or later resale can append a currency and price to an artwork's private
ledger. A multi-artwork sale may hold a private total and optional prices for individual artworks.
Only exact artwork-level prices appear in that artwork's private certificate; a shared total is not
misrepresented as one piece's price.

The full price sequence travels with the artwork. Adrian and the current authenticated keeper can
read it. Public readers and former keepers cannot.

## Workflows

### Known multi-artwork sale

1. Adrian creates a verified sale.
2. He adds every known artwork and optional artwork-level price.
3. He saves the sale atomically.
4. He may add shared or specific ledger messages and pictures now or later.
5. For any exact registered artwork, he may explicitly create an invitation.

### Historical collector with unknown artwork

1. Adrian creates a reconnection case with the collector's email and optional personal context.
2. He sends a personal email through his normal email workflow and asks for a picture.
3. The collector replies by email. Adrian uploads the useful picture to the private case and records
   only the relevant facts.
4. Adrian may upload a better image and select it as the certificate image.
5. He resolves one or several artwork entries when identification is sufficient.
6. If an artwork lacks a permanent identity, he explicitly registers it.
7. He explicitly creates the standard artwork-specific invitation.
8. The collector may claim immediately, years later, or never. The case and sale remain intact.

### Claim and reveal

Claiming uses the existing governed artwork-specific proof flow. It does not rewrite the sale or
ledger. After the claim commits:

- selected creator messages and certificate images become public on the artwork record and public
  certificate;
- the logged-in current keeper gains the private historical price ledger;
- buyer details, correspondence, source references, private notes, shared totals, and identification
  evidence remain private.

### Later resale

Adrian records another verified sale against the existing artwork. The new price appends to the
private historical ledger. The sale record does not change keeper authority. Ownership moves only
through the existing governed transfer operation, and the next keeper receives private price-ledger
access only after that transfer commits.

## Administrator experience

The private workspace has three connected areas:

1. **Reconnections:** unresolved collectors, personal-email status, private pictures, possible
   matches, and next action.
2. **Verified sales:** past and present sale headers, multiple artwork entries, dates with explicit
   precision, private prices, and correction history.
3. **Artwork ledger:** permanent messages, identification evidence, certificate-image selection,
   price history, registration state, invitation state, and claim state.

Backlog tools include Save and add another, reuse of shared buyer and date facts, several artworks
per sale, and filters for unresolved, identified, unregistered, ready to invite, invited, and
claimed. The interface never implies that saving one state caused the next.

## Failure and integrity boundaries

- Multi-artwork sale creation is atomic.
- Every write uses an exact idempotency request so an ambiguous retry cannot duplicate or change a
  sale, line, ledger entry, media selection, or invitation.
- Media is durably backed up and verified before its ledger entry becomes final. An orphaned upload
  after a later database failure is safe to retain and reconcile.
- Identification, registration, invitation, claim, and transfer are separate state transitions.
- Public projection requires an exact claimed artwork and explicit public ledger selection.
- Private price projection requires the current keeper at read time and fails closed on transfer or
  uncertain identity.
- Encrypted recovery includes reconnection cases, sales, artwork entries, ledger entries, media
  references, price history, corrections, and their actor dependencies.
- Restore reproduces visibility state without publishing sealed entries or granting keeper access.

## Testing acceptance

The implementation is complete only when automated tests prove:

- one sale with several artworks;
- unknown, approximate, and exact historical sale dates;
- missing price and exact artwork-level private price;
- unresolved cases that persist without registration;
- several artworks resolved from one collector case;
- collector pictures preserved privately while a later preferred certificate image is selected;
- messages and certificate images sealed before claim and public after claim;
- prices absent from every public response and present only for Adrian or the current keeper;
- full price history after resale and immediate former-keeper access loss;
- sale recording does not register, invite, claim, or transfer;
- later registration and invitation reuse the existing governed paths;
- corrections preserve prior facts;
- ambiguous retry, partial multi-artwork write, media failure, stale identity, and transfer races fail
  safely;
- encrypted clean restore preserves the complete private and public split;
- desktop and mobile admin flows are keyboard accessible, readable, and usable with a large backlog.

## Deferred work

- Inbound email capture and email-to-record automation
- Automated artwork matching
- Commerce-generated proposed sales
- Automated reminders or pressure to register
- Public prices or public buyer identity
