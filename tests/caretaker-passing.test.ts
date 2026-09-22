import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';
import {
  acceptCaretakerPassing,
  cancelCaretakerPassing,
  createCaretakerPassing,
  getCaretakerPassingForSender,
  inspectCaretakerPassing,
  resendCaretakerPassing,
  retryCaretakerPassingSenderNotices,
} from '../functions/api/_lib/caretakerPassing.js';

const schema = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((name) => name.endsWith('.sql')).sort()
  .map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) ?? null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() { const info = database.prepare(sql).run(...values); return { success: true, meta: { changes: info.changes } }; },
    };
  };
  return {
    prepare,
    async batch(statements: { run: () => Promise<unknown> }[]) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  database.exec(schema);
  const now = '2026-09-22T00:00:00.000Z';
  database.exec(`
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES
      ('sender', 'Sender', 'sender@example.com', 1, 1, 1),
      ('recipient', 'Recipient', 'recipient@example.com', 1, 1, 1),
      ('stranger', 'Stranger', 'stranger@example.com', 1, 1, 1);
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       registered_at, claimed_at, public_code, issuance_key, plate_status,
       ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
       registration_status, registered_by_user_id, identity_backup_status,
       identity_backup_reference, identity_backup_sha256, identity_backup_at)
    VALUES
      ('keeper-pass', 'UL-100', 0, 'sender', '${'a'.repeat(64)}',
       '${now}', '${now}', 'AR-7KQ9M2WX', 'passing-fixture', 'legacy',
       'cipher', 'nonce', 1, 'registered', 'sender', 'verified',
       'identities/AR-7KQ9M2WX/${'b'.repeat(64)}.json', '${'b'.repeat(64)}', '${now}');
  `);
  const env = {
    DB: d1(database),
    CARETAKER_PASSING_SECRET: 'test-secret-that-is-at-least-thirty-two-characters',
    ARTWORK_RECORDS: { async put() {}, async get() { return null; } },
  };
  return { database, env };
}

const createInput = {
  senderUserId: 'sender', keeperPieceId: 'keeper-pass',
  recipientEmail: 'recipient@example.com', confirmedRecipientEmail: 'recipient@example.com',
  transferKind: 'sale', idempotencyKey: 'passing-create-1', now: '2026-09-22T01:00:00.000Z',
};

