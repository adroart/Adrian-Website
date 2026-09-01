# Migrations for the `adrian-website` D1 database

This directory is the **only** one that migrates this database. It is shared
with the Mandala Codes site (mandalacodes.com), whose repo used to keep its own
migrations here-but-elsewhere; they were consolidated into this directory on
2026-09-01 and removed there.

That is not tidiness. D1 records applied migrations in a `d1_migrations` journal
keyed by **filename** — not content, not repo. One database, one journal. Two
directories pointing at it means the first to use a name claims it, and the
other's file of that name is treated as already applied and skipped in silence:
no tables, no error. Both repos had a `001_init.sql` with different content, and
only one of them ever ran.

Two rules follow:

- **Never rename a migration that has been applied.** The journal matches on the
  name, so a rename makes D1 run it again — usually onto tables that already
  exist. The four files carrying `better_auth`, `rate_limit` and the two
  `mandalacodes_oracle_*` names arrived from the other repo under their exact
  names for this reason.
- **Never give this database a second migrations directory**, in this repo or
  any other.

Files whose work belongs to the Mandala Codes site say so in their name
(`NNN_mandalacodes_*.sql`), so where a table came from stays readable.
