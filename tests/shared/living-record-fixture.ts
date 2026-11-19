import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  acceptArtworkContributorInvitation, inviteArtworkContributor,
} from '../../functions/api/_lib/artworkContributors.js';
import { buildLineageEvent } from '../../functions/api/_lib/lineage.js';

const migrations = new URL('../../migrations/', import.meta.url);
export const code = 'AR-7KQ9M2WX';
export const now = '2026-11-17T08:00:00.000Z';
const expiresAt = '2026-11-19T08:00:00.000Z';
export const keeper = 'keeper-one';
export const nextKeeper = 'keeper-two';
export const author = 'author-one';
export const secondAuthor = 'author-two';
export const minor = 'author-minor';
export const other = 'other-signed-in';
const invited = '2026-11-17T07:00:00.000Z';

export async function livingFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const filename of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(filename, migrations), 'utf8'));
  }
  sqlite.exec(`
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
      VALUES ${[keeper, nextKeeper, author, secondAuthor, minor, other].map(id => `('${id}', 'Test person', '${id}@example.test', 1, 1, 1)`).join(',')};
    INSERT INTO users (id, clerk_user_id, auth_user_id, email)
      VALUES (1, '${author}', '${author}', '${author}@example.test'),
             (2, '${minor}', '${minor}', '${minor}@example.test'),
             (3, '${secondAuthor}', '${secondAuthor}', '${secondAuthor}@example.test'),
             (4, '${keeper}', '${keeper}', '${keeper}@example.test');
    INSERT INTO profiles (user_id, birth_date, birth_time, birth_place_label, lat, lng, tz_id, computed_json)
      VALUES (1, '1990-01-01', '00:00', 'Test', 0, 0, 'UTC', '{}'),
             (2, '2013-01-01', '00:00', 'Test', 0, 0, 'UTC', '{}'),
             (3, '1990-01-01', '00:00', 'Test', 0, 0, 'UTC', '{}'),
             (4, '2013-01-01', '00:00', 'Test', 0, 0, 'UTC', '{}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash, claimed_at, registered_at)
      VALUES ('piece-one', 'UL-100', 0, '${keeper}', '${'a'.repeat(64)}', '${invited}', '${invited}');
    UPDATE keeper_pieces
       SET public_code = '${code}', issuance_key = 'record-test-issue',
           ownership_code_ciphertext = 'ciphertext', ownership_code_nonce = 'nonce',
           ownership_code_key_version = 1, registration_status = 'registered',
           registered_by_user_id = 'artist-admin', identity_backup_status = 'verified',
           identity_backup_reference = 'identities/${code}/${'9'.repeat(64)}.json',
           identity_backup_sha256 = '${'9'.repeat(64)}', identity_backup_at = '${invited}'
     WHERE id = 'piece-one';
    INSERT INTO collector_curated_cities (id, label, population, active)
      VALUES ('denpasar-id', 'Denpasar, Indonesia', 725314, 1);
    INSERT INTO atlas_source_cities
      (id, city, region, country, country_code, lat, lng)
      VALUES ('atlas-city-1', 'Denpasar', 'Bali', 'Indonesia', 'ID', -8.6, 115.2);
  `);
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() {
          const row = sqlite.prepare(sql).get(...values);
          return row ? { ...row } : null;
        },
        all() { return { results: sqlite.prepare(sql).all(...values).map(row => ({ ...row })) }; },
        run() {
          const { changes } = sqlite.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(changes) } };
        },
      };
      return statement;
    },
    async batch(statements: Array<{ run: () => unknown }>) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = {
    DB,
    CONTRIBUTOR_INVITATION_KEY_V1: Buffer.alloc(32, 41).toString('base64'),
    CONTRIBUTOR_INVITATION_ACTIVE_KEY_VERSION: '1',
    CONTRIBUTOR_INVITE_NOW: () => new Date().toISOString(),
  };
  const grant = async (userId: string) => {
    const invitation = await inviteArtworkContributor(env, {
      keeperPieceId: 'piece-one', keeperUserId: keeper, intendedRecipientEmail: `${userId}@example.test`,
      idempotencyKey: `invite-${userId}`, invitedAt: invited, expiresAt,
    });
    await acceptArtworkContributorInvitation(env, {
      token: invitation.token, claimant: { userId, verifiedEmail: `${userId}@example.test` },
      idempotencyKey: `accept-${userId}`, acceptedAt: now,
    });
    return invitation.invitationId as string;
  };
  const stored = await buildLineageEvent({
    keeperPieceId: 'piece-one', sequence: 1, eventType: 'first_bound',
    eventAt: invited, previousHash: null, publicPayload: {},
  });
  sqlite.prepare(`
    INSERT INTO artwork_lineage_events
      (id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json)
    VALUES ('fixture-first-bound', 'piece-one', 1, 'first_bound', ?1, NULL, ?2, '{}')
  `).run(invited, stored.eventHash);
  sqlite.prepare(`
    UPDATE keeper_pieces SET lineage_event_count = 1, lineage_head_hash = ?1 WHERE id = 'piece-one'
  `).run(stored.eventHash);
  return { sqlite, DB, grant, env };
}
