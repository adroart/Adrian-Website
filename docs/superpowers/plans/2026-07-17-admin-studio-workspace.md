# Admin Studio Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented Adrian Rasmussen admin with a persistent, responsive studio workspace and remove the client-side Keystatic route crash.

**Architecture:** Split the Keystatic and normal site shells so hook execution remains stable, then mount all `/admin` tools beneath one authenticated nested route. A minimal admin overview endpoint supplies actionable counts without exposing record details. Shared admin primitives establish one product vocabulary while existing business APIs and authentication boundaries remain unchanged.

**Tech Stack:** React 18, React Router 7, TypeScript, Tailwind CSS, Better Auth, Cloudflare Pages Functions, D1, Keystatic, Node test runner, Playwright.

---

## File Map

**Create**

- `components/admin/AdminShell.tsx`: persistent authentication boundary, desktop sidebar, mobile menu, account controls, and outlet.
- `components/admin/AdminNavigation.ts`: grouped route metadata shared by desktop and mobile navigation.
- `components/admin/AdminPage.tsx`: page frame, heading, actions, section, alert, and empty-state primitives.
- `functions/api/admin/overview.js`: private minimum-data attention counts for the home screen.
- `tests/admin-studio-shell.test.ts`: route, shell, overview, navigation, and privacy contract tests.
- `tests/admin-studio-navigation.spec.ts`: browser regression, responsive, and keyboard coverage.

**Modify**

- `App.tsx`: stable shell split, nested admin routes, and removal of public chrome from admin.
- `index.tsx`: recoverable production error boundary.
- `components/AdminDashboard.tsx`: attention-first studio overview and quick actions.
- `components/AdminLayout.tsx`: retire the per-screen wrapper after nested-shell migration.
- `components/AdminFileUpload.tsx`: shared page structure and `Use in poem` continuation.
- `components/AdminPoetry.tsx`: shared page structure and stable create-state contract.
- `components/AdminBookEditor.tsx`: shared page structure.
- `components/AdminInvoices.tsx`: shared page structure and stable create-state contract.
- `components/AdminViewings.tsx`: shared page structure and stable create-state contract.
- `components/AdminPieces.tsx`: shared page structure and explicit workflow stages.
- `components/PricingCalculator.tsx`: shared page structure and clear invoice continuation.
- `components/KeystaticRoute.tsx`: branded Stories boundary and GitHub sign-in explanation.
- `src/index.css`: admin shell tokens, focus styles, responsive behavior, and reduced motion.
- `tests/admin-auth.test.ts`: nested route return-path coverage.
- `tests/admin-registry-ui.test.ts`: preserve registry unlock and plate safety contracts.
- `tests/e2e.spec.ts`: retain public-site smoke coverage after shell split.
- `package.json` and `package-lock.json`: add `@axe-core/playwright` for automated accessibility checks.

## Task 1: Fix the Keystatic Route Crash

**Files:**

- Modify: `App.tsx`
- Create: `tests/admin-studio-navigation.spec.ts`

- [ ] **Step 1: Add the failing navigation regression**

Add this focused test to `tests/admin-studio-navigation.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('navigates into and out of Stories without the global error screen', async ({ page }) => {
  await page.goto('/');

  await page.evaluate(() => {
    history.pushState({}, '', '/keystatic');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page.getByText('System Error')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Return to Admin' })).toBeVisible();

  await page.getByRole('link', { name: 'Return to Admin' }).click();
  await expect(page).toHaveURL(/\/admin(?:\/login)?$/);
  await expect(page.getByText('System Error')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the regression and confirm the hook failure**

Run:

```bash
npx playwright test tests/admin-studio-navigation.spec.ts --project=chromium --reporter=list
```

Expected: FAIL because navigation to `/keystatic` reaches the global `System Error` boundary.

- [ ] **Step 3: Split the route shells so hooks are unconditional**

Refactor `App.tsx` to this boundary shape:

```tsx
const KeystaticShell: React.FC = () => (
  <div className="min-h-screen bg-paper-50">
    <div className="h-14 border-b border-wood-200 bg-paper-50 px-5 flex items-center">
      <Link to="/admin" className="admin-return-link">Return to Admin</Link>
    </div>
    <Suspense fallback={<div className="min-h-[calc(100vh-3.5rem)] bg-paper-50" />}>
      <KeystaticRoute />
    </Suspense>
  </div>
);

