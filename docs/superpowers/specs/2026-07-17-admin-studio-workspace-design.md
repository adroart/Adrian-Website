# Admin Studio Workspace Design

Date: 2026-07-17
Status: Approved direction

## Purpose

Turn the Adrian Rasmussen admin from eight separate tools into one dependable
studio workspace. The redesign must help Adrian see unfinished work, begin common
tasks quickly, and move between connected tools without losing context.

This work also fixes the confirmed Keystatic route crash. Client-side navigation
into `/keystatic` currently changes the number of React hooks called by
`AppInner`, which triggers React invariant 300 and the global reload screen.

## Approved Direction

The admin is a calm studio operating system: warm and recognizably connected to
Adrian Rasmussen Art, with the clarity and speed of a professional product tool.

The approved shell uses:

- a persistent grouped sidebar on desktop
- a compact menu on mobile
- an attention-first home screen
- immediate actions for recurring work
- familiar controls with restrained bronze accents
- light paper surfaces for comfortable daytime studio use

The visual reference is the approved companion mockup in
`.superpowers/brainstorm/18189-1784261982/content/admin-shell.html`.

## Information Architecture

The persistent navigation is organized around Adrian's practice, not internal
technology names.

### Home

- Studio overview
- Work needing attention
- Quick actions
- Recent work
- Complete tool directory as a secondary reference

### Artwork

- Registry and plates
- Private viewings
- Artwork stories

### Publishing

- Stories
- Poetry
- Media

### Sales

- Pricing
- Invoices

### Account

- Signed-in identity
- Return to public site
- Sign out

`Keystatic` is renamed `Stories` in all user-facing admin navigation and copy.
The underlying route and GitHub authentication boundary remain unchanged.

## Application Structure

### Stable top-level route boundary

`AppInner` must not conditionally skip hooks. Split the normal site shell and the
Keystatic shell into separate child components so each component always executes
a stable hook set.

- `AppInner` selects the site, admin, or Keystatic surface.
- The public site shell owns public SEO and scroll behavior.
- The Keystatic shell owns the editor route and its return path.
- Admin routes do not mount public navigation, generative backgrounds, cart,
  footer, or media player.

### Persistent admin shell

Use one authenticated admin layout route with nested child routes and an outlet.
Administrator verification happens once when the shell mounts. Moving between
admin tools preserves the shell, navigation, and identity rather than remounting
them on each page.

The shell owns:

- administrator verification and forbidden states
- desktop and mobile navigation
- active-route indication
- page frame and responsive content width
- account identity and sign out
- route-level recovery and useful error messaging

Individual tools own only their task content.

### Keystatic boundary

Stories remains a separate editor because it has its own GitHub authorization.
Entering Stories from admin must never crash. The transition should explain the
GitHub sign-in when needed and always provide a reliable path back to Admin.

The route remains `/keystatic` so existing deep links continue to work.

## Home Screen

The home screen is operational, not promotional.

### Needs attention

Show only actionable states that can be derived reliably from existing data.
Each row states the condition and links directly to the place where it can be
resolved. Initial candidates are:

- plates waiting for verification, activation, backup, or assignment
- fulfillment records waiting to ship
- draft private viewings
- draft, sent, overdue, or unpaid invoices

If a reliable count is unavailable, omit it rather than displaying a decorative
or stale metric.

### Quick actions

Primary starting points:

- Issue a plate
- Create an invoice
- Build a viewing
- Write a story
- Publish a poem
- Upload media

Each action opens the correct tool at the correct creation state. Where the
current screen does not support a stable creation URL, add a small route or query
contract rather than relying on fragile DOM state.

### Recent work

Show a short list only when timestamps and destinations are trustworthy. Initial
implementation may omit this section if the current APIs cannot support it
without backend expansion.

## Workflow Refinements

The redesign establishes consistent stage language without changing business
rules or ledger behavior.

### Registry and plates

Present the existing sequence clearly:

1. Issue identity
2. Verify recovery copy
3. Activate the physical plate
4. Assign fulfillment
5. Mark shipped

Dangerous or permanent actions remain explicit and require the existing account
and registry unlock protections.

### Private viewings

Use the stages Intake, Curate, Preview, and Send. Preserve all existing chart,
recommendation, and delivery behavior.

### Pricing and invoices

Pricing offers a clear `Create invoice` continuation using the existing transfer
mechanism. Invoices use Draft, Send, and Record payment as the primary stages.

### Media and poetry

After upload, Media offers `Use in poem`. Poetry uses the existing media library
and does not require Adrian to manually rediscover the file URL.

