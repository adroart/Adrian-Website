import path from 'path';
import { readFileSync, realpathSync, writeFileSync, readdirSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import matter from 'gray-matter';
import type { Plugin } from 'vite';

function generateStoriesPlugin(): Plugin {
  const STORIES_DIR = path.resolve(__dirname, 'content/stories');
  const OUTPUT_FILE = path.resolve(__dirname, 'data/generatedStories.ts');

  function bodyToContent(raw: string): string[] {
    return raw
      .trim()
      .split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => {
        const lines = p.split('\n');
        if (lines.every(l => l.startsWith('>'))) {
          const stripped = lines
            .map(l => (l.startsWith('> ') ? l.slice(2) : l.slice(1).trim()))
            .join('\n');
          return '> ' + stripped;
        }
        return p;
      });
  }

  function generate() {
    const files = readdirSync(STORIES_DIR).filter(f => f.endsWith('.md')).sort();
    const stories = files.map(file => {
      const raw = readFileSync(path.join(STORIES_DIR, file), 'utf-8');
      const { data: fm, content: body } = matter(raw);
      const slug = path.basename(file, '.md');
      return {
        id: slug,
        slug,
        title: fm.title as string,
        subtitle: fm.subtitle as string | undefined,
        date: fm.date as string,
        category: fm.category as string,
        excerpt: fm.excerpt as string,
        content: bodyToContent(body),
        image: fm.image as string | undefined,
        readMinutes: fm.readMinutes as number,
        tags: (fm.tags ?? []) as string[],
        isFeatured: (fm.isFeatured ?? false) as boolean,
        relatedArtifactId: fm.relatedArtifactId as string | undefined,
        tracks: fm.tracks as { title: string; url: string; duration?: string }[] | undefined,
        lyrics: fm.lyrics as string[] | undefined,
        _order: (fm.order ?? 999) as number,
      };
    });
    stories.sort((a, b) => a._order - b._order);
    const output = stories.map(({ _order: _o, ...s }) => s);
    const fileContent = `// AUTO-GENERATED - do not edit. Source: content/stories/*.md
// Regenerated automatically by Vite on dev start, file change, and build.
import type { Story } from '../types'

export const STORIES: Story[] = ${JSON.stringify(output, null, 2)}
`;
    writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`✓ Stories: generated ${output.length} → data/generatedStories.ts`);
  }

  return {
    name: 'generate-stories',
    buildStart() {
      generate();
    },
    configureServer(server) {
      server.watcher.add(STORIES_DIR);
      const onChange = (file: string) => {
        if (file.startsWith(STORIES_DIR) && file.endsWith('.md')) {
          generate();
          server.ws.send({ type: 'full-reload' });
        }
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

function mockApiPlugin(): Plugin {
  const nowIso = () => new Date().toISOString();
  const makeToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  let presetId = 3;
  let invoiceId = 1;
  const presets = [
    {
      id: 1,
      label: 'Wise placeholder',
      method: 'wise',
      currency: 'USD',
      instructions: 'Use your Wise payment link here.',
      details: 'Replace this placeholder with your Wise account details or reference instructions.',
      url: 'https://wise.com',
      isDefault: true,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 2,
      label: 'Crypto placeholder',
      method: 'crypto',
      currency: 'USD',
      instructions: 'Pay with crypto using the wallet details below.',
      details: 'Network: Add network, for example BTC, ETH, or USDC\nWallet: Add wallet address\nReference: Invoice number',
      url: '',
      isDefault: false,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: 3,
      label: 'Bank transfer placeholder',
      method: 'bank',
      currency: 'USD',
      instructions: 'Transfer to the account details below.',
      details: 'Account name: Adrian Rasmussen\nBank: Add bank name\nAccount: Add account number\nReference: Invoice number',
      url: '',
      isDefault: false,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  ];
  const invoices: any[] = [];
  let registryUnlocked = false;
  let maintenanceAcquisitionId = 1;
  let maintenanceStewardVersion = 1;
  const maintenanceUsers = new Map([
    ['verified-steward@example.test', { id: 'local-verified-steward', verified: true }],
    ['replay-steward@example.test', { id: 'local-replay-steward', verified: true }],
    ['unverified-steward@example.test', { id: 'local-unverified-steward', verified: false }],
  ]);
  const maintenanceMutationAttempts = new Map<string, {
    signature: string;
    result: Record<string, unknown>;
  }>();
  const maintenancePiece: any = {
    id: 'kp-local-maintenance',
    public: {
      artworkId: 'UL-100',
      title: 'Art of Living - 32',
      series: 'Universal Language',
      editionNumber: 0,
      editionSize: null,
      publicCode: 'AR-7KQ9M2WX',
      plateStatus: 'active',
    },
    physical: {
      registeredAt: '2026-07-20T00:00:00.000Z',
      plateGeneratedAt: '2026-07-20T00:00:00.000Z',
      plateActivatedAt: '2026-07-21T00:00:00.000Z',
      recordVersion: 1,
      recovery: {
        verifierPresent: true,
        envelopePresent: true,
        backupStatus: 'verified',
        backupAt: '2026-07-21T00:00:00.000Z',
      },
    },
    stewardVersion: 1,
    steward: {
      userId: 'local-keeper',
      email: 'keeper@example.test',
      active: true,
      currentDisplayLocation: 'Ubud studio',
      claimedAt: '2026-07-22T00:00:00.000Z',
      releasedAt: null,
      stewardVersion: 1,
    },
    acquisitions: [],
    creatorHistory: [],
    maintenanceHistory: [],
  };

  function maintenanceSummary() {
    return {
      id: maintenancePiece.id,
      artworkId: maintenancePiece.public.artworkId,
      title: maintenancePiece.public.title,
      editionNumber: maintenancePiece.public.editionNumber,
      publicCode: maintenancePiece.public.publicCode,
      plateStatus: maintenancePiece.public.plateStatus,
    };
  }

  function stableMockValue(value: any): any {
    if (Array.isArray(value)) return value.map(stableMockValue);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stableMockValue(value[key])]),
    );
  }

  function maintenanceMutationSignature(value: any): string {
    return JSON.stringify(stableMockValue(value));
  }

  function replayMaintenanceMutation(
    res: any,
    idempotencyKey: unknown,
    signature: string,
  ): boolean {
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      send(res, 400, { ok: false, error: 'invalid_idempotency_key' });
      return true;
    }
    const existing = maintenanceMutationAttempts.get(idempotencyKey.trim());
    if (!existing) return false;
    if (existing.signature !== signature) {
      send(res, 409, { ok: false, error: 'idempotency_conflict' });
      return true;
    }
    send(res, 200, { ok: true, replayed: true, ...existing.result });
    return true;
  }

  const mockAcquisitionFields = new Set([
    'acquisitionType', 'acquiredAt', 'amountMinor', 'currency', 'acquirerReference',
    'privateNotes', 'documentReference', 'publicProvenance',
  ]);
  const mockAcquisitionTypes = new Set([
    'sale', 'gift', 'retained', 'loan', 'consignment', 'inheritance', 'other',
  ]);
  const mockTextLimits: Record<string, number> = {
    acquirerReference: 200,
    privateNotes: 5000,
    documentReference: 1000,
    publicProvenance: 2000,
  };

  function normalizeMockAcquisition(input: any): { ok: true; acquisition: any } | { ok: false; error: string } {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'invalid_input' };
    if (Object.keys(input).some(key => !mockAcquisitionFields.has(key))) return { ok: false, error: 'unknown_field' };
    const acquisitionType = typeof input.acquisitionType === 'string' ? input.acquisitionType.trim().toLowerCase() : '';
    if (!mockAcquisitionTypes.has(acquisitionType)) return { ok: false, error: 'invalid_acquisition_type' };

    const acquiredAt = input.acquiredAt === undefined || input.acquiredAt === null || input.acquiredAt === ''
      ? null
      : typeof input.acquiredAt === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(input.acquiredAt.trim())
        && !Number.isNaN(new Date(input.acquiredAt.trim().length === 10 ? `${input.acquiredAt.trim()}T00:00:00.000Z` : input.acquiredAt.trim()).getTime())
        ? input.acquiredAt.trim()
        : undefined;
    if (acquiredAt === undefined) return { ok: false, error: 'invalid_acquired_at' };

    const amountProvided = input.amountMinor !== undefined && input.amountMinor !== null;
    const currencyValue = typeof input.currency === 'string' ? input.currency.trim() : input.currency;
    const currencyProvided = currencyValue !== undefined && currencyValue !== null && currencyValue !== '';
    if (amountProvided && !currencyProvided) return { ok: false, error: 'currency_required' };
    if (!amountProvided && currencyProvided) return { ok: false, error: 'amount_required' };
    if (amountProvided && (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0)) {
      return { ok: false, error: 'invalid_amount' };
    }
    const currency = amountProvided && typeof currencyValue === 'string' ? currencyValue.toUpperCase() : null;
    if (amountProvided && !/^[A-Z]{3}$/.test(currency || '')) return { ok: false, error: 'invalid_currency' };

    const text: Record<string, string | null> = {};
    for (const [field, limit] of Object.entries(mockTextLimits)) {
      const value = input[field];
      if (value === undefined || value === null || value === '') {
        text[field] = null;
      } else if (typeof value !== 'string') {
        return { ok: false, error: `${field}_invalid` };
      } else if (value.trim().length > limit) {
        return { ok: false, error: `${field.replace(/[A-Z]/g, match => `_${match.toLowerCase()}`)}_too_long` };
      } else {
        text[field] = value.trim() || null;
      }
    }
    return {
      ok: true,
      acquisition: {
        acquisitionType,
        acquiredAt,
        amountMinor: amountProvided ? input.amountMinor : null,
        currency,
        ...text,
      },
    };
  }

  function validateMockMaintenanceBody(body: any, correcting: boolean):
    | { ok: false; error: string }
    | { ok: true; idempotencyKey: string; reason: string; expectedVersion: number | null; acquisition: any } {
    const allowed = correcting
      ? new Set(['idempotencyKey', 'reason', 'expectedVersion', 'acquisition'])
      : new Set(['idempotencyKey', 'reason', 'acquisition']);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !allowed.has(key))) {
      return { ok: false as const, error: 'invalid_input' };
    }
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > 128) return { ok: false as const, error: 'invalid_idempotency_key' };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return { ok: false as const, error: 'reason_required' };
    if (reason.length > 500) return { ok: false as const, error: 'reason_too_long' };
    if (correcting && (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1)) {
      return { ok: false as const, error: 'invalid_expected_version' };
    }
    const acquisition = normalizeMockAcquisition(body.acquisition);
    if ('error' in acquisition) return { ok: false, error: acquisition.error };
    return {
      ok: true as const,
      idempotencyKey,
      reason,
      expectedVersion: correcting ? body.expectedVersion : null,
      acquisition: acquisition.acquisition,
    };
  }

  function validateMockStewardAction(body: any):
    | { ok: false; error: string }
    | {
        ok: true;
        action: 'transfer_steward';
        targetEmail: string;
        targetUserId: string;
        transferKind: 'sale' | 'gift' | 'inheritance' | 'artist-rebind';
        reason: string;
        idempotencyKey: string;
        expectedStewardVersion: number;
      } {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { ok: false, error: 'invalid_input' };
    }
    if (body.action !== 'transfer_steward') {
      return { ok: false, error: 'invalid_action' };
    }
    const allowed = new Set([
      'action', 'targetEmail', 'transferKind', 'reason', 'idempotencyKey',
      'expectedStewardVersion',
    ]);
    if (Object.keys(body).length !== allowed.size
      || Object.keys(body).some(key => !allowed.has(key))) {
      return { ok: false, error: 'invalid_input' };
    }
    if (!Number.isSafeInteger(body.expectedStewardVersion) || body.expectedStewardVersion < 0) {
      return { ok: false, error: 'invalid_expected_steward_version' };
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) return { ok: false, error: 'reason_required' };
    if (reason.length > 500) return { ok: false, error: 'reason_too_long' };
    const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    if (!idempotencyKey || idempotencyKey.length > 128) {
      return { ok: false, error: 'invalid_idempotency_key' };
    }
    const transferKinds = new Set(['sale', 'gift', 'inheritance', 'artist-rebind']);
    if (!transferKinds.has(body.transferKind)) return { ok: false, error: 'invalid_transfer_kind' };
    const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail.trim().toLowerCase() : '';
    if (!targetEmail) return { ok: false, error: 'target_email_required' };
    if (targetEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return { ok: false, error: 'invalid_target_email' };
    }
    const target = maintenanceUsers.get(targetEmail);
    if (!target) return { ok: false, error: 'target_not_found' };
    if (!target.verified) return { ok: false, error: 'target_unverified' };
    return {
      ok: true, action: body.action, targetEmail, targetUserId: target.id,
      transferKind: body.transferKind, reason, idempotencyKey,
      expectedStewardVersion: body.expectedStewardVersion,
    };
  }

  function devAdminStatus(req: any): 'authorized' | 'guest' | 'forbidden' {
    const header = req.headers['x-dev-admin-status'];
    if (header === 'guest' || header === 'forbidden') return header;
    return 'authorized';
  }

  function send(res: any, status: number, body: unknown) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  function readBody(req: any): Promise<any> {
    return new Promise(resolve => {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk; });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
      });
    });
  }

  function paymentOptionsFor(ids: number[]) {
    return ids
      .map(id => presets.find(preset => preset.id === id && preset.isActive))
      .filter(Boolean)
      .map(preset => ({
        id: preset!.id,
        label: preset!.label,
        method: preset!.method,
        currency: preset!.currency,
        instructions: preset!.instructions,
        details: preset!.details,
        url: preset!.url,
      }));
  }

  function serializeInvoice(input: any) {
    const subtotalCents = (input.lineItems || []).reduce((sum: number, item: any) => sum + Number(item.amountCents || 0), 0);
    const totalCents = Number(input.totalCents || subtotalCents);
    const paymentPresetIds = Array.isArray(input.paymentPresetIds)
      ? input.paymentPresetIds.map(Number).filter(Boolean)
      : input.paymentPresetId ? [Number(input.paymentPresetId)] : [];
    const paymentOptions = paymentOptionsFor(paymentPresetIds);
    const currentStep = input.paymentSchedule?.[input.currentStepIndex || 0];
    return {
      id: input.id,
      invoiceNumber: input.invoiceNumber,
      publicToken: input.publicToken,
      publicUrlPath: `/invoice/${input.publicToken}`,
      status: input.status || 'draft',
      clientName: input.clientName || '',
      clientEmail: input.clientEmail || '',
      clientLocation: input.clientLocation || '',
      jobTitle: input.jobTitle || '',
      jobDescription: input.jobDescription || '',
      currency: input.currency || 'USD',
      lineItems: input.lineItems || [],
      paymentSchedule: input.paymentSchedule || [],
      currentStepIndex: input.currentStepIndex || 0,
      subtotalCents,
      shippingText: input.shippingText || 'To be confirmed',
      totalCents,
      dueTodayCents: Number(input.dueTodayCents || currentStep?.amountCents || totalCents),
      paymentPresetId: paymentPresetIds[0] || null,
      paymentPresetIds,
      paymentSnapshot: paymentOptions[0] || {},
      paymentOptions,
      notes: input.notes || '',
      createdAt: input.createdAt || nowIso(),
      updatedAt: nowIso(),
      sentAt: input.sentAt || null,
      paidAt: input.paidAt || null,
    };
  }

  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use('/api/admin/verify', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const status = devAdminStatus(req);
        if (status === 'guest') return send(res, 401, { ok: false, error: 'unauthorized' });
        if (status === 'forbidden') return send(res, 403, { ok: false, error: 'forbidden' });
        return send(res, 200, {
          ok: true,
          admin: { id: 'local-dev-admin', email: 'local-admin@example.test' },
        });
      });

      server.middlewares.use('/api/admin/overview', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const status = devAdminStatus(req);
        if (status === 'guest') return send(res, 401, { ok: false, error: 'unauthorized' });
        if (status === 'forbidden') return send(res, 403, { ok: false, error: 'forbidden' });
        return send(res, 200, {
          ok: true,
          attention: { plates: 0, draftViewings: 0, openInvoices: 0 },
        });
      });

      server.middlewares.use('/api/admin/maintenance', async (req, res, next) => {
        const status = devAdminStatus(req);
        if (status === 'guest') return send(res, 401, { ok: false, error: 'unauthorized' });
        if (status === 'forbidden') return send(res, 403, { ok: false, error: 'forbidden' });
        const url = new URL(req.url || '/', 'http://local.dev');

        if (req.method === 'GET' && url.pathname === '/') {
          const allowedSearch = new Set(['publicCode', 'artworkId', 'title', 'editionNumber']);
          if ([...url.searchParams.keys()].some(key => !allowedSearch.has(key))) {
            return send(res, 400, { ok: false, error: 'unknown_filter' });
          }
          const summary = maintenanceSummary();
          const matches = (
            (!url.searchParams.get('publicCode') || summary.publicCode.toLowerCase() === url.searchParams.get('publicCode')!.toLowerCase())
            && (!url.searchParams.get('artworkId') || summary.artworkId.toLowerCase() === url.searchParams.get('artworkId')!.toLowerCase())
            && (!url.searchParams.get('title') || summary.title.toLowerCase().includes(url.searchParams.get('title')!.toLowerCase()))
            && (!url.searchParams.has('editionNumber') || summary.editionNumber === Number(url.searchParams.get('editionNumber')))
          );
          return send(res, 200, { ok: true, pieces: matches ? [summary] : [] });
        }

        const detailMatch = url.pathname.match(/^\/([^/]+)$/);
        if (req.method === 'GET' && detailMatch) {
          return detailMatch[1] === maintenancePiece.id
            ? send(res, 200, { ok: true, piece: maintenancePiece })
            : send(res, 404, { ok: false, error: 'not_found' });
        }

        const stewardActionMatch = url.pathname.match(/^\/([^/]+)\/actions$/);
        if (req.method === 'POST' && stewardActionMatch) {
          if (!registryUnlocked) return send(res, 403, { ok: false, error: 'registry_locked' });
          if (stewardActionMatch[1] !== maintenancePiece.id) {
            return send(res, 404, { ok: false, error: 'not_found' });
          }
          const body = await readBody(req);
          const validated = validateMockStewardAction(body);
          if ('error' in validated) return send(res, 400, { ok: false, error: validated.error });
          const signature = maintenanceMutationSignature({
            action: validated.action,
            keeperPieceId: maintenancePiece.id,
            targetEmail: validated.targetEmail,
            transferKind: validated.transferKind,
            reason: validated.reason,
            expectedStewardVersion: validated.expectedStewardVersion,
          });
          if (replayMaintenanceMutation(res, validated.idempotencyKey, signature)) return;
          if (maintenanceStewardVersion !== validated.expectedStewardVersion) {
            return send(res, 409, { ok: false, error: 'version_conflict' });
          }
          if (!maintenancePiece.steward) {
            return send(res, 409, { ok: false, error: 'no_current_steward' });
          }
          if (maintenancePiece.steward.userId === validated.targetUserId) {
            return send(res, 409, { ok: false, error: 'target_is_current_steward' });
          }
          const before = {
            keeperPieceId: maintenancePiece.id,
            artworkId: maintenancePiece.public.artworkId,
            keeperUserId: maintenancePiece.steward?.userId ?? null,
            claimedAt: maintenancePiece.steward?.claimedAt ?? null,
            releasedAt: maintenancePiece.steward?.releasedAt ?? null,
            currentDisplayLocation: maintenancePiece.steward?.currentDisplayLocation ?? null,
            stewardVersion: maintenanceStewardVersion,
          };
          const createdAt = nowIso();
          maintenanceStewardVersion += 1;
          maintenancePiece.stewardVersion = maintenanceStewardVersion;
          const after = {
            keeperPieceId: maintenancePiece.id,
            artworkId: maintenancePiece.public.artworkId,
            keeperUserId: validated.targetUserId,
            claimedAt: createdAt,
            releasedAt: null,
            currentDisplayLocation: null,
            stewardVersion: maintenanceStewardVersion,
          };
          maintenancePiece.steward = {
            userId: after.keeperUserId,
            email: validated.targetEmail,
            active: true,
            currentDisplayLocation: after.currentDisplayLocation,
            claimedAt: after.claimedAt,
            releasedAt: after.releasedAt,
            stewardVersion: after.stewardVersion,
          };
          const eventId = `rme-local-${maintenancePiece.maintenanceHistory.length + 1}`;
          maintenancePiece.maintenanceHistory.push({
            id: eventId,
            idempotencyKey: validated.idempotencyKey,
            eventType: 'steward_transferred',
            administrator: { userId: 'local-dev-admin', email: 'local-admin@example.test' },
            reason: validated.reason,
            before,
            after,
            outcome: 'succeeded',
            relatedRecordId: maintenancePiece.id,
            createdAt,
          });
          maintenanceMutationAttempts.set(validated.idempotencyKey, {
            signature,
            result: { eventId, steward: after },
          });
          return send(res, 200, { ok: true, replayed: false, eventId, steward: after });
        }

        const createMatch = url.pathname.match(/^\/([^/]+)\/acquisitions$/);
        if (req.method === 'POST' && createMatch) {
          if (!registryUnlocked) return send(res, 403, { ok: false, error: 'registry_locked' });
          if (createMatch[1] !== maintenancePiece.id) return send(res, 404, { ok: false, error: 'not_found' });
          const body = await readBody(req);
          const validated = validateMockMaintenanceBody(body, false);
          if ('error' in validated) return send(res, 400, { ok: false, error: validated.error });
          const signature = maintenanceMutationSignature({
            operation: 'create_acquisition',
            keeperPieceId: createMatch[1],
            reason: validated.reason,
            acquisition: validated.acquisition,
          });
          if (replayMaintenanceMutation(res, validated.idempotencyKey, signature)) return;
          const createdAt = nowIso();
          const acquisition = {
            acquisitionId: `acq-local-${maintenanceAcquisitionId}`,
            keeperPieceId: maintenancePiece.id,
            ...validated.acquisition,
            recordVersion: 1,
            createdAt,
            updatedAt: createdAt,
          };
          maintenanceAcquisitionId += 1;
          maintenancePiece.acquisitions.push(acquisition);
          maintenancePiece.maintenanceHistory.push({
            id: `rme-local-${maintenancePiece.maintenanceHistory.length + 1}`,
            idempotencyKey: validated.idempotencyKey,
            eventType: 'acquisition_created',
            administrator: { userId: 'local-dev-admin', email: 'local-admin@example.test' },
            reason: validated.reason,
            before: null,
            after: acquisition,
            outcome: 'succeeded',
            relatedRecordId: acquisition.acquisitionId,
            createdAt,
          });
          maintenanceMutationAttempts.set(validated.idempotencyKey, {
            signature,
            result: { acquisition },
          });
          return send(res, 201, { ok: true, replayed: false, acquisition });
        }

        const correctionMatch = url.pathname.match(/^\/([^/]+)\/acquisitions\/([^/]+)$/);
        if (req.method === 'PUT' && correctionMatch) {
          if (!registryUnlocked) return send(res, 403, { ok: false, error: 'registry_locked' });
          const body = await readBody(req);
          const validated = validateMockMaintenanceBody(body, true);
          if ('error' in validated) return send(res, 400, { ok: false, error: validated.error });
          const signature = maintenanceMutationSignature({
            operation: 'correct_acquisition',
            keeperPieceId: correctionMatch[1],
            acquisitionId: correctionMatch[2],
            expectedVersion: validated.expectedVersion,
            reason: validated.reason,
            acquisition: validated.acquisition,
          });
          if (replayMaintenanceMutation(res, validated.idempotencyKey, signature)) return;
          const acquisitionIndex = maintenancePiece.acquisitions.findIndex(
            (item: any) => item.acquisitionId === correctionMatch[2] && item.keeperPieceId === correctionMatch[1],
          );
          if (acquisitionIndex < 0) return send(res, 404, { ok: false, error: 'not_found' });
          const before = maintenancePiece.acquisitions[acquisitionIndex];
          if (before.recordVersion !== validated.expectedVersion) {
            return send(res, 409, { ok: false, error: 'version_conflict' });
          }
          const updatedAt = nowIso();
          const acquisition = {
            ...before,
            ...validated.acquisition,
            recordVersion: before.recordVersion + 1,
            updatedAt,
          };
          maintenancePiece.acquisitions[acquisitionIndex] = acquisition;
          maintenancePiece.maintenanceHistory.push({
            id: `rme-local-${maintenancePiece.maintenanceHistory.length + 1}`,
            idempotencyKey: validated.idempotencyKey,
            eventType: 'acquisition_corrected',
            administrator: { userId: 'local-dev-admin', email: 'local-admin@example.test' },
            reason: validated.reason,
            before,
            after: acquisition,
            outcome: 'succeeded',
            relatedRecordId: acquisition.acquisitionId,
            createdAt: updatedAt,
          });
          maintenanceMutationAttempts.set(validated.idempotencyKey, {
            signature,
            result: { acquisition },
          });
          return send(res, 200, { ok: true, replayed: false, acquisition });
        }

        return next();
      });

      server.middlewares.use('/api/admin/pieces', (req, res, next) => {
        if (req.url !== '/' || req.method !== 'GET') return next();
        const status = devAdminStatus(req);
        if (status === 'guest') return send(res, 401, { ok: false, error: 'unauthorized' });
        if (status === 'forbidden') return send(res, 403, { ok: false, error: 'forbidden' });
        return send(res, 200, { ok: true, pieces: [] });
      });

      server.middlewares.use('/api/admin/registry-unlock', async (req, res, next) => {
        const status = devAdminStatus(req);
        if (status === 'guest') return send(res, 401, { ok: false, error: 'unauthorized' });
        if (status === 'forbidden') return send(res, 403, { ok: false, error: 'forbidden' });

        if (req.method === 'GET') {
          return send(res, 200, {
            ok: true,
            unlocked: registryUnlocked,
            expiresAt: registryUnlocked ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null,
          });
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          if (!body || typeof body !== 'object' || Array.isArray(body)
            || Object.keys(body).length !== 1 || !Object.hasOwn(body, 'secret')) {
            return send(res, 400, { ok: false, error: 'invalid_input' });
          }
          if (body.secret !== 'local-development-secret') {
            return send(res, 401, { ok: false, error: 'unlock_failed' });
          }
          registryUnlocked = true;
          return send(res, 200, { ok: true, expiresIn: 600 });
        }
        if (req.method === 'DELETE') {
          registryUnlocked = false;
          return send(res, 200, { ok: true, unlocked: false });
        }
        return next();
      });

      server.middlewares.use('/api/admin/payment-presets', async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://local.dev');
        const idMatch = url.pathname.match(/^\/(\d+)$/);
        if (idMatch && req.method === 'DELETE') {
          const id = Number(idMatch[1]);
          const preset = presets.find(item => item.id === id);
          if (!preset) return send(res, 404, { ok: false, error: 'not_found' });
          preset.isActive = false;
          return send(res, 200, { ok: true, preset });
        }
        if (idMatch && req.method !== 'DELETE') return next();
        if (url.pathname !== '/') return next();

        if (req.method === 'GET') {
          return send(res, 200, { ok: true, presets: presets.filter(preset => preset.isActive) });
        }

        if (req.method === 'POST') {
          const body = await readBody(req);
          if (body.isDefault) presets.forEach(preset => { preset.isDefault = false; });
          presetId += 1;
          const preset = {
            id: presetId,
            label: String(body.label || 'Payment option'),
            method: String(body.method || 'custom'),
            currency: String(body.currency || 'USD').toUpperCase().slice(0, 3),
            instructions: String(body.instructions || ''),
            details: String(body.details || ''),
            url: String(body.url || ''),
            isDefault: Boolean(body.isDefault),
            isActive: true,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          presets.push(preset);
          return send(res, 201, { ok: true, preset });
        }

        return next();
      });

      server.middlewares.use('/api/admin/invoices', async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://local.dev');
        const sendMatch = url.pathname.match(/^\/(\d+)\/send$/);
        if (sendMatch && req.method === 'POST') {
          const id = Number(sendMatch[1]);
          const invoice = invoices.find(item => item.id === id);
          if (!invoice) return send(res, 404, { ok: false, error: 'not_found' });
          invoice.status = invoice.status === 'draft' ? 'sent' : invoice.status;
          invoice.sentAt = invoice.sentAt || nowIso();
          invoice.updatedAt = nowIso();
          return send(res, 200, { ok: true, invoice, publicUrlPath: invoice.publicUrlPath });
        }

        const idMatch = url.pathname.match(/^\/(\d+)$/);
        if (idMatch) {
          const id = Number(idMatch[1]);
          const existingIndex = invoices.findIndex(item => item.id === id);
          if (existingIndex < 0) return send(res, 404, { ok: false, error: 'not_found' });

          if (req.method === 'PUT') {
            const body = await readBody(req);
            const updated = serializeInvoice({ ...invoices[existingIndex], ...body, id });
            invoices[existingIndex] = updated;
            return send(res, 200, { ok: true, invoice: updated });
          }

          if (req.method === 'DELETE') {
            invoices[existingIndex].status = 'void';
            invoices[existingIndex].updatedAt = nowIso();
            return send(res, 200, { ok: true, invoice: invoices[existingIndex] });
          }

          if (req.method === 'GET') return send(res, 200, { ok: true, invoice: invoices[existingIndex] });
          return next();
        }

        if (url.pathname !== '/') return next();
        if (req.method === 'GET') return send(res, 200, { ok: true, invoices });

        if (req.method === 'POST') {
          const body = await readBody(req);
          const nextInvoiceNumber = `AR-${new Date().getUTCFullYear()}-${String(invoiceId).padStart(3, '0')}`;
          const invoice = serializeInvoice({
            ...body,
            id: invoiceId,
            invoiceNumber: nextInvoiceNumber,
            publicToken: makeToken(),
          });
          invoiceId += 1;
          invoices.unshift(invoice);
          return send(res, 201, { ok: true, invoice });
        }

        return next();
      });

      server.middlewares.use('/api/invoices', (req, res, next) => {
        const url = new URL(req.url || '/', 'http://local.dev');
        const token = url.pathname.replace(/^\//, '');
        if (!token || req.method !== 'GET') return next();
        const invoice = invoices.find(item => item.publicToken === token && item.status !== 'void');
        if (!invoice) return send(res, 404, { ok: false, error: 'not_found' });
        return send(res, 200, { ok: true, invoice });
      });

      server.middlewares.use('/api/inquire', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { name, email, inquiryType, vision, commissionType } = data;
            if (!name || !email || (inquiryType !== 'purchase' && (!vision || !commissionType))) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Please fill in all required fields.' }));
              return;
            }
            console.log('\n[mock /api/inquire]', JSON.stringify(data, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: {
    port: 5555,
    host: '0.0.0.0',
    strictPort: true,
    fs: {
      allow: [
        __dirname,
        realpathSync(path.resolve(__dirname, 'node_modules')),
      ],
    },
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  plugins: [react(), generateStoriesPlugin(), mockApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@keystatic/')) return 'admin-keystatic';
          if (id.includes('/node_modules/@stripe/') || id.includes('/node_modules/stripe/')) return 'stripe';
          if (id.includes('/node_modules/lucide-react/')) return 'icons';
          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react-router') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
