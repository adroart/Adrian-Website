import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const now = '2026-08-10T00:00:00.000Z';

type Artwork = {
  saleItemId: string;
  artworkRecordId: string;
  artworkId: string | null;
  edition: { kind: 'unique'; number: null; size: null } | null;
  keeperPieceId: string | null;
  identificationStatus: 'unresolved' | 'identified' | 'identity_linked';
  recordVersion: number;
  price: { amountMinor: number; currency: string } | null;
  priceEntries: unknown[];
  ledgerEntries: Array<{ ledgerEntryId: string; message: string | null; mediaId: string | null; createdAt: string; media: null | { role: string; contentType: string; byteLength: number } }>;
};

type SaleFacts = {
  reconnectionCaseId: string | null;
  occurrence: { precision: string; value: string | null };
  buyerEmail: string | null;
  total: { amountMinor: number; currency: string } | null;
  privateReference: string | null;
  privateNotes: string | null;
  recordedAt: string;
};

type SaleDetailState = {
  sale: Record<string, any>;
  originalSale: Record<string, any>;
  effectiveSale: Record<string, any>;
  corrections: Array<{
    saleEventId: string;
    sequence: number;
    reason: string;
    createdAt: string;
    before: SaleFacts;
    after: SaleFacts;
  }>;
  items: Artwork[];
  events: Array<Record<string, unknown>>;
};

type SalesMockOptions = {
  seedDetails?: SaleDetailState[];
  malformedSaleIds?: string[];
  failCorrectionReason?: string;
  deferRegistration?: boolean;
  deferInvitation?: boolean;
};

function deferredResponse() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

const saleFacts = (sale: Record<string, any>): SaleFacts => ({
  reconnectionCaseId: sale.reconnectionCaseId,
  occurrence: sale.occurrence,
  buyerEmail: sale.buyerEmail,
  total: sale.total,
  privateReference: sale.privateReference,
  privateNotes: sale.privateNotes,
  recordedAt: sale.recordedAt,
});

const seededArtwork = (
  prefix: string,
  index: number,
  identificationStatus: Artwork['identificationStatus'],
): Artwork => ({
  saleItemId: `${prefix}-item-${index}`,
  artworkRecordId: `${prefix}-record-${index}`,
  artworkId: identificationStatus === 'unresolved' ? null : `UL-${99 + index}`,
  edition: identificationStatus === 'unresolved' ? null : { kind: 'unique', number: null, size: null },
  keeperPieceId: identificationStatus === 'identity_linked' ? `${prefix}-keeper-${index}` : null,
  identificationStatus,
  recordVersion: 1,
  price: null,
  priceEntries: [],
  ledgerEntries: [],
});

const seededDetail = (
  saleId: string,
  year: string,
  buyerEmail: string,
  privateReference: string,
  privateNotes: string,
  items: Artwork[],
): SaleDetailState => {
  const sale = {
    saleId,
    reconnectionCaseId: null,
    occurrence: { precision: 'year', value: year },
    buyerEmail,
    total: null,
    privateReference,
    privateNotes,
    recordedAt: now,
    sequence: 0,
  };
  return {
    sale,
    originalSale: { ...sale },
    effectiveSale: sale,
    corrections: [],
    items,
    events: [],
  };
};

