import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { revokeArtworkContributor } from '../functions/api/_lib/artworkContributors.js';
import { acceptCaretakerPassing, createCaretakerPassing } from '../functions/api/_lib/caretakerPassing.js';
import {
  readPrivateLivingRecord, readPublicLivingRecord, searchMilestonePlaces, writeLivingRecord,
} from '../functions/api/_lib/collectorLivingRecord.js';
import { onRequest } from '../functions/api/collector/record.js';

import { livingFixture, code, now, keeper, nextKeeper, author, secondAuthor, minor, other } from './shared/living-record-fixture';
import { updateCollectorPrivacy } from '../functions/api/_lib/collectorPrivacy.js';
import { onRequest as atlasRequest } from '../functions/api/atlas.js';

const text = 'A quiet moment beside the piece.';

describe('living artwork record', () => {
  it('enforces contributor and current keeper authority, author consent, irreversible public sharing, and passing', async t => {
    const { DB, sqlite, grant, env } = await livingFixture();
    t.after(() => sqlite.close());
    const invitationId = await grant(author);
    await grant(secondAuthor);
    await grant(minor);
    const id = crypto.randomUUID();
    const minorId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    const revokeId = crypto.randomUUID();
    const write = (userId: string, input: Record<string, unknown>) => writeLivingRecord(DB, code, userId, input, now);
    const view = (userId: string) => readPrivateLivingRecord(DB, code, userId);
    const publish = (userId: string, entry: string) => write(userId, { action: 'publish', id: entry });

    await assert.rejects(write(other, { action: 'reflect', id, body: text }), /record_permission_required/);
    await write(author, { action: 'reflect', id, body: text });
    await write(author, { action: 'reflect', id, body: text });
    assert.equal((await view(author)).role, 'contributor');
    assert.equal((await view(author)).reflections.length, 1);
    assert.deepEqual((await view(other)).reflections, []);
    assert.deepEqual((await view(keeper)).reflections, []);
    assert.deepEqual((await readPublicLivingRecord(DB, code)).reflections, []);
    await assert.rejects(publish(keeper, id), /record_permission_required/);
    await write(minor, { action: 'reflect', id: minorId, body: 'A child may still write.' });
    await assert.rejects(write(minor, { action: 'offer', id: minorId }), /minor_publicity_forbidden/);

    await write(author, { action: 'offer', id });
    assert.equal((await view(keeper)).reflections[0]?.body, text);
    assert.deepEqual((await view(minor)).reflections.map(item => item.id), [minorId]);
    assert.deepEqual((await readPublicLivingRecord(DB, code)).reflections, []);
    await assert.rejects(publish(author, id), /record_permission_required/);
    await assert.rejects(publish(nextKeeper, id), /record_permission_required/);
    await publish(keeper, id);
    await publish(keeper, id);
    assert.deepEqual((await readPublicLivingRecord(DB, code)).reflections, [{ id, body: text, createdAt: now }]);
    await assert.rejects(write(author, { action: 'withdraw', id }), /record_permission_required/);
    assert.throws(() => sqlite.prepare('DELETE FROM collector_reflections WHERE id = ?').run(id), /public reflection is permanent/);

    await write(author, { action: 'reflect', id: revokeId, body: 'Offered, then withdrawn.' });
    await write(author, { action: 'offer', id: revokeId });
    await write(author, { action: 'withdraw', id: revokeId });
    await assert.rejects(publish(keeper, revokeId), /record_permission_required/);
    const privateId = crypto.randomUUID();
    const place = { action: 'milestone', id: privateId, grain: 'region', year: 2025, placeId: 'atlas-city-1', visibility: 'private' };
    await assert.rejects(write(author, place), /record_permission_required/);
    await assert.rejects(write(keeper, { ...place, placeId: '123 Test Street' }), /record_permission_required/);
    assert.deepEqual(await searchMilestonePlaces(DB, code, author, 'Denpasar'), []);
    const available = await searchMilestonePlaces(DB, code, keeper, 'Bali');
    assert.deepEqual(available, [{ id: 'atlas-city-1', city: 'Denpasar', region: 'Bali', country: 'Indonesia' }]);
    await write(keeper, place);
    await write(keeper, place);
    const publicId = crypto.randomUUID();
    await assert.rejects(write(keeper, { ...place, id: publicId, visibility: 'public' }), /minor_publicity_forbidden/);
    sqlite.prepare("UPDATE profiles SET birth_date = '1990-01-01' WHERE user_id = 4").run();
    await write(keeper, { ...place, id: publicId, visibility: 'public' });
    assert.deepEqual((await readPublicLivingRecord(DB, code)).milestones, [
      { id: publicId, year: 2025, grain: 'region', place: 'Bali', country: 'Indonesia' },
    ]);
    assert.deepEqual((await view(other)).milestones, []);
    assert.equal((await view(keeper)).milestones.length, 1);
    assert.equal(sqlite.prepare('SELECT current_display_location FROM keeper_pieces').get()?.current_display_location, null);
    const currentAtlasIdentity = async () => {
      const response = await atlasRequest({ request: new Request('http://art.example.test/api/atlas'), env });
      assert.equal(response.status, 200);
      const { state } = await response.json();
      return state.lights.find(light => light.artworkId === 'UL-100').identity
        .find(identity => identity.publicCode === code);
    };
    const currentMapCity = async () => (await currentAtlasIdentity()).city;
    const consent = {
      userId: keeper, policyVersion: 'collector-privacy-v1', changedAt: now,
    };
    assert.equal(await currentMapCity(), null);
    await updateCollectorPrivacy(env, {
      ...consent, piece: { keeperPieceId: 'piece-one', shareCity: true, cityId: 'denpasar-id' },
    });
    assert.deepEqual(await currentMapCity(), {
      id: 'denpasar-id', label: 'Denpasar, Indonesia', country: 'Indonesia', lat: -8.65, lng: 115.2167,
    });
    await updateCollectorPrivacy(env, {
      ...consent, piece: { keeperPieceId: 'piece-one', shareCity: false, cityId: null },
    });
    assert.equal(await currentMapCity(), null);
    assert.equal((await readPublicLivingRecord(DB, code)).milestones[0]?.place, 'Bali');

    await revokeArtworkContributor(env, {
      keeperPieceId: 'piece-one', keeperUserId: keeper, accessId: invitationId,
      idempotencyKey: 'revoke-access-test', revokedAt: now,
    });
    assert.equal((await view(author)).role, null);
    assert.equal((await view(author)).reflections.length, 2);
    assert.deepEqual((await view(keeper)).reflections, []);
    await write(secondAuthor, { action: 'reflect', id: pendingId, body: 'Offered before passing.' });
    await write(secondAuthor, { action: 'offer', id: pendingId });
    assert.equal((await view(keeper)).reflections[0]?.id, pendingId);

    await updateCollectorPrivacy(env, {
      ...consent, piece: { keeperPieceId: 'piece-one', shareCity: true, cityId: 'denpasar-id' },
    });
    const beforePassing = await currentAtlasIdentity();
    assert.equal(beforePassing.city.id, 'denpasar-id');
    assert.ok(beforePassing.ordinal > 0);
    const passingEnv = { ...env, CARETAKER_PASSING_SECRET: 'living-record-fixture-passing-secret' };
    const recipientEmail = `${nextKeeper}@example.test`;
    const { passing } = await createCaretakerPassing(passingEnv, {
      senderUserId: keeper, keeperPieceId: 'piece-one', recipientEmail,
      confirmedRecipientEmail: recipientEmail, transferKind: 'sale',
      idempotencyKey: 'living-record-passing', now: '2026-11-17T09:00:00.000Z',
    });
    assert.equal(passing.status, 'pending');
    assert.equal((await currentMapCity()).id, 'denpasar-id');
    const token = createHmac('sha256', passingEnv.CARETAKER_PASSING_SECRET)
      .update(`caretaker-passing:v1:${passing.id}`).digest('hex');
    const acceptance = {
      token, userId: nextKeeper, accountEmail: recipientEmail, emailVerified: true,
      now: '2026-11-17T10:00:00.000Z',
    };
    assert.equal((await acceptCaretakerPassing(passingEnv, acceptance)).passing.status, 'accepted');
    assert.equal((await acceptCaretakerPassing(passingEnv, acceptance)).replayed, true);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get()?.count, 1);
    const afterPassing = await currentAtlasIdentity();
    assert.equal(afterPassing.ordinal, beforePassing.ordinal);
    assert.equal(afterPassing.city, null);
    assert.equal((await view(nextKeeper)).role, 'keeper');
    assert.deepEqual((await readPublicLivingRecord(DB, code)).milestones, [
      { id: publicId, year: 2025, grain: 'region', place: 'Bali', country: 'Indonesia' },
    ]);
    // Passing preserves all chapters, while withholding private access by default.
    assert.equal((await view(keeper)).milestones[0]?.id, privateId);
    assert.deepEqual((await view(nextKeeper)).milestones, []);
    assert.deepEqual((await view(nextKeeper)).reflections, []);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM collector_reflections').get()?.count, 4);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM collector_place_milestones').get()?.count, 2);
    const share = (userId: string, entry: string, kind: string, allow: boolean) =>
      write(userId, { action: 'successor-access', id: entry, kind, allow });
    await assert.rejects(share(nextKeeper, privateId, 'milestone', true), /record_permission_required/);
    await assert.rejects(share(other, privateId, 'milestone', true), /record_permission_required/);
    await assert.rejects(share(secondAuthor, privateId, 'milestone', true), /record_permission_required/);
    await share(keeper, privateId, 'milestone', true);
    assert.equal((await view(nextKeeper)).milestones[0]?.id, privateId);
    assert.deepEqual((await view(other)).milestones, []);
    await share(keeper, privateId, 'milestone', false);
    assert.deepEqual((await view(nextKeeper)).milestones, []);
    assert.equal((await view(keeper)).milestones[0]?.id, privateId);
    await share(secondAuthor, pendingId, 'reflection', true);
    assert.equal((await view(nextKeeper)).reflections[0]?.id, pendingId);
    assert.equal(Boolean((await view(nextKeeper)).reflections[0]?.canPublish), false);
    await assert.rejects(publish(nextKeeper, pendingId), /record_permission_required/);
    await assert.rejects(share(nextKeeper, pendingId, 'reflection', false), /record_permission_required/);
    await share(secondAuthor, pendingId, 'reflection', false);
    assert.deepEqual((await view(nextKeeper)).reflections, []);
    assert.equal((await view(secondAuthor)).reflections[0]?.body, 'Offered before passing.');
    await assert.rejects(share(author, id, 'reflection', true), /record_permission_required/);
    await assert.rejects(share(keeper, publicId, 'milestone', true), /record_permission_required/);
    assert.equal((await view(minor)).role, null);
    assert.equal((await view(secondAuthor)).role, null);
    assert.equal((await view(secondAuthor)).reflections[0]?.id, pendingId);
    assert.deepEqual((await readPublicLivingRecord(DB, code)).reflections, [{ id, body: text, createdAt: now }]);
    await assert.rejects(write(keeper, { ...place, id: crypto.randomUUID() }), /record_permission_required/);
    await assert.rejects(publish(nextKeeper, pendingId), /record_permission_required/);
  });

  it('carries only author-selected private entries into the next caretakership', async t => {
    const { DB, sqlite, env } = await livingFixture();
    t.after(() => sqlite.close());
    const sharedId = crypto.randomUUID();
    const withheldId = crypto.randomUUID();
    for (const id of [sharedId, withheldId]) {
      await writeLivingRecord(DB, code, keeper, { action: 'milestone', id, placeId: 'atlas-city-1', grain: 'region', year: 2025, visibility: 'private' }, now);
    }
    await writeLivingRecord(DB, code, keeper, { action: 'successor-access', id: sharedId, kind: 'milestone', allow: true }, now);
    assert.deepEqual((await readPrivateLivingRecord(DB, code, nextKeeper)).milestones, []);
    const passingEnv = { ...env, CARETAKER_PASSING_SECRET: 'selected-record-passing-secret-at-least-32' };
    const recipientEmail = `${nextKeeper}@example.test`;
    const { passing } = await createCaretakerPassing(passingEnv, {
      senderUserId: keeper, keeperPieceId: 'piece-one', recipientEmail, confirmedRecipientEmail: recipientEmail,
      transferKind: 'sale', idempotencyKey: 'selected-record-passing', now: '2026-11-17T09:00:00.000Z',
    });
    const token = createHmac('sha256', passingEnv.CARETAKER_PASSING_SECRET).update(`caretaker-passing:v1:${passing.id}`).digest('hex');
    await acceptCaretakerPassing(passingEnv, { token, userId: nextKeeper, accountEmail: recipientEmail, emailVerified: true, now: '2026-11-17T10:00:00.000Z' });
    assert.deepEqual((await readPrivateLivingRecord(DB, code, nextKeeper)).milestones.map(item => item.id), [sharedId]);
    assert.equal((await readPrivateLivingRecord(DB, code, keeper)).milestones.length, 2);
    assert.deepEqual((await readPublicLivingRecord(DB, code)).milestones, []);
    await assert.rejects(writeLivingRecord(DB, code, keeper, { action: 'successor-access', id: sharedId, kind: 'milestone', allow: 'yes' }, now), /invalid_record_entry/);
  });

  it('does not expose the endpoint while Living Legacy is gated off', async () => {
    const request = new Request(`https://example.test/api/collector/record?publicCode=${code}&view=public`);
    assert.equal((await onRequest({ request, env: {} })).status, 404);
  });
});
