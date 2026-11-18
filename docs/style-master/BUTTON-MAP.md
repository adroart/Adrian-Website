# Button map: every old button style to its master variant

The 2026-11-18 UI audit (`~/builds/ui-audit-2026-11-18/Adrian-Website/REPORT.md`)
found 715 controls rendering 98 computed style signatures. Those 98 are spacing and
colour variations of the 45 visual styles below (the audit's `buttons-all.png`). Each
one now belongs to exactly one variant in `src/master.css`.

**Done** means the code now reads the master variant. **Mapped** means the target is
decided and the file is on the migration list; the guard test
(`tests/style-master-guard.test.mjs`) stops the count from rising until it moves.

| ID | Old style | Master variant | Status | Where |
|---|---|---|---|---|
| P01 | Hero outline | `.btn-outline` on `.dark-preserve` | Done | Hero.tsx |
| P02 | Solid dark compact | `.btn-primary` | Mapped | Creations.tsx |
| P03 | Solid dark wide | `.btn-primary` | Done | Inquire.tsx |
| P04 | Solid dark full width (52px) | `.btn-primary .btn-block` | Done | PieceConfigurator.tsx (4) |
| P05 | Solid dark with arrow | `.btn-primary` | Done | NotFound.tsx |
| P05b | Solid dark | `.btn-primary` | Done | WorksPage.tsx (2) |
| P06 | Outline load-more | `.btn-outline` | Done | Creations.tsx |
| P07 | Outline filter chip | `.chip` | Done | Creations.tsx (Available toggle + 4 outline actions) |
| P08 | Underline text CTA | `.btn-ghost` | Mapped | Home.tsx |
| P09 | Text link, tight tracking | `.btn-ghost` | Mapped | Creations.tsx |
| P10 | Text link with arrow | `.btn-ghost` | Mapped | Home.tsx |
| P11 | Back link | `.btn-ghost` | Mapped | NotFound.tsx |
| P12 | Top nav link | keeps its own style (navigation, not a button) | Exempt | Navigation.tsx |
| P13 | Header Sign in | keeps its own style (header control) | Exempt | account/AuthButton.tsx |
| P14 | Header Night toggle | keeps its own style (header control) | Exempt | Navigation.tsx |
| P15 | Writings tab on dark bar | `.tab` | Mapped | Writings.tsx |
| P16 | Round play, filled | `.btn-icon .btn-primary` | Mapped | PoetryTrack.tsx |
| P17 | Round play, outline | `.btn-icon` | Mapped | Poetry.tsx |
| P18 | Footer circle icon | `.btn-icon` | Mapped | Footer.tsx |
| P19 | Ghost icon + text (Save) | `.btn-ghost` | Mapped | account/SaveToCollectionButton.tsx |
| P20 | Choice card | `.choice` (card, not a button; next PR) | Mapped | Inquire.tsx |
| P21 | Invoice Print/PDF | `.btn-outline` | Mapped | PublicInvoice.tsx |
| P22 | Return to top | `.btn-ghost` | Mapped | shared/LongformElements.tsx |
| A01 | Login Sign in | `.btn-primary .btn-block` | Mapped | AdminLogin.tsx |
| A02 | Forgot password | `.btn-ghost` | Mapped | AdminLogin.tsx |
| S01 | Studio-sales default | `.btn-outline` geometry | Done | StudioSalesControls.css |
| S02 | Studio-sales primary | `.btn-primary` | Done | StudioSalesControls.css |
| S03 | Full-width "Selected" | `.chip` (selected state) | Done | AdminInvoices.tsx via StudioSalesControls.css |
| S04 | Pricing tab (lower case) | `.chip` | Done | PricingCalculator.tsx via StudioSalesControls.css |
| S05 | Pricing chip | `.chip` | Done | PricingCalculator.tsx via StudioSalesControls.css |
| S06 | Certificates pager | `.btn-outline` geometry | Done | CertificateEditor.css |
| A03 | Registry outline, quiet | `.btn-outline` | Done | AdminPieces.tsx, AdminPlateWizard.tsx, admin/Rehearsal.tsx |
| A04 | Registry outline, bronze | `.btn-primary` | Done | AdminPieces.tsx, AdminPlateWizard.tsx, admin/Rehearsal.tsx |
| A05 | + New viewing | `.btn-outline` | Done | AdminViewings.tsx (4 buttons) |
| A06 | Maintenance primary | `.btn-primary` | Done | AdminMaintenance.tsx (CSS deleted) |
| A07 | Maintenance quiet | `.btn-outline` | Done | AdminMaintenance.tsx (CSS deleted) |
| A08 | Cream full-width fill | `.btn-primary .btn-block` | Done | AdminPoetry.tsx (2), AdminFileUpload.tsx |
| A09 | Glow pill "Begin" | `.btn-primary` | Mapped | registry/kit.tsx |
| A10 | Underline tab | `.tab` | Done | admin/ArtworkList.tsx |
| A11 | Certificate tab | `.tab` geometry | Done | CertificateEditor.css |
| A12 | Action tile | stays a tile, 112px to 64px tall | Done | src/index.css `.admin-action-card` |
| A13 | "Try again" as plain text | `.btn-outline` | Mapped | AdminDashboard.tsx |
| A14 | Sidebar link | stays a nav link, 40px to 30px | Done | src/index.css `.admin-nav-group a` |
| C01 | Collector pill | `.chip` | Mapped | collector/ui.tsx |
| C02 | Collector choice card | `.choice` (next PR) | Mapped | collector/ui.tsx |
| C03 | Collector row disclosure | keeps its own style (a row, not a button) | Exempt | collector/ui.tsx |

Also moved in this PR: admin artwork invitations (`.btn-outline`), artwork list
primary and Clear (`.btn-primary`, `.btn-ghost`), the plate wizard's "which copy"
toggle (`.chip`).

## Migration order for what is left
1. Public ghost links (P08 to P11, P19, P22): one class each.
2. Icon buttons (P16 to P18).
3. Writings tabs (P15).
4. AdminLogin, AdminDashboard, registry/kit.
5. Collector and ceremony inline styles last (`ceremony/tokens.ts` holds 90 raw colours).

Each step: change the markup, run `node --test tests/style-master-guard.test.mjs`,
lower the ceilings it prints to the new counts.