const SiteShell: React.FC = () => {
  const location = useLocation();
  const { isDarkMode } = useDarkMode();
  useSeoMeta(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Existing public, account, invoice, viewing, and nested admin routes live here.
  return <>{/* existing non-Keystatic application body */}</>;
};

const AppInner: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.pathname.startsWith('/keystatic')) {
      document.querySelectorAll('style[data-emotion]').forEach(element => element.remove());
      document.body.style.overflow = '';
    }
  }, [location.pathname]);

  return location.pathname.startsWith('/keystatic') ? <KeystaticShell /> : <SiteShell />;
};
```

Keep all public SEO and scroll hooks inside `SiteShell`. Do not call them for Keystatic.

- [ ] **Step 4: Verify both navigation directions**

Run:

```bash
npx playwright test tests/admin-studio-navigation.spec.ts --project=chromium --reporter=list
npm run typecheck
```

Expected: navigation test PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the crash repair**

```bash
git add App.tsx tests/admin-studio-navigation.spec.ts
git commit -m "fix: stabilize Keystatic route navigation"
```

## Task 2: Build the Persistent Admin Shell

**Files:**

- Create: `components/admin/AdminNavigation.ts`
- Create: `components/admin/AdminShell.tsx`
- Modify: `App.tsx`
- Modify: `src/index.css`
- Create: `tests/admin-studio-shell.test.ts`

- [ ] **Step 1: Write failing navigation and shell contract tests**

Create `tests/admin-studio-shell.test.ts` with:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('admin studio shell', () => {
  it('groups every admin tool in one persistent navigation', async () => {
    const { ADMIN_NAVIGATION } = await import('../components/admin/AdminNavigation.ts');
    assert.deepEqual(
      ADMIN_NAVIGATION.map(group => [group.label, group.items.map(item => item.label)]),
      [
        ['Home', ['Studio overview']],
        ['Artwork', ['Registry and plates', 'Private viewings', 'Artwork stories']],
        ['Publishing', ['Stories', 'Poetry', 'Media']],
        ['Sales', ['Pricing', 'Invoices']],
      ],
    );
  });

  it('uses one nested authenticated shell instead of wrapping every tool', () => {
    const app = source('App.tsx');
    assert.match(app, /<Route path=["']\/admin["'] element=\{<AdminShell\s*\/>\}>/);
    assert.match(app, /<Route index element=\{<AdminDashboard\s*\/>\}/);
    for (const file of [
      'AdminDashboard.tsx', 'AdminFileUpload.tsx', 'AdminPoetry.tsx',
      'AdminBookEditor.tsx', 'AdminInvoices.tsx', 'AdminViewings.tsx',
      'AdminPieces.tsx', 'PricingCalculator.tsx',
    ]) {
      assert.doesNotMatch(source(`components/${file}`), /<AdminLayout>/);
    }
  });
});
```

- [ ] **Step 2: Run the contract tests and confirm they fail**

Run:

```bash
npx tsx --test tests/admin-studio-shell.test.ts
```

Expected: FAIL because `AdminNavigation.ts`, `AdminShell.tsx`, and nested routes do not exist.

- [ ] **Step 3: Define grouped navigation metadata**

Create `components/admin/AdminNavigation.ts`:

```ts
export type AdminNavigationItem = {
  label: string;
  href: string;
  end?: boolean;
};

export type AdminNavigationGroup = {
  label: 'Home' | 'Artwork' | 'Publishing' | 'Sales';
  items: AdminNavigationItem[];
};

export const ADMIN_NAVIGATION: AdminNavigationGroup[] = [
  { label: 'Home', items: [{ label: 'Studio overview', href: '/admin', end: true }] },
  {
    label: 'Artwork',
    items: [
      { label: 'Registry and plates', href: '/admin/pieces' },
      { label: 'Private viewings', href: '/admin/viewings' },
      { label: 'Artwork stories', href: '/admin/book' },
    ],
  },
  {
    label: 'Publishing',
    items: [
      { label: 'Stories', href: '/keystatic' },
      { label: 'Poetry', href: '/admin/poetry' },
      { label: 'Media', href: '/admin/files' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Pricing', href: '/admin/pricing' },
      { label: 'Invoices', href: '/admin/invoices' },
    ],
  },
];
```

- [ ] **Step 4: Create the authenticated outlet shell**

