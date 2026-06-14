# Move the art site's customer login from Clerk to a self-owned system

Plan for swapping the customer-account login on adrianrasmussen.com from the
hosted vendor (Clerk) to a self-hosted login that lives in the site's own
database. This is the "prove it on one property first" step from the identity
direction: `../i64os/substrate/directions/identity.md`.

**Why this site first:** its login code is the most self-contained of the four
properties, and it has no real signed-up customers yet — so the switch is clean.
Do NOT start this on the oracle or tea shop until it is proven here.

**Library:** Better Auth, which now takes the site's existing database directly
with no special adapter. Sign-in with Google and Apple (no passwords stored).

---

## The good news: the login is already walled off behind one seam

Every part of the site that cares about "is someone signed in" reads from a
single shared shape (the `AccountState` the rest of the app consumes), not from
the vendor directly. So most of the app does not change — only the thing that
fills that shape changes. Concretely, the vendor only appears in:

- **4 front-end files** — the sign-in/profile button, the save-to-collection
  button, the save-your-order prompt, and the provider that wires sign-in state
  into the rest of the site.
- **1 back-end file** — the helper that checks "is this request from a signed-in
  user." All 16 protected features call that one helper, so they only change if
  its answer shape changes.

That containment is what makes this a few-days job, not a rewrite.

---

## Order of work

### 1. Stand up the new login system (no UI swap yet)
- Add Better Auth, pointed at the site's existing database.
- Turn on Google and Apple sign-in (register the two apps, put their secrets in
  the site's secret store — never in the code).
- It creates its own small set of tables for people and their sign-in sessions.
- Verify in local testing that a person can sign in with Google and a session is
  created. Nothing on the live site changes yet.

### 2. Re-point the "is this user signed in?" check
- Rewrite the single back-end helper so it validates the new system's session
  instead of the vendor's token.
- Because all 16 protected features call this one helper, they all switch over
  at once with no per-feature edits. Spot-check a few (cart, collections,
  orders) in local testing.

### 3. Re-point the front-end sign-in state
- Rewrite the provider so it fills the same shared "signed-in" shape from the new
  system. The rest of the site keeps reading that shape and does not change.

### 4. Rebuild the four pieces of visible login UI
This is the bulk of the hands-on work, because the vendor gave these for free:
- The header sign-in / account button.
- The sign-in screen itself (Google + Apple buttons).
- The save-to-collection button's signed-out prompt.
- The save-your-order prompt after checkout.
Match the site's look (paper / wood / bronze, the existing serif + label fonts).

### 5. Adjust the person-record so it is keyed on the new system
- Today every customer record (orders, profile, saved collections) hangs off a
  vendor-issued ID. Re-point those to the new system's person ID.
- **No real customers exist yet, so there is no data to move** — this is a
  schema change, not a data rescue. (After launch it would be the hard part;
  this is exactly why we do it now.)

### 6. Open the door for the new system
- Update the site's security headers to allow the new sign-in system (the same
  kind of allow-list edit that was just done for the vendor). Remove the vendor
  from that list once it is gone.

### 7. Remove the vendor
- Delete the vendor's packages and the now-dead provider/token code.
- Confirm the whole sign-in → save → see-your-orders flow works end to end in
  local testing, then on a preview before going live.

---

## What to verify before calling it done
- Sign in with Google, then with Apple — both create a working session.
- Save a piece to a collection while signed in; see it in the account area.
- Place a test order, then see it under "your orders."
- Sign out everywhere clears access.
- No security-header errors in the browser console on any page.

## Rough size
A few focused days. Most of it is rebuilding the four bits of login UI; the
behind-the-scenes swap is small because of the single seam. The payoff is
ownership and one identity across the stack — not a new visible feature.

## Cross-stack note
Once proven here, the same move applies to the oracle and tea shop, but each has
its own real-customer question. Keep the unified identity goal in the direction
doc, not copied into each project's plan.
