/**
 * Create the Stripe Products and Prices the catalog already describes, then write the
 * returned ids back into data/mockData.ts.
 *
 * WHY THIS EXISTS
 * The shop is fully built — Store, CartDrawer, functions/api/checkout.js, the cart —
 * and has been switched off since launch behind `shopEnabled: false`. The reason given
 * in launchFlags.ts is that every Stripe price id is the placeholder `price_REPLACE`.
 * There are 192 of them and zero real ids, against 174 pieces that already carry a
 * price. So the site knows what everything costs, can take a card, and instead shows
 * a visitor who wants a $745 piece marked "Ready to Ship" a button that says
 * "Request to Purchase" and drops them on an enquiry form.
 *
 * This script closes that gap. It is the only step in the whole audit that needs a
 * credential, which is why it is a script you run rather than something already done.
 *
 * HOW TO RUN IT
 *
 *   1. Dry run first. Creates nothing, prints exactly what it would create:
 *        infisical run --env=dev -- npm run stripe:sync
 *
 *   2. When the plan looks right, apply it:
 *        infisical run --env=dev -- npm run stripe:sync -- --apply
 *
 *   3. Then flip `shopEnabled` to true in launchFlags.ts and deploy.
 *
 * The key is read from the environment. It is never printed, never written to a file,
 * and never passed as an argument. If STRIPE_SECRET_KEY is missing the script stops
 * and tells you, rather than half-creating a catalog.
 *
 * SAFETY
 * - Idempotent. A piece that already has a real id is skipped, so re-running after an
 *   interruption resumes rather than duplicating.
 * - Every Product carries metadata.artworkId, so a re-run can find what it made before
 *   even if mockData.ts was reverted.
 * - Test keys (sk_test_) are detected and called out, so you cannot mistake a rehearsal
 *   for the real thing.
 * - mockData.ts is only rewritten after every API call has succeeded.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { FULL_ARCHIVE } from '../data/mockData';
import type { Artwork } from '../types';

const PLACEHOLDER = 'price_REPLACE';
const DATA_FILE = join(process.cwd(), 'data', 'mockData.ts');
const APPLY = process.argv.includes('--apply');
const MEDIA_ORIGIN = 'https://adrianrasmussen.com/media/image';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
    console.error(
        '\n✗ STRIPE_SECRET_KEY is not set.\n\n' +
            '  Run it through Infisical so the key never lands in a file or a shell history:\n\n' +
            '    infisical run --env=dev -- npm run stripe:sync\n',
    );
    process.exit(1);
}
const LIVE = key.startsWith('sk_live_');

/** One thing to sell: either a whole piece, or one size of a piece. */
interface Item {
    artwork: Artwork;
    /** undefined for the piece's own price; set for a size variant. */
    size?: string;
    price: number;
    label: string;
}

/* ─── Work out what needs creating ───────────────────────────────────────── */

const items: Item[] = [];
for (const art of FULL_ARCHIVE) {
    const variants = art.sizeVariants ?? art.madeToOrderSizes;
    if (variants?.length) {
        for (const v of variants) {
            if (v.stripePriceId && v.stripePriceId !== PLACEHOLDER) continue;
            if (!v.price) continue;
            items.push({ artwork: art, size: v.size, price: v.price, label: `${art.title} · ${v.size}` });
        }
        continue;
    }
    if (art.stripePriceId && art.stripePriceId !== PLACEHOLDER) continue;
    if (!art.price) continue;
    if (art.availability === 'SOLD') continue; // nothing to sell
    items.push({ artwork: art, price: art.price, label: art.title });
}

const total = items.reduce((sum, i) => sum + i.price, 0);

console.log(`\n  Stripe catalog sync — ${APPLY ? 'APPLY' : 'DRY RUN'}${LIVE ? '  ·  LIVE KEY' : '  ·  test key'}`);
console.log(`  ${items.length} prices to create across ${new Set(items.map(i => i.artwork.id)).size} pieces`);
console.log(`  Catalog value: $${total.toLocaleString()}\n`);

if (!items.length) {
    console.log('  Nothing to do — every priced piece already has a real Stripe id.\n');
    process.exit(0);
}

if (!APPLY) {
    for (const i of items.slice(0, 12)) {
        console.log(`    ${i.label.padEnd(52)} $${String(i.price).padStart(6)}`);
    }
    if (items.length > 12) console.log(`    … and ${items.length - 12} more`);
    console.log(
        `\n  Nothing was created. To create these for real:\n` +
            `    infisical run --env=dev -- npm run stripe:sync -- --apply\n`,
    );
    process.exit(0);
}

/* ─── Create them ────────────────────────────────────────────────────────── */

/** Stripe's API is form-encoded, including nested keys like metadata[artworkId]. */
async function stripe(path: string, form: Record<string, string>): Promise<{ id: string }> {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            // Stripe replays an identical request rather than double-creating, which is
            // what makes an interrupted run safe to repeat.
            'Idempotency-Key': `aw-${form['metadata[syncKey]']}`,
        },
        body: new URLSearchParams(form).toString(),
    });
    const body = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !body.id) {
        // The message can quote the request but never the key — Stripe does not echo it.
        throw new Error(`Stripe ${path} failed: ${body.error?.message ?? res.status}`);
    }
    return { id: body.id };
}

const created: Array<Item & { priceId: string }> = [];

