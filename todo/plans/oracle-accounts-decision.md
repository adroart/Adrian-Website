# Decide what happens to the oracle accounts branch

A branch (`origin/claude/oracle-energy-birthdate-4HS3f`) carries sign-in, the hologenetic profile, and the today and year energy panels. The today and year cards on the live site are currently placeholders. A decision is needed.

## The two choices

1. Merge the branch into `main`, so the site gets real energy panels and sign-in.
2. Accept the placeholder state as permanent, now that the oracle work lives in mandalacodes instead.

## If merging

Mandalacodes already has its own sign-in swap merged (2026-05-28), so the choice point is whether to run two separate sign-in apps or share one. To merge: complete the provisioning steps in the implementation doc's "Adrian to provision" section, run the smoke test, then turn on `accounts: true` in `launchFlags.ts`.

## Full per-file implementation log

[docs/oracle-accounts-implementation.md](../../docs/oracle-accounts-implementation.md)
