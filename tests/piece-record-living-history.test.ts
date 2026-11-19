import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { it } from 'node:test';
import { buildPieceRecord, canonicalRecordJson, renderPieceRecordHtml } from '../functions/api/_lib/pieceRecord.js';
import { writeLivingRecord, readPrivateLivingRecord } from '../functions/api/_lib/collectorLivingRecord.js';
import { createCaretakerPassing, acceptCaretakerPassing } from '../functions/api/_lib/caretakerPassing.js';
import { livingFixture, code, now, keeper, nextKeeper, author, secondAuthor } from './shared/living-record-fixture';

const options = { publicCode: code, trigger: 'on_demand', generatedAt: now, includeLegacySections: true };
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

it('portable public history survives a real sale, excluding unpublished entries and successor reading grants', async t => {
  const { env, DB, sqlite, grant } = await livingFixture();
  t.after(() => sqlite.close());
  await grant(author);
  await grant(secondAuthor);
  const publishedId = crypto.randomUUID();
  const privateId = crypto.randomUUID();
  const offeredId = crypto.randomUUID();
  const grantedId = crypto.randomUUID();
  const write = (userId: string, input: Record<string, unknown>) => writeLivingRecord(DB, code, userId, input, now);
  for (const [id, body] of [
    [publishedId, 'Sunlight <through> the wood.'], [privateId, 'Private unoffered words.'],
    [offeredId, 'Offered unpublished words.'], [grantedId, 'Successor reading only.'],
  ]) await write(author, { action: 'reflect', id, body });
  for (const id of [publishedId, offeredId]) await write(author, { action: 'offer', id });
  await write(keeper, { action: 'publish', id: publishedId });
  await write(author, { action: 'successor-access', kind: 'reflection', id: grantedId, allow: true });
  // Adult eligibility is required for deliberate public milestone publication.
  sqlite.prepare("UPDATE profiles SET birth_date = '1990-01-01' WHERE user_id = 4").run();
  const privatePlaceId = crypto.randomUUID();
  const milestone = { action: 'milestone', placeId: 'atlas-city-1', grain: 'region', year: 2025 };
  await write(keeper, { ...milestone, id: crypto.randomUUID(), visibility: 'public' });
  await write(keeper, { ...milestone, id: crypto.randomUUID(), grain: 'city', year: 2026, visibility: 'public' });
  await write(keeper, { ...milestone, id: privatePlaceId, year: 2024, visibility: 'private' });
  await write(keeper, { action: 'successor-access', kind: 'milestone', id: privatePlaceId, allow: true });

  const before = await buildPieceRecord(env, options);
  assert.equal(before.record.schemaVersion, 2);
  assert.deepEqual(before.record.livingHistory, {
    included: true,
    reflections: [{ words: 'Sunlight <through> the wood.', createdAt: now, publishedAt: now }],
    milestones: [
      { year: 2025, grain: 'region', place: 'Bali', country: 'Indonesia' },
      { year: 2026, grain: 'city', place: 'Denpasar', country: 'Indonesia' },
    ],
  });

  const passingEnv = { ...env, CARETAKER_PASSING_SECRET: 'portable-public-history-passing-secret' };
  const recipientEmail = `${nextKeeper}@example.test`;
  const { passing } = await createCaretakerPassing(passingEnv, {
    senderUserId: keeper, keeperPieceId: 'piece-one', recipientEmail, confirmedRecipientEmail: recipientEmail,
    transferKind: 'sale', idempotencyKey: 'portable-history-sale', now: '2026-11-17T09:00:00.000Z',
  });
  const token = createHmac('sha256', passingEnv.CARETAKER_PASSING_SECRET)
    .update(`caretaker-passing:v1:${passing.id}`).digest('hex');
  await acceptCaretakerPassing(passingEnv, {
    token, userId: nextKeeper, accountEmail: recipientEmail, emailVerified: true, now: '2026-11-17T10:00:00.000Z',
  });
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM artwork_transfer_receipts').get()?.n, 1);
  assert.ok((await readPrivateLivingRecord(DB, code, nextKeeper)).reflections.some(entry => entry.id === grantedId));
  assert.ok((await readPrivateLivingRecord(DB, code, nextKeeper)).milestones.some(entry => entry.id === privatePlaceId));
  const after = await buildPieceRecord(env, options);
  assert.deepEqual(after.record.livingHistory, before.record.livingHistory);
  const visibleHtml = after.html.replace(/<script[\s\S]*?<\/script>/g, '');
  assert.match(visibleHtml, /Sunlight &lt;through&gt; the wood\./);
  assert.match(visibleHtml, /2025 · Bali · Indonesia/);
  assert.match(visibleHtml, /2026 · Denpasar · Indonesia/);
  for (const forbidden of [privateId, offeredId, grantedId, privatePlaceId, author, keeper, nextKeeper,
    'Private unoffered words.', 'Offered unpublished words.', 'Successor reading only.',
    'successorAccess', 'author_user_id', 'invitation_id', 'current_display_location']) {
    assert.ok(!after.canonicalJson.includes(forbidden), forbidden);
    assert.ok(!after.html.includes(forbidden), forbidden);
  }
  const embedded = after.html.match(/id="piece-record-canonical">([\s\S]*?)<\/script>/)![1];
  assert.equal(sha(canonicalRecordJson(JSON.parse(embedded))), after.recordHash);
  assert.equal(after.recordHash, sha(after.canonicalJson));
  const repeated = await buildPieceRecord(env, options);
  assert.equal(repeated.html, after.html);
});