async function installSalesMock(page: Page, options: SalesMockOptions = {}) {
  const registrationResponse = deferredResponse();
  const invitationResponse = deferredResponse();
  const state: {
    cases: Array<Record<string, unknown>>;
    sales: Array<Record<string, any>>;
    details: Map<string, SaleDetailState>;
    media: Map<string, Array<Record<string, unknown>>>;
    selected: Map<string, string>;
    invitations: Array<Record<string, unknown>>;
    requests: Array<{ url: string; method: string; body: unknown; headers: Record<string, string> }>;
  } = { cases: [], sales: [], details: new Map(), media: new Map(), selected: new Map(), invitations: [], requests: [] };
  for (const detail of options.seedDetails || []) {
    state.details.set(detail.effectiveSale.saleId, detail);
    state.sales.push({
      ...detail.effectiveSale,
      identificationStatuses: detail.items.map(item => item.identificationStatus),
    });
  }

  await page.route('/api/admin/verify', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, admin: { id: 'admin-1', email: 'artist@example.com' } }),
  }));

  const reply = (route: Route, body: unknown, status = 200) => route.fulfill({
    status, contentType: 'application/json', body: JSON.stringify(body),
  });

  await page.route('/api/admin/collector-sales**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.requests.push({ url: request.url(), method: request.method(), body, headers: request.headers() });
    const match = url.pathname.match(/\/collector-sales\/([^/]+)$/);
    if (request.method() === 'GET' && match) {
      const detail = state.details.get(match[1]);
      if (detail && options.malformedSaleIds?.includes(match[1])) {
        return reply(route, { ok: true, sale: detail.sale });
      }
      return detail ? reply(route, { ok: true, ...detail }) : reply(route, { ok: false, error: 'sale_not_found' }, 404);
    }
    if (request.method() === 'GET') return reply(route, {
      ok: true, sales: state.sales, reconnectionCases: state.cases,
      pagination: { limit: 25, offset: 0, sales: { hasMore: false, nextOffset: null }, reconnectionCases: { hasMore: false, nextOffset: null } },
    });
    if (!match && body.action === 'createReconnection') {
      const reconnectionCaseId = 'case-one';
      state.cases.push({ reconnectionCaseId, recipientEmail: body.recipientEmail, recipientName: body.recipientName, privateContext: body.privateContext, status: 'open', createdAt: now });
      return reply(route, { ok: true, result: { reconnectionCaseId, recipientEmail: body.recipientEmail, status: 'open', replayed: false } }, 201);
    }
    if (!match && body.action === 'createSale') {
      const saleId = 'sale-one';
      const sale = { saleId, reconnectionCaseId: body.reconnectionCaseId, occurrence: body.occurrence, buyerEmail: body.buyerEmail, total: body.total, privateReference: body.privateReference, privateNotes: body.privateNotes, recordedAt: now, sequence: 0 };
      const items: Artwork[] = body.artworks.map((item: any, index: number) => ({
        saleItemId: `item-${index + 1}`, artworkRecordId: `record-${index + 1}`,
        artworkId: item.artworkId, edition: item.edition ? { ...item.edition, number: null, size: null } : null,
        keeperPieceId: null, identificationStatus: item.artworkId ? 'identified' : 'unresolved',
        recordVersion: 1, price: item.price, priceEntries: [], ledgerEntries: [],
      }));
      state.sales.push({ ...sale, identificationStatuses: items.map(item => item.identificationStatus) });
      state.details.set(saleId, {
        sale, originalSale: { ...sale }, effectiveSale: sale,
        corrections: [], items, events: [],
      });
      return reply(route, { ok: true, result: { saleId, itemIds: items.map(item => item.saleItemId), artworkRecordIds: items.map(item => item.artworkRecordId), priceEntryIds: [], replayed: false } }, 201);
    }
    const detail = state.details.get(match![1])!;
    if (body.action === 'identifyArtwork' || body.action === 'linkIdentity') {
      const item = detail.items.find(value => value.artworkRecordId === body.artworkRecordId)!;
      if (body.action === 'identifyArtwork') { item.artworkId = body.artworkId; item.edition = { ...body.edition, number: null, size: null }; item.identificationStatus = 'identified'; }
      else { item.keeperPieceId = body.keeperPieceId; item.identificationStatus = 'identity_linked'; }
      item.recordVersion += 1;
      return reply(route, { ok: true, result: { artworkRecordId: item.artworkRecordId, identificationStatus: item.identificationStatus, artworkId: item.artworkId, edition: item.edition, keeperPieceId: item.keeperPieceId, recordVersion: item.recordVersion, replayed: false } }, 201);
    }
    if (body.action === 'correctSale') {
      if (body.reason === options.failCorrectionReason) {
        return reply(route, { ok: false, error: 'temporary_failure' }, 500);
      }
      const sequence = detail.effectiveSale.sequence + 1;
      const saleEventId = `event-correction-${sequence}`;
      const before = saleFacts(detail.effectiveSale);
      const after = {
        ...before,
        occurrence: body.occurrence,
        buyerEmail: body.buyerEmail,
        total: body.total,
        privateReference: body.privateReference,
        privateNotes: body.privateNotes,
      };
      detail.corrections.push({ saleEventId, sequence, reason: body.reason, createdAt: now, before, after });
      detail.events.push({ saleEventId, sequence, eventType: 'corrected', reason: body.reason, createdAt: now });
      detail.effectiveSale = { ...detail.effectiveSale, ...after, sequence };
      detail.sale = detail.effectiveSale;
      const summary = state.sales.find(value => value.saleId === match![1]);
      if (summary) Object.assign(summary, detail.effectiveSale);
      return reply(route, { ok: true, result: { saleEventId, saleId: match![1], sequence, reason: body.reason, replayed: false } }, 201);
    }
    return reply(route, { ok: true, result: { reconnectionEventId: 'case-event', eventType: body.action === 'recordReconnectionEmail' ? 'email_sent' : body.action === 'changeReconnectionStatus' ? 'status_changed' : 'note_added', ...(body.newStatus ? { status: body.newStatus } : {}), replayed: false } }, 201);
  });

  await page.route('/api/admin/collector-ledger/media', async route => {
    const request = route.request();
    const headers = request.headers();
    const recordId = headers['x-artwork-record-id'];
    const media = { id: `media-${(state.media.get(recordId)?.length || 0) + 1}`, artworkRecordId: recordId, role: headers['x-artwork-media-role'], contentType: headers['content-type'], byteLength: Number(headers['x-content-length']), createdAt: now };
    state.media.set(recordId, [...(state.media.get(recordId) || []), media]);
    state.requests.push({ url: request.url(), method: request.method(), body: request.postDataBuffer()?.toString('utf8'), headers });
    return reply(route, { media, replayed: false }, 201);
  });

  await page.route('/api/admin/collector-ledger**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/media')) {
      const headers = request.headers();
      const recordId = headers['x-artwork-record-id'];
      const media = { id: `media-${(state.media.get(recordId)?.length || 0) + 1}`, artworkRecordId: recordId, role: headers['x-artwork-media-role'], contentType: headers['content-type'], byteLength: Number(headers['x-content-length']), createdAt: now };
      state.media.set(recordId, [...(state.media.get(recordId) || []), media]);
      state.requests.push({ url: request.url(), method: request.method(), body: request.postDataBuffer()?.toString('utf8'), headers });
      return reply(route, { media, replayed: false }, 201);
    }
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.requests.push({ url: request.url(), method: request.method(), body, headers: request.headers() });
    if (request.method() === 'GET') {
      const recordId = url.searchParams.get('artworkRecordId')!;
      const detail = [...state.details.values()].find(value => value.items.some(item => item.artworkRecordId === recordId))!;
      const item = detail.items.find(value => value.artworkRecordId === recordId)!;
      const selectedMedia = state.selected.get(recordId);
      return reply(route, { ok: true, artworkRecord: { artworkRecordId: recordId, artworkId: item.artworkId, edition: item.edition, keeperPieceId: item.keeperPieceId, identificationStatus: item.identificationStatus, recordVersion: item.recordVersion, createdAt: now, updatedAt: now }, ledgerEntries: item.ledgerEntries.map(entry => ({ ...entry, saleId: detail.effectiveSale.saleId })), media: state.media.get(recordId) || [], selectedCertificateImage: selectedMedia ? { ledgerEntryId: 'selected-entry', mediaId: selectedMedia, selectedAt: now } : null, saleContext: null });
    }
    if (body.action === 'selectCertificateImage') state.selected.set(body.artworkRecordId, body.mediaId);
    const records = body.action === 'appendSharedSaleMessage' ? body.artworkRecordIds : [body.artworkRecordId];
    const detail = [...state.details.values()].find(value => value.items.some(item => records.includes(item.artworkRecordId)))!;
    for (const recordId of records) {
      const item = detail.items.find(value => value.artworkRecordId === recordId)!;
      item.ledgerEntries.push({ ledgerEntryId: `ledger-${item.ledgerEntries.length + 1}`, message: body.message ?? null, mediaId: body.mediaId || null, createdAt: now, media: null });
    }
    if (body.action === 'appendSharedSaleMessage') return reply(route, { ok: true, result: { saleEventId: 'shared-event', saleId: detail.effectiveSale.saleId, sequence: 1, entries: records.map((artworkRecordId: string) => ({ ledgerEntryId: `shared-${artworkRecordId}`, artworkRecordId })), replayed: false } }, 201);
    return reply(route, { ok: true, result: { ledgerEntryId: 'ledger-new', artworkRecordId: body.artworkRecordId, saleId: body.saleId ?? null, message: body.message ?? null, mediaId: body.mediaId ?? null, replayed: false } }, 201);
  });

  await page.route('/api/admin/registrations', async route => {
    const request = route.request();
    state.requests.push({ url: request.url(), method: request.method(), body: request.postDataJSON(), headers: request.headers() });
    if (options.deferRegistration) await registrationResponse.promise;
    return reply(route, { ok: true, keeperPieceId: 'keeper-one', publicCode: 'AR-BCDEFGHJ', ownershipCode: 'BCDE-FGHJ-KMNP-QRST', codeAccess: 'created', registrationStatus: 'registered', backupStatus: 'verified' }, 201);
  });
  await page.route('/api/admin/invitations', async route => {
    const request = route.request();
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.requests.push({ url: request.url(), method: request.method(), body, headers: request.headers() });
    if (request.method() === 'GET') return reply(route, { ok: true, invitations: state.invitations });
    if (options.deferInvitation) await invitationResponse.promise;
    state.invitations.push({ invitationId: 'invite-one', keeperPieceId: body.keeperPieceId, intendedRecipientEmail: body.intendedRecipientEmail, createdAt: now, expiresAt: body.expiresAt, status: 'available', artwork: { artworkId: 'UL-102', title: 'Doorways Of The Unknown - 48', publicCode: 'AR-BCDEFGHJ', edition: { kind: 'unique' } } });
    return reply(route, { ok: true, invitationId: 'invite-one', token: 'private-invitation-token' }, 201);
  });
  await page.exposeFunction('__salesTestState', () => ({ requests: state.requests, persisted: { sales: state.sales, details: [...state.details.entries()], media: [...state.media.entries()], selected: [...state.selected.entries()] } }));
  return {
    resolveRegistration: registrationResponse.resolve,
    resolveInvitation: invitationResponse.resolve,
  };
}

