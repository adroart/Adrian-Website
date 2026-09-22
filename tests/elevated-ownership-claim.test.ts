import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';
import { hashRecoveryCode } from '../functions/api/_lib/keeper.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

let auth: { userId: string; email: string } | null = null;
mock.module('../functions/api/_lib/auth.js', { namedExports: {
  requireUser: async () => auth ? { userId: auth.userId, email: auth.email, user: { emailVerified: true } }
    : new Response('{}', { status: 401 }),
  requireAdmin: async () => new Response('{}', { status: 401 }),
}});
const { onRequest: bind } = await import('../functions/api/keeper/bind.js');
after(() => mock.reset());

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => { let values: SQLInputValue[] = []; const statement = {
    bind(...next: SQLInputValue[]) { values = next; return statement; },
    async first() { return database.prepare(sql).get(...values) ?? null; },
    async all() { return { results: database.prepare(sql).all(...values) }; },
    async run() { const r = database.prepare(sql).run(...values); return { success: true, meta: { changes: Number(r.changes) } }; },
    runSync() { const r = database.prepare(sql).run(...values); return { success: true, meta: { changes: Number(r.changes) } }; },
  }; return statement; };
  return { prepare, async batch(statements: any[]) { database.exec('BEGIN IMMEDIATE'); try {
    const results = statements.map((s) => s.runSync()); database.exec('COMMIT'); return results;
  } catch (error) { database.exec('ROLLBACK'); throw error; } } };
}

const migrations = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((name) => /^\d+.*\.sql$/.test(name)).sort()
  .map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');
const code = 'K7QM-9XTR-2PHV-N4WB';
const publicCode = 'AR-7KQ9M2WX';
const acquiredAt = '2026-08-01T00:00:00.000Z';

async function fixture(nonCode = true) {
  const database = new DatabaseSync(':memory:');
  database.exec(`PRAGMA foreign_keys=ON; ${migrations}
    INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES
      ('prior','Prior','prior@example.com',1,1,1),('claimant','Claimant','claimant@example.com',1,1,1);
    INSERT INTO users (auth_user_id,clerk_user_id,email) VALUES
      ('prior','prior','prior@example.com'),('claimant','claimant','claimant@example.com');`);
  database.prepare(`INSERT INTO keeper_pieces
    (id,piece_id,edition_number,recovery_code_hash,public_code,registered_at)
    VALUES ('kp','UL-100',1,?1,?2,'2026-07-01T00:00:00.000Z')`)
    .run(await hashRecoveryCode(code), publicCode);
  if (nonCode) database.exec(`
    INSERT INTO artwork_invitations
      (id,keeper_piece_id,token_hash,intended_recipient_email,created_by_user_id,idempotency_key,created_at,expires_at)
    VALUES ('iv-00000000-0000-4000-8000-000000000001','kp','${'a'.repeat(64)}','prior@example.com','artist','invite-1','2026-07-01T00:00:00.000Z','2026-09-01T00:00:00.000Z');
    INSERT INTO artwork_invitation_redemptions
      (invitation_id,keeper_piece_id,redeemed_by_user_id,verified_recipient_email,proof_reference,presented_token_hash,redeemed_at)
    VALUES ('iv-00000000-0000-4000-8000-000000000001','kp','prior','prior@example.com','iv-00000000-0000-4000-8000-000000000001','${'a'.repeat(64)}','${acquiredAt}');`);
  database.exec(`
    UPDATE keeper_pieces SET keeper_user_id='prior', claimed_at='${acquiredAt}', lineage_event_count=1,
      lineage_head_hash='${'b'.repeat(64)}' WHERE id='kp';
    INSERT INTO artwork_lineage_events
      (id,keeper_piece_id,sequence,event_type,event_at,previous_hash,event_hash,public_payload_json)
    VALUES ('lineage-first','kp',1,'first_bound','${acquiredAt}',NULL,'${'b'.repeat(64)}','{}');
    INSERT INTO artwork_claim_evidence
      (id,keeper_piece_id,actor_user_id,verified_email,outcome,created_at)
    VALUES ('evidence-first','kp','prior','prior@example.com','first_bound','${acquiredAt}');`);
  if (nonCode) database.exec(`INSERT INTO artwork_invitation_redemption_completions
    (invitation_id,completed_at) VALUES ('iv-00000000-0000-4000-8000-000000000001','${acquiredAt}')`);
  return { database, env: { DB: d1(database) } };
}