it('gate-off and missing migration-052 tables retain byte-compatible v1 exports', async t => {
  const { env, sqlite } = await livingFixture();
  t.after(() => sqlite.close());
  const gated = await buildPieceRecord(env, { ...options, includeLegacySections: false });
  // Frozen against the pre-extension HEAD generator, not today's v2 output.
  assert.equal(gated.recordHash, '43493a15f165dfdf28642d0d100904cbc4e26b46f9d586a081e0ee11862ee64d');
  assert.equal(sha(gated.html), '0e7a0bd34e98281b22ef5cda151548a88391be244c621a164e46aea123038aa1');
  assert.equal(gated.record.schemaVersion, 1);
  assert.ok(!('livingHistory' in gated.record));
  assert.ok(!gated.html.includes('id="living-history"'));
  const original = await buildPieceRecord(env, options);
  assert.equal(original.record.schemaVersion, 2);
  sqlite.exec('DROP TABLE collector_place_milestones');
  const oldSchema = await buildPieceRecord(env, options);
  assert.equal(oldSchema.record.schemaVersion, 1);
  assert.ok(!('livingHistory' in oldSchema.record));
  sqlite.exec('DROP TABLE collector_reflections');
  const bothMissing = await buildPieceRecord(env, options);
  assert.equal(bothMissing.canonicalJson, oldSchema.canonicalJson);
  assert.equal(bothMissing.html, oldSchema.html);
  // A previously exported v1 record still renders and verifies without an extension.
  assert.equal(sha(canonicalRecordJson(oldSchema.record)), oldSchema.recordHash);
  assert.equal(renderPieceRecordHtml(oldSchema.record, oldSchema), oldSchema.html);
  assert.equal(sha(canonicalRecordJson(original.record)), original.recordHash);
});

it('does not swallow source-table, column, or database failures as an old schema', async t => {
  const { env, DB, sqlite } = await livingFixture();
  t.after(() => sqlite.close());
  for (const failure of [
    'no such table: atlas_source_cities', 'no such column: published_at',
    'database disk image is malformed', 'no such table: collector_reflections_backup',
  ]) {
    const brokenEnv = { ...env, DB: {
      ...DB,
      prepare(sql: string) {
        if (/FROM collector_reflections/.test(sql)) throw new Error(failure);
        return DB.prepare(sql);
      },
    } };
    await assert.rejects(buildPieceRecord(brokenEnv, options), { message: failure });
  }

});

it('keeps the final privacy strip-pass on published reflection text', async t => {
  const { env, DB, sqlite, grant } = await livingFixture();
  t.after(() => sqlite.close());
  await grant(author);
  const id = crypto.randomUUID();
  await writeLivingRecord(DB, code, author, { action: 'reflect', id, body: 'Reach me at private@example.test' }, now);
  await writeLivingRecord(DB, code, author, { action: 'offer', id }, now);
  await writeLivingRecord(DB, code, keeper, { action: 'publish', id }, now);
  await assert.rejects(buildPieceRecord(env, options), /private_piece_record_value:record.livingHistory/);
});