Create `components/admin/AdminShell.tsx` with these behaviors:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from '../../lib/account/authClient';
import { ADMIN_NAVIGATION } from './AdminNavigation';

type AdminIdentity = { id: string; email: string };

export function adminReturnDestination(location: LocationLike) {
  return `${location.pathname}${location.search}${location.hash}`;
}

type LocationLike = { pathname: string; search: string; hash: string };

const AdminShell: React.FC = () => {
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState<AdminIdentity | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/admin/verify', { cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) {
          navigate('/admin/login', { state: { from: adminReturnDestination(location) }, replace: true });
          return;
        }
        if (response.status === 403) {
          setForbidden(true);
          return;
        }
        if (!response.ok) throw new Error('admin verification failed');
        const data = await response.json();
        if (data.ok && data.admin) setAdmin(data.admin);
      })
      .catch(() => navigate('/admin/login', { replace: true }))
      .finally(() => setChecking(false));
  }, [navigate]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const logout = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  if (checking) return <div className="admin-shell-loading" aria-label="Checking administrator session" />;
  if (forbidden) return <AdminForbidden onSignOut={logout} />;
  if (!admin) return null;

  return (
    <div className="admin-shell">
      <button
        ref={menuButtonRef}
        className="admin-menu-button"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="admin-navigation"
        onClick={() => setMenuOpen(open => !open)}
      >
        Menu
      </button>
      <aside id="admin-navigation" className={menuOpen ? 'admin-sidebar is-open' : 'admin-sidebar'}>
        <Link to="/admin" className="admin-mark">AR <span>Studio</span></Link>
        <nav aria-label="Admin navigation">
          {ADMIN_NAVIGATION.map(group => (
            <div key={group.label} className="admin-nav-group">
              <p>{group.label}</p>
              {group.items.map(item => (
                <NavLink key={item.href} to={item.href} end={item.end}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-account">
          <span>{admin.email}</span>
          <Link to="/">View site</Link>
          <button type="button" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  );
};

export default AdminShell;
```

Implement `AdminForbidden` in the same file using the existing allowlist explanation and a sign-out button.

- [ ] **Step 5: Convert admin routes to nested children**

In `App.tsx`, mount:

```tsx
<Route path="/admin/login" element={<AdminLogin />} />
<Route path="/admin" element={<AdminShell />}>
  <Route index element={<AdminDashboard />} />
  <Route path="files" element={<AdminFileUpload />} />
  <Route path="poetry" element={<AdminPoetry />} />
  <Route path="book" element={<AdminBookEditor />} />
  <Route path="invoices" element={<AdminInvoices />} />
  <Route path="viewings" element={<AdminViewings />} />
  <Route path="pieces" element={<AdminPieces />} />
  <Route path="pricing" element={<PricingCalculator />} />
</Route>
```

Remove `AdminLayout` wrappers and imports from every nested tool.

- [ ] **Step 6: Add responsive shell styles**

Add admin-specific classes to `src/index.css` using existing paper, wood, and bronze tokens. Required behavior:

```css
.admin-shell { min-height: 100vh; background: var(--color-paper-50); }
.admin-sidebar { position: fixed; inset: 0 auto 0 0; width: 15rem; background: var(--color-wood-900); color: var(--color-paper-50); }
.admin-main { min-height: 100vh; margin-left: 15rem; }
.admin-menu-button { display: none; min-width: 44px; min-height: 44px; }
.admin-sidebar a:focus-visible,
.admin-sidebar button:focus-visible,
.admin-menu-button:focus-visible { outline: 2px solid var(--color-bronze-400); outline-offset: 3px; }

@media (max-width: 767px) {
  .admin-menu-button { display: inline-flex; position: fixed; z-index: 60; top: .5rem; right: .75rem; }
  .admin-sidebar { transform: translate3d(-100%, 0, 0); transition: transform 200ms cubic-bezier(.16, 1, .3, 1); z-index: 50; }
  .admin-sidebar.is-open { transform: translate3d(0, 0, 0); }
  .admin-main { margin-left: 0; padding-top: 3.75rem; }
}

@media (prefers-reduced-motion: reduce) {
  .admin-sidebar { transition: none; }
}
```

Use the actual CSS custom properties already defined in `src/index.css`; do not introduce duplicate hex values.

- [ ] **Step 7: Verify and commit the shell**

Run:

```bash
npx tsx --test tests/admin-studio-shell.test.ts tests/admin-auth.test.ts tests/account-signout.test.ts
npm run typecheck
```

Expected: all tests PASS and TypeScript exits 0.

```bash
git add App.tsx src/index.css components/admin components/Admin*.tsx components/PricingCalculator.tsx tests/admin-studio-shell.test.ts
git commit -m "feat: add persistent admin studio shell"
```

## Task 3: Add Shared Admin Page Primitives

**Files:**

- Create: `components/admin/AdminPage.tsx`
- Modify: `src/index.css`
- Modify: all eight admin tool components
- Modify: `tests/admin-studio-shell.test.ts`

- [ ] **Step 1: Add failing primitive and migration assertions**

Extend `tests/admin-studio-shell.test.ts`:

```ts
it('uses one page and control vocabulary across every admin tool', () => {
  const primitives = source('components/admin/AdminPage.tsx');
  for (const name of ['AdminPage', 'AdminPageHeader', 'AdminSection', 'AdminAlert', 'AdminEmptyState']) {
    assert.match(primitives, new RegExp(`export (?:const|function) ${name}`));
  }
  for (const file of [
    'AdminDashboard.tsx', 'AdminFileUpload.tsx', 'AdminPoetry.tsx',
    'AdminBookEditor.tsx', 'AdminInvoices.tsx', 'AdminViewings.tsx',
    'AdminPieces.tsx', 'PricingCalculator.tsx',
  ]) {
    assert.match(source(`components/${file}`), /<AdminPage/);
  }
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx tsx --test tests/admin-studio-shell.test.ts
```

Expected: FAIL because shared primitives are missing.

- [ ] **Step 3: Create semantic page primitives**

Create `components/admin/AdminPage.tsx` with exported typed components:

```tsx
import React from 'react';

export const AdminPage: React.FC<React.PropsWithChildren<{ width?: 'narrow' | 'medium' | 'wide' }>> = ({
  width = 'medium', children,
}) => <div className={`admin-page admin-page-${width}`}>{children}</div>;

export const AdminPageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ eyebrow, title, description, actions }) => (
  <header className="admin-page-header">
    <div>
      {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="admin-page-actions">{actions}</div>}
  </header>
);

export const AdminSection: React.FC<React.PropsWithChildren<{ title: string; description?: string }>> = ({ title, description, children }) => (
  <section className="admin-section">
    <header><h2>{title}</h2>{description && <p>{description}</p>}</header>
    {children}
  </section>
);

export const AdminAlert: React.FC<React.PropsWithChildren<{ tone: 'info' | 'success' | 'warning' | 'error'; live?: boolean }>> = ({ tone, live, children }) => (
  <div className={`admin-alert admin-alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'} aria-live={live ? 'polite' : undefined}>{children}</div>
);

export const AdminEmptyState: React.FC<{ title: string; description: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="admin-empty-state"><h3>{title}</h3><p>{description}</p>{action}</div>
);
```

- [ ] **Step 4: Migrate each tool without changing business logic**

Replace each local page wrapper and heading with `AdminPage` and `AdminPageHeader`.

Use widths:

- `narrow`: Files, Poetry, Artwork stories, Pricing
- `medium`: Studio overview, Registry and plates, Private viewings
- `wide`: Invoices

Keep every fetch, validation rule, submit handler, registry unlock control, and API payload unchanged.

- [ ] **Step 5: Add shared product styles and states**

In `src/index.css`, define one vocabulary for `.admin-page`, headings, sections, buttons, inputs, focus, disabled, loading, alerts, and empty states. Use `min-height: 44px` for touch controls and ensure error, warning, success, and info include text or icons in addition to color.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/admin-studio-shell.test.ts tests/admin-registry-ui.test.ts tests/invoice-ui.test.ts
npm run typecheck
```

Expected: all tests PASS.

```bash
git add components/admin/AdminPage.tsx components/Admin*.tsx components/PricingCalculator.tsx src/index.css tests/admin-studio-shell.test.ts
git commit -m "refactor: unify admin page structure"
```

## Task 4: Build the Minimum-Data Studio Overview API

**Files:**

- Create: `functions/api/admin/overview.js`
- Modify: `tests/privileged-endpoints.test.ts`
- Modify: `tests/admin-studio-shell.test.ts`

- [ ] **Step 1: Add failing authorization and response tests**

Register `/api/admin/overview` in the privileged endpoint matrix and add a focused test using the existing fake D1 helper:

```ts
it('returns only actionable counts from the admin overview', async () => {
  const { onRequest } = await import('../functions/api/admin/overview.js');
  const response = await onRequest({
    request: adminRequest('/api/admin/overview'),
    env: overviewEnv({ plates: 2, fulfillments: 1, viewings: 1, invoices: 3 }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    attention: {
      plates: 2,
      fulfillments: 1,
      draftViewings: 1,
      openInvoices: 3,
    },
  });
});
```

The fake `overviewEnv` must assert that returned rows contain counts only and that no email, ownership code, public token, or financial amount is selected.

- [ ] **Step 2: Run and confirm failure**

```bash
npx tsx --test --experimental-test-module-mocks tests/privileged-endpoints.test.ts tests/admin-studio-shell.test.ts
```

Expected: FAIL because the endpoint does not exist.

- [ ] **Step 3: Implement count-only queries**

Create `functions/api/admin/overview.js`:

```js
import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import { isMissingTableError } from '../_lib/keeper.js';

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const [plates, fulfillments, viewings, invoices] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS count FROM keeper_pieces WHERE COALESCE(plate_status, 'legacy') != 'active' OR COALESCE(backup_status, 'missing') != 'verified'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM piece_fulfillments WHERE shipped_at IS NULL`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM viewings WHERE status = 'draft'`).first(),
      env.DB.prepare(`SELECT COUNT(*) AS count FROM invoices WHERE status IN ('draft', 'sent')`).first(),
    ]);

    return jsonResponse({
      ok: true,
      attention: {
        plates: Number(plates?.count || 0),
        fulfillments: Number(fulfillments?.count || 0),
        draftViewings: Number(viewings?.count || 0),
        openInvoices: Number(invoices?.count || 0),
      },
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return jsonResponse({ ok: true, attention: null });
    }
    return jsonResponse({ ok: false, error: 'overview_failed' }, 500);
  }
}
```

- [ ] **Step 4: Verify authorization, privacy, and fallback behavior**

```bash
npx tsx --test --experimental-test-module-mocks tests/privileged-endpoints.test.ts tests/admin-studio-shell.test.ts
```

Expected: guest 401, non-admin 403, admin 200, missing schema returns `attention: null`, and all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/admin/overview.js tests/privileged-endpoints.test.ts tests/admin-studio-shell.test.ts
git commit -m "feat: add private admin attention summary"
```

## Task 5: Replace the Tool Directory with the Studio Overview

**Files:**

- Modify: `components/AdminDashboard.tsx`
- Modify: `tests/admin-studio-shell.test.ts`

- [ ] **Step 1: Add failing dashboard behavior tests**

Extend `tests/admin-studio-shell.test.ts` to assert:

```ts
it('makes attention and quick actions the admin home hierarchy', () => {
  const dashboard = source('components/AdminDashboard.tsx');
  assert.match(dashboard, /\/api\/admin\/overview/);
  assert.match(dashboard, /Needs attention/);
  assert.match(dashboard, /Issue a plate/);
  assert.match(dashboard, /Create invoice/);
  assert.match(dashboard, /Build a viewing/);
  assert.match(dashboard, /Write a story/);
  assert.ok(dashboard.indexOf('Needs attention') < dashboard.indexOf('All tools'));
  assert.doesNotMatch(dashboard, /title:\s*['"]Keystatic['"]/);
});
```

- [ ] **Step 2: Run and confirm failure**

```bash
npx tsx --test tests/admin-studio-shell.test.ts
```

Expected: FAIL against the current flat tool directory.

- [ ] **Step 3: Implement attention rows and quick actions**

Use this model inside `AdminDashboard.tsx`:

```ts
type AdminAttention = {
  plates: number;
  fulfillments: number;
  draftViewings: number;
  openInvoices: number;
};

const QUICK_ACTIONS = [
  { label: 'Issue a plate', description: 'Create its permanent identity', href: '/admin/pieces?mode=issue' },
  { label: 'Create invoice', description: 'Price and send new work', href: '/admin/invoices?mode=create' },
  { label: 'Build a viewing', description: 'Prepare a collector presentation', href: '/admin/viewings?mode=create' },
  { label: 'Write a story', description: 'Open the Stories editor', href: '/keystatic/collections/stories/create' },
  { label: 'Publish a poem', description: 'Create text with optional audio', href: '/admin/poetry?mode=create' },
  { label: 'Upload media', description: 'Add audio or a document', href: '/admin/files' },
];
```

Fetch `/api/admin/overview` once. Render only attention rows whose count is greater than zero. If `attention` is `null`, omit the section and keep quick actions available. On fetch failure, show a contained retry alert without replacing the shell.

- [ ] **Step 4: Verify and commit**

```bash
npx tsx --test tests/admin-studio-shell.test.ts
npm run typecheck
```

Expected: PASS.

```bash
git add components/AdminDashboard.tsx tests/admin-studio-shell.test.ts
git commit -m "feat: make admin home action oriented"
```

## Task 6: Connect the Recurring Workflows

**Files:**

- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminViewings.tsx`
- Modify: `components/AdminInvoices.tsx`
- Modify: `components/PricingCalculator.tsx`
- Modify: `components/AdminFileUpload.tsx`
- Modify: `components/AdminPoetry.tsx`
- Modify: relevant existing UI tests

- [ ] **Step 1: Add failing URL-state and continuation tests**

Add pure exported helpers and test them without browser mocks:

```ts
assert.equal(adminMode(new URLSearchParams('mode=create')), 'create');
assert.equal(adminMode(new URLSearchParams('mode=unknown')), null);
assert.equal(poetryCreatePath('https://files.example/audio.mp3'), '/admin/poetry?mode=create&audio=https%3A%2F%2Ffiles.example%2Faudio.mp3');
```

Add source assertions for these visible stage labels:

```ts
for (const label of ['Issue identity', 'Verify recovery copy', 'Activate plate', 'Assign fulfillment', 'Mark shipped']) {
  assert.match(source('components/AdminPieces.tsx'), new RegExp(label));
}
for (const label of ['Intake', 'Curate', 'Preview', 'Send']) {
  assert.match(source('components/AdminViewings.tsx'), new RegExp(label));
}
```

- [ ] **Step 2: Run the focused tests and confirm failure**

```bash
npx tsx --test tests/admin-registry-ui.test.ts tests/invoice-ui.test.ts tests/admin-studio-shell.test.ts
```

Expected: FAIL because stable creation modes, stage labels, and media continuation are missing.

- [ ] **Step 3: Add stable creation-mode helpers**

For Invoices, Viewings, Poetry, and Registry, read `mode=create` or `mode=issue` with a pure helper:

```ts
export function adminMode(params: URLSearchParams): 'create' | 'issue' | null {
  const mode = params.get('mode');
  return mode === 'create' || mode === 'issue' ? mode : null;
}
```

Use the helper only to select an existing form or empty creation state. Do not alter stored data, validation, or API payloads.

- [ ] **Step 4: Make workflow stages explicit**

Add a semantic ordered stage list to Registry and a four-stage header to Viewings. Current state comes from existing fields and screen state. Completed, current, and future states must include text labels and `aria-current="step"` for the active stage.

- [ ] **Step 5: Connect Pricing to Invoices and Media to Poetry**

Keep the existing pricing transfer mechanism, but label its final action `Create invoice` and route to `/admin/invoices?mode=create`.

Export from `AdminFileUpload.tsx`:

```ts
export function poetryCreatePath(url: string) {
  return `/admin/poetry?${new URLSearchParams({ mode: 'create', audio: url }).toString()}`;
}
```

Show `Use in poem` for audio files. `AdminPoetry` reads the `audio` query value only if it exactly matches an existing media URL already returned by the file API.

- [ ] **Step 6: Verify and commit**

```bash
npx tsx --test tests/admin-registry-ui.test.ts tests/invoice-ui.test.ts tests/admin-studio-shell.test.ts
npm run typecheck
```

Expected: all tests PASS.

```bash
git add components/AdminPieces.tsx components/AdminViewings.tsx components/AdminInvoices.tsx components/PricingCalculator.tsx components/AdminFileUpload.tsx components/AdminPoetry.tsx tests
git commit -m "feat: connect admin studio workflows"
```

## Task 7: Harden Errors, Mobile Navigation, and Accessibility

**Files:**

- Modify: `index.tsx`
- Modify: `components/admin/AdminShell.tsx`
- Modify: `components/KeystaticRoute.tsx`
- Modify: `src/index.css`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/admin-studio-navigation.spec.ts`

- [ ] **Step 1: Install the accessibility test helper**

```bash
npm install --save-dev @axe-core/playwright
```

Expected: `package.json` and lockfile include `@axe-core/playwright`.

- [ ] **Step 2: Add failing browser checks**

Extend `tests/admin-studio-navigation.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';

test('admin shell is keyboard reachable and has no serious accessibility violations', async ({ page }) => {
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, attention: { plates: 2, fulfillments: 1, draftViewings: 1, openInvoices: 1 } }),
  }));
  await page.goto('/admin');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact || ''))).toEqual([]);
});

test('mobile admin menu fits the viewport and closes after navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));
  await page.route('/api/admin/overview', route => route.fulfill({ status: 200, body: JSON.stringify({ ok: true, attention: null }) }));
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
});
```

- [ ] **Step 3: Run and confirm failure**

```bash
npx playwright test tests/admin-studio-navigation.spec.ts --reporter=list
```

Expected: FAIL until focus, mobile closure, contrast, landmarks, and labels are complete.

- [ ] **Step 4: Make error recovery useful**

Update the global error boundary in `index.tsx` to provide:

```tsx
<h1>Something went wrong</h1>
<p>This part of the studio could not open.</p>
<button type="button" onClick={() => window.location.reload()}>Try again</button>
<a href="/admin">Return to Admin</a>
```

Keep technical error details in `componentDidCatch` only. Do not render stack traces or error messages in production.

Wrap Keystatic with a short Stories header that states `Stories uses GitHub to publish changes` only when GitHub authorization is requested. Keep `Return to Admin` visible at all times.

- [ ] **Step 5: Complete mobile focus behavior**

When the mobile menu opens, focus its first navigation link. Escape closes the menu and returns focus to the menu button. Add an overlay button with an accessible `Close menu` label. Lock page scroll only while the menu is open and restore it on cleanup.

- [ ] **Step 6: Verify and commit**

```bash
npx playwright test tests/admin-studio-navigation.spec.ts --reporter=list
npm run typecheck
```

Expected: desktop and mobile tests PASS with zero serious or critical axe violations.

```bash
git add index.tsx components/admin/AdminShell.tsx components/KeystaticRoute.tsx src/index.css package.json package-lock.json tests/admin-studio-navigation.spec.ts
git commit -m "fix: harden admin recovery and accessibility"
```

## Task 8: Full Verification and Production Delivery

**Files:**

- Modify only files required by failures found during verification.

- [ ] **Step 1: Run all unit tests**

```bash
npm run test:unit
```

Expected: all unit tests PASS with zero failures.

- [ ] **Step 2: Run all browser tests**

```bash
npm run test:e2e
```

Expected: desktop and Mobile Chrome projects PASS.

- [ ] **Step 3: Run type checking and the production build**

```bash
npm run typecheck
npm run build
```

Expected: both commands exit 0. Existing bundle-size warnings may remain, but no new warnings or errors are introduced by admin code.

- [ ] **Step 4: Run the local Pages Functions smoke checks**

```bash
npm run build
npx wrangler pages dev dist --port 8788 --ip 127.0.0.1
```

Against the local server, verify:

```bash
curl -i http://127.0.0.1:8788/api/admin/verify
curl -i http://127.0.0.1:8788/api/admin/overview
curl -i http://127.0.0.1:8788/api/keystatic/github/login
```

Expected without credentials: admin endpoints return 401 and Keystatic login returns its configured redirect or setup response.

- [ ] **Step 5: Review the integrated admin visually**

Verify these actual screens at desktop and phone widths:

- Studio overview
- Registry and plates
- Invoices
- Stories transition
- Mobile menu
- Signed-out and forbidden states

Compare the shell and hierarchy to the approved visual reference. Do not redesign individual business forms during this step.

- [ ] **Step 6: Deploy and smoke test production**

Deploy through the repository's established Cloudflare Pages production flow. Then verify:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://adrianrasmussen.com/admin
curl -sS -o /dev/null -w '%{http_code}\n' https://adrianrasmussen.com/keystatic
curl -sS https://adrianrasmussen.com/api/auth/config
```

Expected: HTML routes return 200 and auth config remains healthy. Complete one real administrator navigation from Admin to Stories and back without reloading.

- [ ] **Step 7: Commit any verification-only corrections and push**

```bash
git status --short
git commit -m "fix: complete admin studio verification"
git push origin main
```

If corrections were required, stage each verified file explicitly using the exact paths printed by `git status --short` before committing. Skip the correction commit when verification required no changes. Never include unrelated working-tree files.