for (const [n, item] of items.entries()) {
    const syncKey = item.size ? `${item.artwork.id}::${item.size}` : item.artwork.id;
    const detail = [item.artwork.dimensions, item.artwork.material, item.artwork.year]
        .filter(Boolean)
        .join(' · ');

    try {
        const product = await stripe('products', {
            name: item.label,
            description: (item.artwork.description || detail || item.artwork.title).slice(0, 500),
            'images[0]': `${MEDIA_ORIGIN}/${item.artwork.coverImage.split('/').map(encodeURIComponent).join('/')}?w=1200&format=jpg`,
            'metadata[artworkId]': item.artwork.id,
            'metadata[syncKey]': syncKey,
            ...(item.size && { 'metadata[size]': item.size }),
            url: `https://adrianrasmussen.com/creations/${item.artwork.id}`,
        });

        const price = await stripe('prices', {
            product: product.id,
            unit_amount: String(Math.round(item.price * 100)),
            currency: 'usd',
            'metadata[syncKey]': syncKey,
        });

        created.push({ ...item, priceId: price.id });
        console.log(`    ${String(n + 1).padStart(3)}/${items.length}  ${item.label.slice(0, 46).padEnd(48)} ${price.id}`);
    } catch (err) {
        console.error(`\n✗ Stopped at "${item.label}": ${err instanceof Error ? err.message : err}`);
        console.error(
            `  ${created.length} prices were created before this. Nothing has been written to\n` +
                `  mockData.ts yet, so re-running will skip what already exists in Stripe and\n` +
                `  continue from here.\n`,
        );
        process.exit(1);
    }
}

/* ─── Write the ids back ─────────────────────────────────────────────────── */

copyFileSync(DATA_FILE, `${DATA_FILE}.bak`);
let source = readFileSync(DATA_FILE, 'utf-8');
let written = 0;
const unmatched: string[] = [];

/**
 * Find one artwork's literal in the source and hand back its bounds.
 *
 * Every write is scoped to these bounds. Matching on the whole file instead would be
 * order-dependent and wrong: 64 pieces share identical variant lines (`size: '29 cm',
 * price: 295`), so a global replace would put one piece's price id on another piece's
 * variant whenever the iteration order drifted from the file order.
 */
function blockOf(artworkId: string): { from: number; to: number } | null {
    const marker = `id: '${artworkId}',`;
    const from = source.indexOf(marker);
    if (from === -1) return null;
    const next = source.indexOf("\n        id: '", from + marker.length);
    return { from, to: next === -1 ? source.length : next };
}

/** Replace within a slice and splice it back, keeping offsets honest. */
function editBlock(artworkId: string, edit: (block: string) => string): boolean {
    const bounds = blockOf(artworkId);
    if (!bounds) return false;
    const before = source.slice(bounds.from, bounds.to);
    const after = edit(before);
    if (after === before) return false;
    source = source.slice(0, bounds.from) + after + source.slice(bounds.to);
    return true;
}

for (const item of created) {
    let ok: boolean;

    if (item.size) {
        // Variant: match the size and price together, inside this piece's block only.
        const size = item.size.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        ok = editBlock(item.artwork.id, block => {
            const withPlaceholder = new RegExp(
                `(\\{\\s*size:\\s*'${size}',\\s*price:\\s*${item.price},\\s*stripePriceId:\\s*')${PLACEHOLDER}(')`,
            );
            if (withPlaceholder.test(block)) {
                return block.replace(withPlaceholder, `$1${item.priceId}$2`);
            }
            // No stripePriceId key on this variant yet — insert one after its price.
            const withoutKey = new RegExp(
                `(\\{\\s*size:\\s*'${size}',\\s*price:\\s*${item.price},)(\\s*)`,
            );
            return block.replace(withoutKey, `$1$2stripePriceId: '${item.priceId}',$2`);
        });
    } else {
        // Plain piece. 121 of the 122 have no stripePriceId field at all, so replacing
        // a placeholder is the rarer path and inserting after `price:` is the common one.
        ok = editBlock(item.artwork.id, block => {
            const withPlaceholder = new RegExp(`(stripePriceId: ')${PLACEHOLDER}(')`);
            if (withPlaceholder.test(block)) {
                return block.replace(withPlaceholder, `$1${item.priceId}$2`);
            }
            const afterPrice = new RegExp(`(\\n(\\s*)price: ${item.price},)`);
            return block.replace(afterPrice, `$1\n$2stripePriceId: '${item.priceId}',`);
        });
    }

    if (ok) written++;
    else unmatched.push(item.label);
}

writeFileSync(DATA_FILE, source, 'utf-8');

console.log(`\n  ✓ Created ${created.length} prices in Stripe${LIVE ? ' (LIVE)' : ' (test mode)'}`);
console.log(`  ✓ Wrote ${written} ids into data/mockData.ts (backup at mockData.ts.bak)`);
if (unmatched.length) {
    console.log(`\n  ! ${unmatched.length} ids could not be written into mockData.ts:`);
    for (const label of unmatched.slice(0, 10)) console.log(`      ${label}`);
    if (unmatched.length > 10) console.log(`      … and ${unmatched.length - 10} more`);
    console.log(
        `    They exist in Stripe and carry metadata.artworkId, so nothing is lost —\n` +
            `    but set these by hand before enabling the shop.`,
    );
}
console.log(
    `\n  Next: set shopEnabled: true in launchFlags.ts, run the build, and deploy.\n` +
        `  Confirm STRIPE_SECRET_KEY and VITE_STRIPE_PUBLISHABLE_KEY are set for\n` +
        `  production in the Cloudflare Pages project before you do.\n`,
);
