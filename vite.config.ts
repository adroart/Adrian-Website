import path from 'path';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
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
          attention: { plates: 0, fulfillments: 0, draftViewings: 0, openInvoices: 0 },
        });
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
          if (typeof body.secret !== 'string' || !body.secret) {
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
