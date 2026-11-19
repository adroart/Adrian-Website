import { expect, test, type Page } from './fixtures';

async function signIn(page: Page, signedIn: boolean) {
  await page.route('**/api/auth/get-session', route => route.fulfill({
    json: signedIn
      ? { user: { id: 'collector', email: 'fixture@example.test', emailVerified: true }, session: { id: 'session-1' } }
      : null,
  }));
  await page.route('**/api/auth/sync-user', route => route.fulfill({ json: {} }));
}

test('collections distinguish failed load from empty and retain saved items on failed changes', async ({ page }) => {
  await signIn(page, true);
  let listAttempts = 0;
  let removalAttempts = 0;
  await page.route('**/api/collections/list', route => route.fulfill(++listAttempts === 1
    ? { status: 503, json: { error: 'unavailable' } }
    : { json: [{ id: 1, name: 'Saved collection', createdAt: '2026-01-01', items: [{ kind: 'artwork', ref: 'UL-1' }] }] }));
  await page.route('**/api/collections/remove-item', route => route.fulfill(++removalAttempts === 1
    ? { status: 503, json: { error: 'unavailable' } }
    : { json: { ok: true } }));
  for (const endpoint of ['create', 'delete', 'update']) {
    await page.route(`**/api/collections/${endpoint}`, route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  }
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/account/collections');
  await expect(page.getByRole('alert')).toContainText('Could not load your collections');
  await expect(page.getByText('You don’t have any collections yet.', { exact: false })).toBeHidden();
  await page.getByRole('button', { name: 'Try again' }).click();
  const collection = page.getByRole('button', { name: 'Saved collection', exact: true });
  await expect(collection).toBeVisible();

  const createName = page.getByRole('textbox', { name: 'New collection name' });
  await createName.fill('My second collection');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not create');
  await expect(createName).toHaveValue('My second collection');

  await collection.click();
  const rename = page.getByRole('textbox', { name: 'Collection name', exact: true });
  await rename.fill('My intended rename');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not rename');
  await expect(rename).toHaveValue('My intended rename');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/collections-recovery-${test.info().project.name.replace(/ /g, '-')}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(collection).toBeVisible();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not delete');
  await expect(collection).toBeVisible();

  const remove = page.getByRole('button', { name: 'Remove', exact: true });
  await remove.click();
  await expect(page.getByRole('alert')).toContainText('Could not remove');
  await expect(page.getByRole('link', { name: 'Artwork · UL-1' })).toBeVisible();
  await remove.click();
  await expect(page.getByText('No items yet.')).toBeVisible();
});

test('saving artwork after creating a collection retries the item without duplicating the collection', async ({ page }) => {
  await signIn(page, true);
  let creates = 0;
  let adds = 0;
  await page.route('**/api/collections/list', route => route.fulfill({ json: [] }));
  await page.route('**/api/collections/create', async route => {
    creates++;
    await route.fulfill({ json: { id: 1, name: 'Cabinet', createdAt: '2026-01-01', items: [] } });
  });
  await page.route('**/api/collections/add-item', route => route.fulfill(++adds === 1
    ? { status: 503, json: { error: 'unavailable' } }
    : { json: { ok: true } }));
  await page.goto('/creations/amphibian-dream');
  const open = page.getByRole('button', { name: 'Save', exact: true });
  await open.click();
  const chooser = page.locator('.stc__menu');
  await chooser.getByRole('textbox', { name: 'New collection name' }).fill('Cabinet');
  await chooser.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(chooser.getByRole('alert')).toContainText('Could not save this item');
  await chooser.getByRole('button', { name: 'Cabinet', exact: true }).click();
  await expect(chooser).toHaveCount(0);
  expect(creates).toBe(1);
  expect(adds).toBe(2);
});

test('collection refreshes wait for pending writes and retain their result', async ({ page }) => {
  await signIn(page, false);
  await page.goto('/account');
  await page.evaluate(async () => {
    const reactModule = '/node_modules/.vite/deps/react.js';
    const domModule = '/node_modules/.vite/deps/react-dom_client.js';
    const collectionsModule = '/lib/collections/context.tsx';
    const accountModule = '/lib/account/useAccount.ts';
    const { default: React } = await import(reactModule);
    const { default: ReactDOM } = await import(domModule);
    const { CollectionsProvider, useCollections } = await import(collectionsModule);
    const { AccountContext } = await import(accountModule);
    const state = window as any;
    state.collectionEvents = [];
    let saved: unknown[] = [];
    const account = {
      available: true, isLoaded: true, isSignedIn: true, userId: 'fixture', email: 'fixture@example.test',
      fetchAuthed: async (url: string) => {
        state.collectionEvents.push(url);
        if (url.endsWith('/create')) {
          await new Promise(resolve => { state.releaseCollectionCreate = resolve; });
          const created = { id: 1, name: 'Cabinet', createdAt: '2026-01-01', items: [] };
          saved = [created];
          return Response.json(created);
        }
        return Response.json(saved);
      },
    };
    function Probe() {
      const collections = useCollections();
      state.collectionProbe = collections;
      return React.createElement('pre', { 'data-testid': 'collection-probe' }, JSON.stringify(collections.collections));
    }
    const node = document.createElement('div');
    document.body.append(node);
    const root = ReactDOM.createRoot(node);
    const render = (value: typeof account) => root.render(React.createElement(AccountContext.Provider, { value },
      React.createElement(CollectionsProvider, null, React.createElement(Probe))));
    state.switchCollectionOwner = () => render({ ...account, userId: 'next-collector',
      fetchAuthed: async () => Response.json([]) });
    render(account);
  });
  await expect(page.getByTestId('collection-probe')).toHaveText('[]');
  await page.waitForFunction(() => !(window as any).collectionProbe.isLoading);
  await page.evaluate(() => { void (window as any).collectionProbe.createCollection('Cabinet'); });
  await page.waitForFunction(() => !!(window as any).releaseCollectionCreate);
  await page.evaluate(() => { void (window as any).collectionProbe.reload(); });
  expect(await page.evaluate(() => (window as any).collectionEvents)).toEqual([
    '/api/collections/list', '/api/collections/create',
  ]);
  await page.evaluate(() => (window as any).releaseCollectionCreate());
  await expect(page.getByTestId('collection-probe')).toContainText('Cabinet');
  await page.waitForFunction(() => (window as any).collectionEvents.length === 3);
  await page.waitForFunction(() => !(window as any).collectionProbe.isLoading);
  await expect(page.getByTestId('collection-probe')).toContainText('Cabinet');
  // A slow request for the former account must neither block nor populate the next one.
  await page.evaluate(() => {
    const state = window as any;
    state.releaseCollectionCreate = null;
    state.collectionProbe.createCollection('Old account').catch((error: Error) => { state.oldCollectionError = error.message; });
  });
  await page.waitForFunction(() => !!(window as any).releaseCollectionCreate);
  await page.evaluate(() => (window as any).switchCollectionOwner());
  await expect(page.getByTestId('collection-probe')).toHaveText('[]');
  await page.waitForFunction(() => !(window as any).collectionProbe.isLoading);
  await page.evaluate(() => (window as any).releaseCollectionCreate());
  await page.waitForFunction(() => (window as any).oldCollectionError === 'account changed');
  await expect(page.getByTestId('collection-probe')).toHaveText('[]');
});