## Visual System

This is a product surface, so legibility and consistency lead.

- Use a restrained warm-neutral palette derived from paper, wood, and bronze.
- Use bronze for primary actions, active navigation, focus, and meaningful state.
- Avoid pure black and pure white.
- Use a familiar sans-serif product stack for navigation, controls, labels, and
  data. Reserve Cormorant Garamond for restrained page headings only.
- Use surface tone, spacing, and typography to establish hierarchy. Do not place
  every section inside an identical bordered card.
- Standardize buttons, inputs, selects, textareas, tabs, alerts, empty states,
  tables, and status labels across every admin tool.
- Motion is limited to 150 to 250 millisecond state transitions and respects
  reduced-motion preferences.

## Responsive Behavior

### Desktop

- Persistent sidebar with grouped navigation
- Main content can use narrow, medium, or wide page frames by task
- Dense tools such as Invoices can use the full available width

### Mobile

- Sidebar becomes a compact menu controlled by an accessible button
- Menu closes after navigation and returns focus predictably
- Minimum touch target is 44 by 44 pixels
- Form grids collapse to one column where labels or values would become cramped
- Tables use purpose-built responsive rows or horizontal containment
- No admin header content may overflow the viewport

## Loading, Empty, and Error States

- Use shell-shaped skeletons for initial administrator verification.
- A signed-out session returns to Admin sign-in with the complete intended path.
- A signed-in but unauthorized account receives a clear explanation and sign-out.
- Tool fetch failures stay inside the tool and offer Retry without losing the shell.
- Empty states explain the next action and link directly to it.
- The global error boundary must offer both Retry and Return to Admin. Development
  logs retain technical detail, but production copy stays human-readable.
- Keystatic authentication failures explain that Stories uses GitHub and provide
  a direct retry path.

## Accessibility

Target WCAG 2.2 AA.

- Every interactive element is keyboard reachable.
- Focus is visible against every surface.
- Current navigation is exposed with `aria-current`.
- Mobile navigation manages focus and Escape correctly.
- Form fields have persistent labels and associated errors.
- Status is not communicated by color alone.
- Loading and save results use appropriate live regions.
- Reduced motion is honored.

## Security and Privacy Boundaries

The redesign does not weaken or merge authentication systems.

- Better Auth and the administrator email allowlist continue to protect Admin.
- Registry step-up protection remains required for ownership-code operations.
- Keystatic continues to use its GitHub authorization boundary.
- No secret values, ownership codes, private collector data, or financial details
  are added to dashboard responses unnecessarily.
- Attention counts return the minimum data required for display.

## Testing

### Regression tests

- Navigate from Admin into Stories without a full page reload.
- Navigate from Stories back to Admin.
- Assert the global system error never appears in either direction.
- Assert direct loads of `/admin`, nested admin routes, and `/keystatic` still work.

### Shell tests

- Administrator verification occurs once while moving between nested tools.
- Signed-out and forbidden states behave correctly.
- The intended route survives sign-in.
- Active navigation and grouped links are correct.
- Sign out clears the privileged registry unlock before ending the account session.

### Dashboard tests

- Attention items link to resolvable work.
- Zero or unavailable counts do not create misleading entries.
- Quick actions open the expected creation state.
- No private record detail is exposed beyond required summary counts.

### Responsive and accessibility tests

- Desktop sidebar and mobile menu are tested at representative widths.
- No horizontal overflow occurs at phone width.
- Keyboard navigation, focus return, Escape behavior, and live regions are tested.
- Automated accessibility checks cover the shell, home, and at least one dense form.

### Full verification

- Unit tests
- End-to-end tests
- Type checking
- Production build
- Local Pages Functions smoke tests
- Preview deployment checks
- Production smoke test after approval

## Delivery Order

1. Fix the stable route boundary and add the Keystatic regression test.
2. Introduce the nested persistent admin shell and responsive navigation.
3. Replace the directory dashboard with attention and quick-action sections.
4. Standardize shared admin components and migrate each tool incrementally.
5. Refine the four connected workflows.
6. Complete accessibility, responsive, and production verification.

The first three steps deliver the largest usability gain and remove the immediate
failure. Later refinements must not delay the route repair or the usable shell.

## Out of Scope

- Changing ledger ownership rules or permanent history behavior
- Replacing Better Auth, GitHub authorization, D1, R2, or Keystatic
- Building a new analytics system
- Adding speculative dashboard metrics
- Redesigning the public Adrian Rasmussen portfolio
- Changing collector-facing account surfaces
