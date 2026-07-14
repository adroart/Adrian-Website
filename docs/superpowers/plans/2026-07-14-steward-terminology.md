# Steward Terminology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make “steward” the sole product term for the person currently caring for an artwork, while preserving legacy storage and API compatibility.

**Architecture:** Product language, interface labels, public lineage events, customer messages and authoritative documents use “steward.” The automated claim process is called the “claim scheduler,” and the infrastructure-preservation role remains the “registry custodian.” Existing identifiers such as `keeper_pieces`, `keeper_user_id` and `/api/keeper/*` remain unchanged until a separately versioned migration can preserve deployed clients and records.

**Tech Stack:** React, TypeScript, Cloudflare Pages Functions, Node test runner, Python `python-docx`, OOXML render and accessibility audit tools.

---

### Task 1: Protect the public terminology with failing tests

**Files:**
- Modify: `tests/public-lineage-history.test.ts`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Change the public lineage expectation first**

```ts
assert.equal(formatLineageEventLabel('first_bound'), 'First steward registered');
```

- [ ] **Step 2: Change contested-claim message expectations first**

Assert that public error text contains `current steward` and does not contain the standalone word `keeper`.

- [ ] **Step 3: Run the focused tests and verify the terminology assertions fail**

Run:

```bash
npx tsx --test --experimental-test-module-mocks tests/public-lineage-history.test.ts
npx tsx --test --experimental-test-module-mocks tests/living-legacy.test.ts
```

Expected: failures show the old public word `keeper`.

### Task 2: Replace product-facing terminology without breaking interfaces

**Files:**
- Modify: `utils/publicLineage.ts`
- Modify: `components/AdminPieces.tsx`
- Modify: `components/legacy/KeeperPanel.tsx`
- Modify: `components/legacy/PieceConstellation.tsx`
- Modify: `functions/api/keeper/bind.js`
- Modify: `functions/api/_lib/keeper.js`
- Modify: `data/qrRegistry.ts`
- Modify: `launchFlags.ts`

- [ ] **Step 1: Update visible labels and messages**

Use `steward`, `current steward`, `first steward` and `stewardship` in every string shown to a visitor, claimant or administrator.

- [ ] **Step 2: Update semantic component names and comments**

Rename local product concepts such as `KeeperStatus` to `StewardStatus`. Retain exact legacy route, table, column and response-key names where changing them would break compatibility.

- [ ] **Step 3: Remove em dashes from every customer-facing string touched by this change**

Use a period, comma, colon or parentheses instead.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run the two commands from Task 1. Expected: both commands exit successfully with zero failures.

### Task 3: Establish “steward” in the authoritative written system

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-complete-artwork-registry-design.md`
- Modify: `docs/superpowers/specs/2026-07-13-artwork-plate-generator-design.md`
- Modify: `docs/lineage-plate-runbook.md`
- Modify: `docs/Artwork Registry - A Living Lineage.docx`

- [ ] **Step 1: Replace the human role throughout product prose**

Use `steward` and `stewards`. Rename the automated “registry steward” to `claim scheduler`. Keep `registry custodian` for infrastructure continuity.

- [ ] **Step 2: Document the compatibility boundary**

Add this explicit rule to the primary specification:

> Steward is the only product term for the current registered person. Legacy implementation identifiers containing `keeper` remain private compatibility details and must never appear in customer-facing copy.

- [ ] **Step 3: Update the long DOCX in place without changing its visual structure**

Replace formatted run text case-sensitively (`keeper` to `steward`, `Keeper` to `Steward`, plurals included), then render every page.

- [ ] **Step 4: Verify the long DOCX**

Run the DOCX renderer and accessibility audit. Expected: all pages render without clipping and the audit reports zero findings.

### Task 4: Create the one-page collector-facing explanation

**Files:**
- Create: `docs/Artwork Registry - A Living Lineage - Collector Guide.docx`

- [ ] **Step 1: Build a one-page collector note**

Use no more than 300 words. Explain the offering, the artwork’s living lineage, what the steward receives, optional contributions, privacy and continuity. Mention the physical plate in one sentence. Exclude QR generation, hashes, claim schedules, administrator roles, backups and implementation details. Use no em dashes.

- [ ] **Step 2: Render and inspect the single page**

Expected: one page, readable at print size, no overflow, no dense technical blocks.

- [ ] **Step 3: Run the accessibility audit**

Expected: zero high, medium or low findings.

### Task 5: Full verification and commit

**Files:**
- Verify all files above.

- [ ] **Step 1: Scan product-facing sources**

Confirm no standalone `keeper` appears in visible JSX strings, public API messages, public lineage labels or the two delivered DOCX files. Confirm no em dash appears in the collector guide.

- [ ] **Step 2: Run full verification**

```bash
npm run typecheck
npm run test:unit
npm run build
```

Expected: all commands exit successfully.

- [ ] **Step 3: Review the staged diff and commit**

```bash
git diff --check
git commit -m "refactor: make steward the artwork relationship term"
```