test('records and reconnects through the complete private verified-sale journey', async ({ page }, testInfo) => {
  await installSalesMock(page);
  const browserDiagnostics: string[] = [];
  page.on('console', message => browserDiagnostics.push(message.text()));
  page.on('pageerror', error => browserDiagnostics.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/collector-sales');
  await expect(page.getByRole('heading', { name: 'Verified sales', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Start a reconnection' }).click();
  await page.getByLabel('Recipient email').fill('collector@example.com');
  await page.getByRole('button', { name: 'Save reconnection', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Reconnection saved.')).toBeVisible();
  await expect(page.locator('[role="status"][tabindex="-1"]')).toBeFocused();

  await page.getByRole('button', { name: 'Record a verified sale' }).click();
  await page.getByLabel('Year', { exact: true }).check();
  await page.getByLabel('Sale year').fill('2018');
  await page.getByLabel('Buyer email').fill('collector@example.com');
  await page.getByLabel('Total, optional').fill('1500');
  await page.getByLabel('Private reference, optional').fill('Receipt 2018-A');
  await page.getByLabel('Private notes, optional').fill('Recorded after the original studio visit.');
  await page.getByLabel('Artwork 1').selectOption('UL-100');
  await page.getByRole('button', { name: 'Add another artwork' }).click();
  await page.getByLabel('Artwork 2').selectOption('UL-101');
  await page.getByRole('button', { name: 'Add another artwork' }).click();
  await expect(page.getByLabel('Artwork 3')).toHaveValue('');
  await page.getByRole('button', { name: 'Save verified sale', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Sale from 2018/ })).toBeVisible();
  await expect(page.getByText('Artwork not identified yet')).toBeVisible();

  const upload = page.getByRole('group', { name: 'Artwork 1 actions' });
  await upload.getByLabel('Media role').selectOption('identification_evidence');
  await upload.getByLabel('Evidence image').setInputFiles({ name: 'front.png', mimeType: 'image/png', buffer: Buffer.from('evidence') });
  await upload.getByRole('button', { name: 'Upload evidence' }).click();
  await upload.getByLabel('Media role').selectOption('certificate_image');
  await upload.getByLabel('Evidence image').setInputFiles({ name: 'better.png', mimeType: 'image/png', buffer: Buffer.from('better-image') });
  await upload.getByRole('button', { name: 'Upload evidence' }).click();
  await upload.getByRole('button', { name: 'Select as certificate image' }).last().click();
  await expect(upload.getByText('Selected certificate image')).toBeVisible();

  const unresolved = page.getByRole('group', { name: 'Artwork 3 actions' });
  await unresolved.getByLabel('Identify artwork').selectOption('UL-102');
  await unresolved.getByRole('button', { name: 'Confirm identification' }).click();
  await expect(unresolved.getByText(/· Identified$/)).toBeVisible();
  await unresolved.getByRole('button', { name: 'Register artwork' }).click();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss Ownership Code' }).click();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toHaveCount(0);
  await unresolved.getByLabel('Invitation recipient').fill('collector@example.com');
  await unresolved.getByRole('button', { name: 'Create invitation' }).click();
  await expect(page.getByText('private-invitation-token')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss invitation token' }).click();
  await expect(page.getByText('private-invitation-token')).toHaveCount(0);

  await page.getByLabel('Shared sealed message').fill('A note for all three artworks.');
  await page.getByRole('button', { name: 'Seal shared message' }).click();
  await unresolved.getByLabel('Artwork-specific sealed message').fill('A later note for this artwork.');
  await unresolved.getByRole('button', { name: 'Seal artwork message' }).click();
  await expect(unresolved.getByText('A later note for this artwork.')).toBeVisible();

  await page.getByRole('button', { name: 'Correct sale facts' }).click();
  await page.getByLabel('Correction reason').fill('Corrected from the paper receipt.');
  await page.getByLabel('Corrected total').fill('1750');
  await page.getByLabel('Corrected private reference').fill('Receipt 2018-B');
  await page.getByLabel('Corrected private notes').fill('Verified against the original receipt.');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByRole('heading', { name: 'Originally recorded' })).toBeVisible();
  await expect(page.getByText('Corrected from the paper receipt.')).toBeVisible();

  await page.getByRole('button', { name: 'Correct sale facts' }).click();
  await page.getByLabel('Exact date', { exact: true }).check();
  await page.getByLabel('Corrected sale date').fill('2018-11-03');
  await page.getByLabel('Corrected buyer email').fill('collector.updated@example.com');
  await page.getByLabel('Corrected total').fill('1850');
  await page.getByLabel('Corrected private reference').fill('Receipt 2018-Final');
  await page.getByLabel('Corrected private notes').fill('Collector confirmed the final private details.');
  await page.getByLabel('Correction reason').fill('Collector confirmed the details.');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('Collector confirmed the details.')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /Sale from 3 November 2018/ }).click();
  const original = page.getByRole('heading', { name: 'Originally recorded' }).locator('..');
  await expect(original).toContainText('2018');
  await expect(original).toContainText('collector@example.com');
  await expect(original).toContainText('USD 1,500.00');
  await expect(original).toContainText('Receipt 2018-A');
  await expect(original).toContainText('Recorded after the original studio visit.');
  const corrected = page.getByRole('heading', { name: 'Current corrected record' }).locator('..');
  await expect(corrected).toContainText('3 November 2018');
  await expect(corrected).toContainText('collector.updated@example.com');
  await expect(corrected).toContainText('USD 1,850.00');
  await expect(corrected).toContainText('Receipt 2018-Final');
  await expect(corrected).toContainText('Collector confirmed the final private details.');
  const correctionHistory = page.getByRole('list', { name: 'Correction history' });
  const correctionItems = correctionHistory.locator(':scope > li');
  await expect(correctionItems).toHaveCount(2);
  await expect(correctionItems.nth(0)).toContainText('Corrected from the paper receipt.');
  await expect(correctionItems.nth(0)).toContainText('Total, private: USD 1,500.00 → USD 1,750.00');
  await expect(correctionItems.nth(1)).toContainText('Collector confirmed the details.');
  await expect(correctionItems.nth(1)).toContainText('Occurrence: 2018 → 3 November 2018');
  await expect(correctionItems.nth(1)).toContainText('Buyer, private: collector@example.com → collector.updated@example.com');
  await expect(page.getByText(/event-correction|record-1|sale-one/)).toHaveCount(0);
  await expect(page.getByText('Artwork not identified yet')).toHaveCount(0);
  const reloadedArtwork = page.getByRole('group', { name: 'Artwork 1 actions' });
  await expect(reloadedArtwork.getByText(/Identification evidence · Immutable/)).toBeVisible();
  await expect(reloadedArtwork.getByText(/Certificate image · Immutable/)).toBeVisible();
  await expect(page.getByText(/Invitation state:\s*available/)).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('verified-sales.png'), fullPage: true });

  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  const controlsAreLarge = await page.locator('.admin-page button:visible,.admin-page input:not([type="radio"]):not([type="checkbox"]):visible,.admin-page select:visible,.admin-page textarea:visible').evaluateAll(nodes => nodes.every(node => {
    const style = getComputedStyle(node); return node.getBoundingClientRect().height >= 44 && Number.parseFloat(style.fontSize) >= 16;
  }));
  expect(controlsAreLarge).toBe(true);
  expect(await page.getByRole('heading', { level: 1 }).count()).toBe(1);

  const captured = await page.evaluate(async () => (window as any).__salesTestState());
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  const privacyObservation = [page.url(), browserStorage, ...browserDiagnostics].join('\n');
  for (const privateValue of [
    'collector@example.com',
    'collector.updated@example.com',
    'Receipt 2018-A',
    'Receipt 2018-Final',
    'Recorded after the original studio visit.',
    'Collector confirmed the final private details.',
    'A note for all three artworks.',
    'A later note for this artwork.',
    'BCDE-FGHJ-KMNP-QRST',
    'private-invitation-token',
  ]) expect(privacyObservation).not.toContain(privateValue);
  const registrationRequests = captured.requests.filter((item: any) => item.method === 'POST' && item.url.includes('/registrations'));
  const invitationRequests = captured.requests.filter((item: any) => item.method === 'POST' && item.url.endsWith('/invitations'));
  expect(registrationRequests).toHaveLength(1);
  expect(invitationRequests).toHaveLength(1);
  expect(registrationRequests[0].body).toEqual({ artworkId: 'UL-102', edition: { kind: 'unique' }, idempotencyKey: expect.any(String) });
  expect(invitationRequests[0].body).toEqual({ keeperPieceId: 'keeper-one', intendedRecipientEmail: 'collector@example.com', expiresAt: expect.any(String), idempotencyKey: expect.any(String) });
  const collectionPosts = captured.requests.filter((item: any) => item.method === 'POST' && /\/collector-sales$/.test(item.url));
  expect(collectionPosts[0].body).toEqual({ action: 'createReconnection', recipientEmail: 'collector@example.com', recipientName: null, privateContext: null, idempotencyKey: expect.any(String) });
  expect(collectionPosts[1].body).toMatchObject({ action: 'createSale', occurrence: { precision: 'year', value: '2018' }, buyerEmail: 'collector@example.com', artworks: [{ artworkId: 'UL-100' }, { artworkId: 'UL-101' }, { artworkId: null, edition: null }] });
  const linkRequest = captured.requests.find((item: any) => item.body?.action === 'linkIdentity');
  expect(linkRequest.body).toEqual({ action: 'linkIdentity', artworkRecordId: 'record-3', keeperPieceId: 'keeper-one', expectedVersion: 2, idempotencyKey: expect.any(String) });
  expect(captured.requests.every((item: any) => !/collector%40|collector@example|private-invitation-token|BCDE-FGHJ/.test(item.url))).toBe(true);
  const rawUpload = captured.requests.find((item: any) => item.url.endsWith('/collector-ledger/media'));
  expect(rawUpload.headers['content-type']).toBe('image/png');
  expect(rawUpload.headers['x-artwork-media-role']).toBe('identification_evidence');
  expect(rawUpload.body).toBe('evidence');
  expect(rawUpload.headers['content-type']).not.toContain('multipart/form-data');
});

async function switchSelectedSale(page: Page, projectName: string, buttonName: RegExp) {
  if (projectName === 'Mobile Chrome') {
    await page.getByRole('button', { name: 'Back to records' }).click();
  }
  await page.getByRole('button', { name: buttonName }).click();
}

test('isolates every private draft, attempt, and one-time secret between same-version sales', async ({ page }, testInfo) => {
  const saleA = seededDetail(
    'sale-a', '2017', 'a-owner@example.com', 'A private reference', 'A stored private note',
    [seededArtwork('a', 1, 'unresolved'), seededArtwork('a', 2, 'identified'), seededArtwork('a', 3, 'identity_linked')],
  );
  const saleB = seededDetail(
    'sale-b', '2019', 'b-owner@example.com', 'B private reference', 'B stored private note',
    [seededArtwork('b', 1, 'unresolved'), seededArtwork('b', 2, 'identified'), seededArtwork('b', 3, 'identity_linked')],
  );
  await installSalesMock(page, {
    seedDetails: [saleA, saleB],
    failCorrectionReason: 'Freeze A private correction',
  });
  await page.goto('/admin/collector-sales');
  await page.getByRole('button', { name: /Sale from 2017/ }).click();
  await expect(page.getByRole('heading', { name: 'Sale from 2017' })).toBeVisible();

  const aIdentified = page.getByRole('group', { name: 'Artwork 2 actions' });
  await aIdentified.getByRole('button', { name: 'Register artwork' }).click();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toBeVisible();
  const aLinked = page.getByRole('group', { name: 'Artwork 3 actions' });
  await aLinked.getByLabel('Invitation recipient').fill('a-invitation-draft@example.com');
  await aLinked.getByRole('button', { name: 'Create invitation' }).click();
  await expect(page.getByText('private-invitation-token')).toBeVisible();

  await page.getByLabel('Shared sealed message').fill('A unsaved shared sealed message');
  const aUnresolved = page.getByRole('group', { name: 'Artwork 1 actions' });
  await aUnresolved.getByLabel('Identify artwork').selectOption('UL-102');
  await aUnresolved.getByLabel('Media role').selectOption('certificate_image');
  await aUnresolved.getByLabel('Artwork-specific sealed message').fill('A unsaved artwork sealed message');
  await page.getByRole('button', { name: 'Correct sale facts' }).click();
  await page.getByLabel('Corrected buyer email').fill('a-unsaved-buyer@example.com');
  await page.getByLabel('Corrected private reference').fill('A unsaved private reference');
  await page.getByLabel('Corrected private notes').fill('A unsaved private correction note');
  await page.getByLabel('Correction reason').fill('Freeze A private correction');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText(/detail action has an uncertain response/i)).toBeVisible();

  await switchSelectedSale(page, testInfo.project.name, /Sale from 2019/);
  await expect(page.getByRole('heading', { name: 'Sale from 2019' })).toBeVisible();
  for (const privateValue of [
    'A unsaved private reference',
    'A unsaved private correction note',
    'A unsaved shared sealed message',
    'A unsaved artwork sealed message',
    'BCDE-FGHJ-KMNP-QRST',
    'private-invitation-token',
  ]) await expect(page.getByText(privateValue, { exact: false })).toHaveCount(0);
  await expect(page.getByText(/detail action has an uncertain response/i)).toHaveCount(0);
  await expect(page.getByLabel('Shared sealed message')).toHaveValue('');
  const bUnresolved = page.getByRole('group', { name: 'Artwork 1 actions' });
  await expect(bUnresolved.getByLabel('Identify artwork')).toHaveValue('');
  await expect(bUnresolved.getByLabel('Media role')).toHaveValue('identification_evidence');
  await expect(bUnresolved.getByLabel('Artwork-specific sealed message')).toHaveValue('');
  await expect(page.getByRole('group', { name: 'Artwork 3 actions' }).getByLabel('Invitation recipient')).toHaveValue('b-owner@example.com');

  await page.getByRole('button', { name: 'Correct sale facts' }).click();
  await expect(page.getByLabel('Corrected buyer email')).toHaveValue('b-owner@example.com');
  await expect(page.getByLabel('Corrected private reference')).toHaveValue('B private reference');
  await expect(page.getByLabel('Corrected private notes')).toHaveValue('B stored private note');
  await page.getByLabel('Corrected buyer email').fill('');
  await page.getByLabel('Corrected private reference').fill('');
  await page.getByLabel('Corrected private notes').fill('B new private note');
  await page.getByLabel('Correction reason').fill('B correction only');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('B correction only')).toBeVisible();

  const captured = await page.evaluate(async () => (window as any).__salesTestState());
  const bCorrection = captured.requests.findLast((item: any) => item.body?.action === 'correctSale');
  expect(bCorrection.body).toEqual({
    action: 'correctSale',
    expectedSequence: 0,
    occurrence: { precision: 'year', value: '2019' },
    buyerEmail: null,
    total: null,
    privateReference: null,
    privateNotes: 'B new private note',
    reason: 'B correction only',
    idempotencyKey: expect.any(String),
  });
  expect(JSON.stringify(bCorrection.body)).not.toContain('A unsaved');

  await switchSelectedSale(page, testInfo.project.name, /Sale from 2017/);
  await expect(page.getByText(/detail action has an uncertain response/i)).toBeVisible();
  await page.getByRole('button', { name: 'Correct sale facts' }).click();
  await expect(page.getByLabel('Corrected buyer email')).toBeDisabled();
  await page.getByRole('button', { name: 'Retry exact action' }).click();
  await expect(page.getByText(/detail action has an uncertain response/i)).toBeVisible();
  let retried = await page.evaluate(async () => (window as any).__salesTestState());
  const frozenCorrections = retried.requests.filter((item: any) => item.body?.reason === 'Freeze A private correction');
  expect(frozenCorrections).toHaveLength(2);
  expect(frozenCorrections[1].body).toEqual(frozenCorrections[0].body);

  await page.getByRole('button', { name: 'Cancel frozen action' }).click();
  await expect(page.getByText(/detail action has an uncertain response/i)).toHaveCount(0);
  await expect(page.getByLabel('Corrected buyer email')).toBeEnabled();
  await page.getByLabel('Corrected buyer email').fill('a-after-cancel@example.com');
  await page.getByLabel('Correction reason').fill('A correction after explicit cancel');
  await page.getByRole('button', { name: 'Save correction' }).click();
  await expect(page.getByText('A correction after explicit cancel')).toBeVisible();
  retried = await page.evaluate(async () => (window as any).__salesTestState());
  const afterCancel = retried.requests.find((item: any) => item.body?.reason === 'A correction after explicit cancel');
  expect(afterCancel.body.idempotencyKey).not.toBe(frozenCorrections[0].body.idempotencyKey);
});

