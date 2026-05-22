# Atlas Ledger, A Note For The Person Who Comes Next

## What this is

The Atlas is the artwork ledger for Adrian Rasmussen. Every piece of his
work that has left the studio has, in this ledger, a record of where it
came to rest, in whose care it lives, and how it has moved over time. It
is a quiet, append-only chronicle, kept so that the work can be traced
across generations. If you are reading this, you are likely the person
Adrian has asked to keep this alive. The intent is that the record
outlives any single website, any single hosting account, and eventually
Adrian himself. Read this once slowly. None of it is urgent on any given
day, but all of it matters in the long run.

## What you need to access it

You will need these credentials and accounts. Adrian keeps the actual
values in his password manager, not here, on purpose. Ask his estate or
the person he named as literary executor for access.

- The Cloudflare account that owns the `adrian-website` project. The
  domain, the build pipeline, and the storage all sit under this one
  account.
- The R2 bucket named `adrian-music`. Inside it, three files under the
  `atlas/` prefix hold everything. The bucket is bound to the site code
  as `MUSIC_BUCKET`.
- The `UPLOAD_SECRET` environment variable on the Cloudflare Pages
  project. This is the admin password for adding new events.
- The public GitHub mirror repository. Adrian will write its name here
  once it exists. It is meant to be a public, read-only copy of the
  ledger that anyone in the world can clone.
- The domain registration for `adrianrasmussen.com`. Keep it renewed.

## Where the data lives

Three files in R2 under the `atlas/` prefix carry the whole system.

- `atlas/ledger.json` is the source of truth. Every event ever recorded,
  in the order it was recorded. Each entry has a hash, and each entry
  references the hash of the entry before it. That means any tampering
  with an old record will break every record after it, in a way that is
  easy to detect with a single command. Think of it as a sealed
  ribbon, not a database table.
- `atlas/stewards.json` is the private contact roster, the people who
  hold the pieces. Names, emails, hashed access keys, outreach notes.
  Never make this file public. It exists to help Adrian, or whoever
  continues his work, stay in touch with the people who carry the work.
- `atlas/public.json` is a regenerated summary of everything that should
  be visible on the website. It is rebuilt automatically from
  `ledger.json` whenever an event is appended, so you never edit this
  file directly.

There is also the GitHub mirror. After every change to `public.json`, a
copy is pushed to the public GitHub repository. GitHub itself is
archived continuously and indefinitely by the Software Heritage
Foundation, which is backed by UNESCO. That gives the ledger a free,
multi-region, permanent backup without any further effort on your part.

## How to keep it running

The maintenance burden is small. In any given year you only need to do
three things.

- Keep the Cloudflare account active and the payment method valid.
- Keep the GitHub mirror repository public. Do not delete it, do not
  switch it to private.
- Renew the domain.

If those three things stay true, the system continues to run on its
own. There is no database to back up, no server to patch.

## The annual book ritual

Once a year, on a date that means something to Adrian (he has suggested
either the solstice or the equinox, the choice is open), the public
state of the ledger should be printed and bound as a physical book.
Here is why. Cloudflare may not exist in a hundred years. GitHub may
not exist. Hard drives degrade. Paper, properly stored, has a five
hundred year track record. The book is the long memory of the project.

The ritual is simple.

- Download the current `atlas/public.json` (or visit
  `https://adrianrasmussen.com/api/atlas` and save the response).
- Lay it out as a book: one page per piece, the city it rests in, the
  date it came to rest, its history. Cormorant Garamond, restrained
  layout, the same voice as the website.
- Print at least three copies. Bind them properly, hard cover, archival
  paper, sewn binding. A local bookbinder can do this for a modest
  fee.
- Mail one copy to each known steward as a gift. Their care of the work
  is what makes the ledger meaningful, the book is a thank you.
- Deposit one copy with a library. Good candidates include the local
  artist registry, a national library that accepts artist book
  donations, and the Internet Archive's physical archive in Richmond,
  California, which preserves donated books indefinitely.

## If you need to stop maintaining it

That is allowed. The work has been arranged so that even neglect leaves
something behind. Do not delete the GitHub repository. As long as it
remains public, even untouched, the Software Heritage Foundation will
hold a copy. The website may go down, the domain may lapse, the
Cloudflare account may close, and the ledger will still exist, cloneable
by anyone in the world, for as long as that foundation exists.

## What not to do

- Never rewrite history. Every event references the one before it by
  hash. If you change a past event, every event after it becomes
  invalid, and the chain is broken in a way that cannot be repaired.
- Never deploy a code change that modifies past events. New events only.
  If something was recorded in error, the correct action is to append a
  new event that supersedes it, not to edit the old one.
- Never edit `atlas/ledger.json` by hand. Use the admin interface on the
  website. The interface computes the hashes correctly. Direct edits
  almost certainly will not.
- Never commit anything from `atlas/stewards.json` to the public mirror.
  The mirror only sees `atlas/public.json`, which is already stripped
  of private fields, but be careful if you ever automate this further.

That is the whole document. Thank you for keeping it alive.
