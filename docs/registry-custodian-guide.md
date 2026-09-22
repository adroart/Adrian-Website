# The Successor's Handbook

A plain guide for the person who carries Adrian Rasmussen's artwork registry
after him. You do not need to be technical to use most of it. Read it once,
slowly, then keep it with the files it describes. Where it asks for help from
a technical person, one afternoon of ordinary web work is enough.

## What this is

**The registry.** The registry is the permanent record of Adrian Rasmussen's
artworks. Every registered piece has one public code, printed on the piece and
in its files, that looks like `AR-XXXXXXXX`. That code names the piece forever.
The registry remembers what each piece is, who has kept it, and everything that
has happened to it, in order, with nothing erased.

**A piece record.** A piece record is one complete web page for one piece. It
lives in the `records/` folder, one file per public code. Each file opens in
any web browser, on any computer, with no internet connection, and carries its
own proof: instructions printed inside the page let anyone check that the
record has not been altered since the day it was written. These files are made
to outlive the website.

**The ledger.** The ledger is one file, `registry-ledger.jsonl`, that lists
every registry event as one line, and each line is chained to the one before
it. If anyone changes or removes a line, the chain breaks and a simple check
says so. The ledger contains no secrets. It is safe to show, to copy, and to
keep in Google Drive.

**The encrypted archive.** The archive is one file,
`registry-private-recovery.json`, that holds the complete private registry:
every piece, every keeper association, every private note, and the sealed
Ownership Code envelopes. It is encrypted. Without the passkey it is a locked
box that reveals nothing, so it is safe to store as a file. With the passkey,
it can rebuild the entire registry from nothing.

**How they fit.** The records are for reading. The ledger is for checking.
The archive is for rebuilding. The passkey opens the archive. Hold all of
them, in the way the next section describes, and the registry cannot be lost.

## The two levels of custody

### Level one, hold it

This level asks almost nothing of you, and it alone preserves everything.

Keep one folder, safe and copied, containing:

- `records/` , the piece record pages, one per piece
- `media/` , the photographs and files the records refer to
- `registry-ledger.jsonl` , the chained ledger
- `registry-private-recovery.json` , the encrypted archive
- `successors-handbook.html` , this guide, readable in any browser

And keep one passkey, described in the next section, stored somewhere else.

That is the whole duty. The folder plus the passkey preserve every piece,
every record, and every code, forever, offline, at no cost. Keep the folder in
at least two places, for example one copy at home and one in the Google Drive
mirror or on a second drive. When Adrian, or whoever runs the system, hands
you a newer folder, keep the newer one and do not throw away the older one
until the newer one is safely copied.

### Level two, run it

This level keeps the website and registry alive on the internet. It is
optional. If it ever becomes too much, fall back to level one and nothing of
substance is lost.

The accounts that matter:

- **Cloudflare.** One account runs the website (Pages), the registry database
  (D1), and the private file storage (R2). At this scale the Pages hosting is
  on the free tier and the database and storage cost cents per month.
- **The domain registrar.** The account where `adrianrasmussen.com` is
  registered. The yearly domain renewal, usually ten to twenty dollars, is the
  main recurring cost of the whole system. If the domain lapses, the printed
  QR codes stop resolving, so this renewal is the one bill that matters.
- **Google Drive.** The account holding the mirror folder. The website writes
  the ledger and the records archive there automatically. The mirror is a
  public-safe copy, not the private archive. It fits easily in free storage.
- **The email provider.** The account behind the administrator sign-in email.
  Losing it makes signing in to the admin pages harder, so keep it renewed
  and recoverable.

The routine duties, honestly stated:

- Keep the domain renewed. Turn on auto-renewal if the registrar offers it.
- Glance at the Google Drive mirror now and then, and confirm the ledger and
  records files are still updating.
- A few times a year, and after any new registration, sign in to the admin
  pages, download a fresh encrypted archive and a fresh ledger, and refresh
  the held folder from level one.

The admin page also has **Rebuild all records**. This is a manual repair tool,
not a yearly task and not the annual record snapshot. It rebuilds at most 25
permanent Piece Records at a time. Choose **Continue rebuild** until the page
says the rebuild is complete. A failed piece remains named in the
result; use **Retry failed records** after fixing the reported storage or data
problem. Do not start the rebuild over to hide a partial page. The separate
annual snapshot records a year in a piece's life and must not be replaced by
this repair operation.

That is all. The system was built so that running it costs little money and
less attention.

## The passkey

The passkey is one passphrase. It opens one small file, the custody envelope,
which holds the internal keys the archive needs. One passphrase, one envelope
file, and the folder above: that is everything a museum or a family member
needs to take the registry on.

The passphrase is a generated phrase of random words, the kind drawn by dice
from a word list. It is written by hand on paper, twice, and each paper copy
is sealed.