test('routes delayed registration and invitation secrets back to their sale and artwork', async ({ page }, testInfo) => {
  const saleA = seededDetail(
    'sale-secret-a', '2015', 'secret-a@example.com', 'Secret A reference', 'Secret A note',
    [seededArtwork('secret-a', 1, 'identified'), seededArtwork('secret-a', 2, 'identity_linked')],
  );
  const saleB = seededDetail(
    'sale-secret-b', '2021', 'secret-b@example.com', 'Secret B reference', 'Secret B note',
    [seededArtwork('secret-b', 1, 'identified')],
  );
  const controls = await installSalesMock(page, {
    seedDetails: [saleA, saleB], deferRegistration: true, deferInvitation: true,
  });
  const browserDiagnostics: string[] = [];
  page.on('console', message => browserDiagnostics.push(message.text()));
  page.on('pageerror', error => browserDiagnostics.push(error.message));
  await page.goto('/admin/collector-sales');
  await page.getByRole('button', { name: /Sale from 2015/ }).click();

  await page.getByRole('group', { name: 'Artwork 1 actions' }).getByRole('button', { name: 'Register artwork' }).click();
  await switchSelectedSale(page, testInfo.project.name, /Sale from 2021/);
  controls.resolveRegistration();
  await expect(page.getByRole('heading', { name: 'Sale from 2021' })).toBeVisible();
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toHaveCount(0);
  await switchSelectedSale(page, testInfo.project.name, /Sale from 2015/);
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss Ownership Code' }).click();

  const linkedArtwork = page.getByRole('group', { name: 'Artwork 2 actions' });
  await linkedArtwork.getByLabel('Invitation recipient').fill('delayed-invite@example.com');
  await linkedArtwork.getByRole('button', { name: 'Create invitation' }).click();
  await switchSelectedSale(page, testInfo.project.name, /Sale from 2021/);
  controls.resolveInvitation();
  await expect(page.getByText('private-invitation-token')).toHaveCount(0);
  await switchSelectedSale(page, testInfo.project.name, /Sale from 2015/);
  await expect(page.getByText('private-invitation-token')).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss invitation token' }).click();

  await switchSelectedSale(page, testInfo.project.name, /Sale from 2021/);
  await switchSelectedSale(page, testInfo.project.name, /Sale from 2015/);
  await expect(page.getByText('BCDE-FGHJ-KMNP-QRST')).toHaveCount(0);
  await expect(page.getByText('private-invitation-token')).toHaveCount(0);

  const captured = await page.evaluate(async () => (window as any).__salesTestState());
  expect(captured.requests.filter((item: any) => item.method === 'POST' && item.url.includes('/registrations'))).toHaveLength(1);
  expect(captured.requests.filter((item: any) => item.method === 'POST' && item.url.endsWith('/invitations'))).toHaveLength(1);
  const browserStorage = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  const privacyObservation = [page.url(), browserStorage, ...browserDiagnostics].join('\n');
  expect(privacyObservation).not.toContain('BCDE-FGHJ-KMNP-QRST');
  expect(privacyObservation).not.toContain('private-invitation-token');
});