function request(ownershipCode = code) { return new Request('https://example.test/api/keeper/bind', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ publicCode, ownershipCode }),
}); }

describe('elevated true Ownership Code claim', () => {
  it('uses the governed receipt to outrank current invitation custody and is replay safe', async () => {
    const fx = await fixture(true); const priorFlag = LAUNCH_FLAGS.livingLegacy; LAUNCH_FLAGS.livingLegacy = true;
    auth = { userId: 'claimant', email: 'claimant@example.com' };
    try {
      const first = await bind({ request: request(), env: fx.env });
      assert.equal(first.status, 200); assert.equal((await first.json()).elevated, true);
      const replay = await bind({ request: request(), env: fx.env });
      assert.equal(replay.status, 200);
      const piece = fx.database.prepare("SELECT keeper_user_id,steward_version,lineage_event_count FROM keeper_pieces WHERE id='kp'").get() as any;
      assert.deepEqual({ ...piece }, { keeper_user_id: 'claimant', steward_version: 2, lineage_event_count: 2 });
      assert.equal((fx.database.prepare('SELECT COUNT(*) n FROM artwork_transfer_receipts').get() as any).n, 1);
      assert.equal((fx.database.prepare("SELECT COUNT(*) n FROM artwork_claim_evidence WHERE outcome='elevated_code_claim'").get() as any).n, 1);
      const persisted = JSON.stringify(fx.database.prepare('SELECT * FROM registry_maintenance_events').all())
        + JSON.stringify(fx.database.prepare('SELECT * FROM artwork_lineage_events').all());
      assert.doesNotMatch(persisted, /K7QM|9XTR|2PHV|N4WB/);
      assert.deepEqual(fx.database.prepare('PRAGMA foreign_key_check').all(), []);
      // A second person who knows the same code cannot treat this code-proven
      // receipt as a non-code acquisition and silently take custody back.
      auth = { userId: 'prior', email: 'prior@example.com' };
      const later = await bind({ request: request(), env: fx.env });
      assert.equal(later.status, 202);
      assert.equal((await later.json()).status, 'claim_requested');
      assert.equal((fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='kp'").get() as any).keeper_user_id, 'claimant');
      assert.equal((fx.database.prepare('SELECT COUNT(*) n FROM artwork_transfer_receipts').get() as any).n, 1);

    } finally { LAUNCH_FLAGS.livingLegacy = priorFlag; fx.database.close(); }
  });

  it('keeps ambiguous direct-code custody on the contested path', async () => {
    const fx = await fixture(false); const priorFlag = LAUNCH_FLAGS.livingLegacy; LAUNCH_FLAGS.livingLegacy = true;
    auth = { userId: 'claimant', email: 'claimant@example.com' };
    try {
      const response = await bind({ request: request(), env: fx.env });
      assert.equal(response.status, 202); assert.equal((await response.json()).status, 'claim_requested');
      assert.equal((fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='kp'").get() as any).keeper_user_id, 'prior');
      assert.equal((fx.database.prepare('SELECT COUNT(*) n FROM artwork_transfer_receipts').get() as any).n, 0);
    } finally { LAUNCH_FLAGS.livingLegacy = priorFlag; fx.database.close(); }
  });

  it('commits one receipt when identical elevated claims race', async () => {
    const fx = await fixture(true); const priorFlag = LAUNCH_FLAGS.livingLegacy; LAUNCH_FLAGS.livingLegacy = true;
    auth = { userId: 'claimant', email: 'claimant@example.com' };
    try {
      const responses = await Promise.all([
        bind({ request: request(), env: fx.env }), bind({ request: request(), env: fx.env }),
      ]);
      assert.deepEqual(responses.map((response) => response.status), [200, 200]);
      assert.equal((fx.database.prepare('SELECT COUNT(*) n FROM artwork_transfer_receipts').get() as any).n, 1);
      assert.equal((fx.database.prepare("SELECT keeper_user_id FROM keeper_pieces WHERE id='kp'").get() as any).keeper_user_id, 'claimant');
    } finally { LAUNCH_FLAGS.livingLegacy = priorFlag; fx.database.close(); }
  });
});