Where the passkey is kept, filled in by hand by Adrian:

- Written and sealed at: ______________________________________
- A second sealed copy at: ____________________________________

The envelope file itself, named like `custody-envelope.json`, is kept with the
archive folder or alongside it.

The one absolute rule: **the passkey and the files must never be stored in
the same place.** Not in the same drawer, not in the same account, not in the
same cloud service. Whoever holds both at once holds the entire registry, so
they travel separately and rest separately, always.

## How to restore everything from nothing

Suppose every account is gone and only the held folder, the envelope, and the
passkey remain. This is the path back. A technical helper can follow it in an
afternoon using this project's code from its repository, or a packaged copy of
it, on any ordinary computer with Node.js installed.

First, prove the files are intact:

```
npm run ledger -- verify registry-ledger.jsonl
```

This checks the chained ledger and reports that the chain is whole. If you
hold an older and a newer ledger, compare them:

```
npm run ledger -- diff older-ledger.jsonl newer-ledger.jsonl
```

Added lines on the newer file are normal growth. Removed or changed lines mean
something was altered, so stop and investigate before going further.

Second, prove the passkey opens the envelope, without exposing anything:

```
npx tsx scripts/custody-envelope.ts open --check custody-envelope.json
```

It asks for the passphrase and reports only which keys the envelope holds,
never their values.

Third, when actually restoring, let the envelope write the recovery key file,
a small two line file the restore tool reads:

```
npx tsx scripts/custody-envelope.ts open --recovery-key-file registry-recovery.key custody-envelope.json
```

Fourth, turn the encrypted archive into a database restore file:

```
npm run ledger -- restore-sql registry-private-recovery.json registry-recovery.key restore.sql
```

The tool authenticates the archive, refuses anything damaged or incomplete,
and writes `restore.sql`. That file contains the decrypted registry, so treat
it as private, use it promptly, and delete it when done.

Fifth, rebuild the online home. A fresh Cloudflare account needs what the
project's `wrangler.toml` names: a Pages project built from this repository, a
D1 database bound as `DB` with every migration in `migrations/` applied in
order, and two R2 buckets bound as `ARTWORK_REGISTRY_BACKUP` and
`MUSIC_BUCKET`. Apply `restore.sql` to the new, empty, fully migrated
database, never to one that already has registry rows in it; the restore
refuses a non-empty target on purpose. Copy the held `media/` files back into
the private bucket. Then set the secrets the admin endpoints ask for, point
the domain at the new Pages project, and scan one piece's QR code to confirm
it resolves.

The order matters: verify the ledger, open the envelope, write the key file,
generate the restore, migrate the empty database, restore, then reconnect the
domain. Delete the key file and `restore.sql` when the restore is confirmed.

**The test drill.** Once a year, or whenever custody changes hands, walk steps
one through four with the real held files and a scratch database that is
thrown away afterward. Never aim a restore at the live system. A drill that
ends with a working scratch copy is proof the succession works. A drill that
fails is the best possible time to find out.

## How to reveal an Ownership Code for a collector who lost theirs

Each piece's keeper holds a private Ownership Code. If a keeper loses theirs,
the administrator can reveal it:

1. Sign in to the website with the administrator account.
2. Open the admin pieces page and complete the registry unlock, the short
   extra confirmation the sensitive pages require.
3. Find the piece by its public code and choose **Reveal Ownership Code**.
4. Read the code to the keeper privately, or hand it over in person. Confirm
   you are speaking with the verified keeper first.

The revealed code appears on screen only. Every reveal is recorded in the
registry's audit history. This is normal creator access, not an emergency
measure, but it is private: never send an Ownership Code over a public
channel or write it where others can read it.

## What must never be done

- **Never publish the private archive.** `registry-private-recovery.json` is
  safe only while it stays private. Do not post it, share it, or place it in
  the public Drive mirror.
- **Never put the passkey online.** Not in email, not in notes apps, not in a
  password manager that syncs, not in a photo. Paper, sealed, in the named
  places.
- **Never delete retired key versions.** Old archives stay readable only
  while the keys that sealed them survive. Keep every key version the
  envelope holds, forever.
- **Never edit the ledger by hand.** The ledger proves itself by its chain.
  An edited ledger is a broken ledger. If something is wrong, record a
  correction through the system; do not rewrite history.

## Whom to contact

Filled in by hand by Adrian, and kept current:

- Family contact for the registry: ______________________________
- Technical helper who knows this system: _______________________
- Where the code repository lives: ______________________________
- Registrar and Cloudflare account recovery notes are kept at: ___
- Anything else the next custodian should know: _________________

If every contact fails, this handbook, the held folder, and the passkey are
still enough. That is what they were made for.