test('fails closed after a valid sale when the next detail response is inconsistent', async ({ page }, testInfo) => {
  const valid = seededDetail(
    'sale-valid', '2016', 'valid-private@example.com', 'Valid private reference', 'Valid private note',
    [seededArtwork('valid', 1, 'identified')],
  );
  const originalFacts = saleFacts(valid.originalSale);
  const changedFacts = { ...originalFacts, privateNotes: 'Temporary corrected note' };
  valid.corrections = [
    { saleEventId: 'valid-event-1', sequence: 1, reason: 'Temporary correction', createdAt: now, before: originalFacts, after: changedFacts },
    { saleEventId: 'valid-event-2', sequence: 2, reason: 'Restored original facts', createdAt: now, before: changedFacts, after: originalFacts },
  ];
  valid.events = valid.corrections.map(correction => ({
    saleEventId: correction.saleEventId,
    sequence: correction.sequence,
    eventType: 'corrected',
    reason: correction.reason,
    createdAt: correction.createdAt,
  }));
  valid.effectiveSale = { ...valid.originalSale, sequence: 2 };
  valid.sale = valid.effectiveSale;
  const malformed = seededDetail(
    'sale-malformed', '2020', 'malformed@example.com', 'Malformed private reference', 'Malformed private note',
    [seededArtwork('malformed', 1, 'identified')],
  );
  await installSalesMock(page, {
    seedDetails: [valid, malformed],
    malformedSaleIds: ['sale-malformed'],
  });
  await page.goto('/admin/collector-sales');
  await page.getByRole('button', { name: /Sale from 2016/ }).click();
  const selectedWorkspace = page.getByRole('region', { name: 'Selected record workspace' });
  await expect(selectedWorkspace.getByRole('heading', { name: 'Originally recorded' })).toBeVisible();
  await expect(selectedWorkspace.getByRole('heading', { name: 'Current corrected record' })).toBeVisible();
  await expect(selectedWorkspace.getByText('Valid private reference').first()).toBeVisible();
  await expect(selectedWorkspace.getByText('Valid private note').first()).toBeVisible();

  await switchSelectedSale(page, testInfo.project.name, /Sale from 2020/);
  const integrityError = page.getByRole('alert').filter({ hasText: /could not be verified/i });
  await expect(integrityError).toBeVisible();
  await expect(integrityError.getByRole('button', { name: 'Retry record' })).toBeVisible();
  await expect(integrityError.getByRole('button', { name: 'Back to records' })).toBeVisible();
  await expect(selectedWorkspace.getByRole('heading', { name: 'Originally recorded' })).toHaveCount(0);
  await expect(selectedWorkspace.getByRole('heading', { name: 'Current corrected record' })).toHaveCount(0);
  await expect(selectedWorkspace.getByText('valid-private@example.com')).toHaveCount(0);
  await expect(selectedWorkspace.getByText('Valid private reference')).toHaveCount(0);
  await expect(selectedWorkspace.getByText('Valid private note')).toHaveCount(0);
  await expect(selectedWorkspace.getByText('Temporary corrected note')).toHaveCount(0);
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
});