async function tokenFor(env: any, passingId: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.CARETAKER_PASSING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`caretaker-passing:v1:${passingId}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('recipient-verified caretaker passing', () => {
  it('creates a 30-day invitation with a retained delivery failure and never moves custody', async () => {
    const fx = fixture();
    try {
      const result = await createCaretakerPassing(fx.env, createInput);
      assert.equal(result.passing.status, 'pending');
      assert.equal(result.passing.deliveryStatus, 'failed');
      assert.equal(result.passing.expiresAt, '2026-10-22T01:00:00.000Z');
      assert.equal(fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get().keeper_user_id, 'sender');
      const row: any = fx.database.prepare('SELECT delivery_attempts, delivery_error FROM caretaker_passing_requests').get();
      assert.equal(row.delivery_attempts, 1);
      assert.equal(row.delivery_error, 'email_not_configured');
    } finally { fx.database.close(); }
  });

  it('requires exact verified recipient and accepts through intent, parties, lineage and receipt atomically', async () => {
    const fx = fixture();
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      const token = await tokenFor(fx.env, created.passing.id);
      await assert.rejects(() => inspectCaretakerPassing(fx.env, {
        token, accountEmail: 'stranger@example.com', emailVerified: true,
      }), (error: any) => error.code === 'recipient_mismatch');
      const result = await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:00:00.000Z',
      });
      assert.equal(result.passing.status, 'accepted');
      assert.equal(fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get().keeper_user_id, 'recipient');
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_intents').get().count, 1);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_parties').get().count, 2);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get().count, 1);
      assert.equal(fx.database.prepare('SELECT sender_notice_status FROM caretaker_passing_requests').get().sender_notice_status, 'failed');
      assert.equal(fx.database.prepare("SELECT count(*) AS count FROM artwork_lineage_events WHERE event_type='transferred'").get().count, 1);
      const replay = await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:01:00.000Z',
      });
      assert.equal(replay.replayed, true);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get().count, 1);
    } finally { fx.database.close(); }
  });

  it('lets the sender cancel before acceptance and makes later acceptance impossible', async () => {
    const fx = fixture();
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      const token = await tokenFor(fx.env, created.passing.id);
      await cancelCaretakerPassing(fx.env, { passingId: created.passing.id, senderUserId: 'sender', now: '2026-09-22T02:00:00.000Z' });
      await assert.rejects(() => acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-22T03:00:00.000Z',
      }), (error: any) => error.code === 'passing_not_pending');
      assert.equal(fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get().keeper_user_id, 'sender');
      const notice: any = fx.database.prepare('SELECT sender_notice_status, sender_notice_attempts FROM caretaker_passing_requests').get();
      assert.equal(notice.sender_notice_status, null);
      assert.equal(notice.sender_notice_attempts, 0);
    } finally { fx.database.close(); }
  });

  it('retries retained delivery failure with the stable provider idempotency key', async () => {
    const fx = fixture();
    const originalFetch = globalThis.fetch;
    const providerKeys: string[] = [];
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      (fx.env as any).RESEND_API_KEY = 're_test_stub';
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        providerKeys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      const resent = await resendCaretakerPassing(fx.env, {
        passingId: created.passing.id, senderUserId: 'sender',
      });
      assert.equal(resent.passing.deliveryStatus, 'sent');
      assert.deepEqual(providerKeys, [`caretaker-passing:${created.passing.id}`]);
      const row: any = fx.database.prepare('SELECT delivery_status, delivery_attempts FROM caretaker_passing_requests').get();
      assert.equal(row.delivery_status, 'sent');
      assert.equal(row.delivery_attempts, 2);
    } finally {
      globalThis.fetch = originalFetch;
      fx.database.close();
    }
  });

  it('emails the original sender only after acceptance with durable success evidence', async () => {
    const fx = fixture();
    const originalFetch = globalThis.fetch;
    const deliveries: { key: string; body: any }[] = [];
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      (fx.env as any).RESEND_API_KEY = 're_test_stub';
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        deliveries.push({
          key: new Headers(init?.headers).get('Idempotency-Key') || '',
          body: JSON.parse(String(init?.body)),
        });
        return new Response('{}', { status: 200 });
      }) as typeof fetch;
      const token = await tokenFor(fx.env, created.passing.id);
      const accepted = await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:00:00.000Z',
      });
      assert.equal(accepted.passing.senderNoticeStatus, 'sent');
      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].key, `caretaker-passing-accepted:${created.passing.id}`);
      assert.deepEqual(deliveries[0].body.to, ['sender@example.com']);
      const row: any = fx.database.prepare(
        'SELECT sender_notice_status, sender_notice_attempts, sender_notice_sent_at, sender_notice_error FROM caretaker_passing_requests',
      ).get();
      assert.equal(row.sender_notice_status, 'sent');
      assert.equal(row.sender_notice_attempts, 1);
      assert.ok(row.sender_notice_sent_at);
      assert.equal(row.sender_notice_error, null);
      await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:01:00.000Z',
      });
      assert.equal(deliveries.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
      fx.database.close();
    }
  });

  it('retries a failed sender notice on acceptance replay and never retransfers', async () => {
    const fx = fixture();
    const originalFetch = globalThis.fetch;
    const providerKeys: string[] = [];
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      (fx.env as any).RESEND_API_KEY = 're_test_stub';
      let succeeds = false;
      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        providerKeys.push(new Headers(init?.headers).get('Idempotency-Key') || '');
        return new Response('{}', { status: succeeds ? 200 : 503 });
      }) as typeof fetch;
      const token = await tokenFor(fx.env, created.passing.id);
      await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:00:00.000Z',
      });
      assert.equal(fx.database.prepare('SELECT sender_notice_status FROM caretaker_passing_requests').get().sender_notice_status, 'failed');
      succeeds = true;
      const replay = await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:01:00.000Z',
      });
      assert.equal(replay.replayed, true);
      assert.equal(replay.passing.senderNoticeStatus, 'sent');
      assert.deepEqual(providerKeys, [
        `caretaker-passing-accepted:${created.passing.id}`,
        `caretaker-passing-accepted:${created.passing.id}`,
      ]);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get().count, 1);
      assert.equal(fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get().keeper_user_id, 'recipient');
    } finally {
      globalThis.fetch = originalFetch;
      fx.database.close();
    }
  });

  it('lets the closed runner retry accepted sender notices without touching custody', async () => {
    const fx = fixture();
    const originalFetch = globalThis.fetch;
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      const token = await tokenFor(fx.env, created.passing.id);
      await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:00:00.000Z',
      });
      (fx.env as any).RESEND_API_KEY = 're_test_stub';
      globalThis.fetch = (async () => new Response('{}', { status: 200 })) as typeof fetch;
      const result = await retryCaretakerPassingSenderNotices(fx.env);
      assert.equal(result.processed, 1);
      assert.equal(fx.database.prepare('SELECT sender_notice_status FROM caretaker_passing_requests').get().sender_notice_status, 'sent');
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get().count, 1);
    } finally {
      globalThis.fetch = originalFetch;
      fx.database.close();
    }
  });

  it('preserves the optional private declared value and method without putting them in public lineage', async () => {
    const fx = fixture();
    try {
      const created = await createCaretakerPassing(fx.env, {
        ...createInput, declaredValueRaw: '  one painting plus 2,500 EUR  ', declaredValueMethod: 'part_trade_paid',
      });
      assert.equal(created.passing.declaredValueRaw, 'one painting plus 2,500 EUR');
      assert.equal(created.passing.declaredValueMethod, 'part_trade_paid');
      const token = await tokenFor(fx.env, created.passing.id);
      await acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-09-23T01:00:00.000Z',
      });
      const lineage: any = fx.database.prepare("SELECT public_payload_json FROM artwork_lineage_events WHERE event_type='transferred'").get();
      assert.doesNotMatch(lineage.public_payload_json, /2,500|part_trade_paid/);
      await assert.rejects(() => createCaretakerPassing(fx.env, {
        ...createInput, transferKind: 'gift', idempotencyKey: 'gift-with-value',
        declaredValueRaw: '100', declaredValueMethod: 'given',
      }), (error: any) => error.code === 'declared_value_not_allowed');
    } finally { fx.database.close(); }
  });

  it('expires after 30 days without moving custody', async () => {
    const fx = fixture();
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      const token = await tokenFor(fx.env, created.passing.id);
      const inspected = await inspectCaretakerPassing(fx.env, {
        token, accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-10-22T01:00:01.000Z',
      });
      assert.equal(inspected.status, 'expired');
      await assert.rejects(() => acceptCaretakerPassing(fx.env, {
        token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
        now: '2026-10-22T01:00:02.000Z',
      }), (error: any) => error.code === 'passing_not_pending');
      assert.equal(fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get().keeper_user_id, 'sender');
    } finally { fx.database.close(); }
  });

  it('serializes concurrent cancel and acceptance to one terminal outcome', async () => {
    const fx = fixture();
    try {
      const created = await createCaretakerPassing(fx.env, createInput);
      const token = await tokenFor(fx.env, created.passing.id);
      await Promise.allSettled([
        acceptCaretakerPassing(fx.env, {
          token, userId: 'recipient', accountEmail: 'recipient@example.com', emailVerified: true,
          now: '2026-09-23T01:00:00.000Z',
        }),
        cancelCaretakerPassing(fx.env, {
          passingId: created.passing.id, senderUserId: 'sender', now: '2026-09-23T01:00:00.000Z',
        }),
      ]);
      const passing: any = fx.database.prepare('SELECT status FROM caretaker_passing_requests').get();
      const piece: any = fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='keeper-pass'").get();
      assert.ok(passing.status === 'accepted' || passing.status === 'cancelled');
      assert.equal(piece.keeper_user_id, passing.status === 'accepted' ? 'recipient' : 'sender');
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM artwork_transfer_receipts').get().count,
        passing.status === 'accepted' ? 1 : 0);
    } finally { fx.database.close(); }
  });

  it('replays concurrent exact creates and expires the old request before a new passing', async () => {
    const fx = fixture();
    try {
      const [left, right] = await Promise.all([
        createCaretakerPassing(fx.env, createInput),
        createCaretakerPassing(fx.env, createInput),
      ]);
      assert.equal(left.passing.id, right.passing.id);
      assert.equal(fx.database.prepare('SELECT count(*) AS count FROM caretaker_passing_requests').get().count, 1);
      fx.database.prepare('UPDATE caretaker_passing_requests SET expires_at = ?').run('2026-09-22T00:30:00.000Z');
      const expired = await getCaretakerPassingForSender(fx.env, {
        keeperPieceId: 'keeper-pass', senderUserId: 'sender', now: '2026-09-22T02:00:00.000Z',
      });
      assert.equal(expired?.status, 'expired');
      const next = await createCaretakerPassing(fx.env, {
        ...createInput, idempotencyKey: 'passing-create-2', now: '2026-09-22T02:00:00.000Z',
      });
      assert.notEqual(next.passing.id, left.passing.id);
    } finally { fx.database.close(); }
  });

  it('refuses to start from an unclaimed identity', async () => {
    const fx = fixture();
    try {
      fx.database.exec(`INSERT INTO keeper_pieces
        (id, piece_id, edition_number, recovery_code_hash, registered_at, public_code,
         issuance_key, plate_status, ownership_code_ciphertext, ownership_code_nonce,
         ownership_code_key_version, registration_status, registered_by_user_id,
         identity_backup_status, identity_backup_reference, identity_backup_sha256, identity_backup_at)
        VALUES ('keeper-unclaimed', 'UL-101', 0, '${'c'.repeat(64)}', '2026-09-22T00:00:00.000Z',
         'AR-8KQ9M2WX', 'unclaimed-fixture', 'legacy', 'cipher', 'nonce', 1, 'registered',
         'sender', 'verified', 'identities/AR-8KQ9M2WX/${'d'.repeat(64)}.json', '${'d'.repeat(64)}',
         '2026-09-22T00:00:00.000Z')`);
      await assert.rejects(() => createCaretakerPassing(fx.env, {
        ...createInput, keeperPieceId: 'keeper-unclaimed', idempotencyKey: 'unclaimed-create',
      }), (error: any) => error.code === 'not_your_piece');
    } finally { fx.database.close(); }
  });
});
