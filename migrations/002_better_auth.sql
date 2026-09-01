-- Better Auth core tables (self-owned customer login replacing Clerk).
-- Email one-time-code sign-in stores codes in the shared `verification` table;
-- no separate OTP table is needed. Google OAuth uses `account`.
--
-- Better Auth default SQLite schema, field names per
-- https://better-auth.com/docs/concepts/database. Applied to D1 binding `DB`.
--
-- TWO-TABLE IDENTITY MODEL (read before touching either table):
--   * `user` (below) is OWNED by Better Auth — `user.id` is a string, sessions
--     and OAuth accounts FK to it, and it is the source of truth for login.
--   * `users` (001_init.sql) is the APP table — profiles + collections FK to
--     its integer `users.id`. Its `clerk_user_id` column stores the Better
--     Auth `user.id` (column name retained as the generic external-auth-id).
--     /api/auth/sync-user upserts this row on first sign-in.
-- The two are joined only by convention (`users.clerk_user_id == user.id`),
-- so deleting from `user` does NOT cascade to `users`. The account-deletion
-- hook in lib/account/auth.server.js bridges that gap (it deletes the `users`
-- row and unbinds atlas steward records), and is gated behind
-- ENABLE_ACCOUNT_DELETION because this DB is shared with adrianrasmussen.com.

CREATE TABLE IF NOT EXISTS user (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,  -- boolean
  image         TEXT,
  createdAt     INTEGER NOT NULL,            -- ms epoch
  updatedAt     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token     TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);

CREATE TABLE IF NOT EXISTS account (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId             TEXT NOT NULL,        -- provider's user id (or user.id for credential)
  providerId            TEXT NOT NULL,        -- "credential" | "google" | ...
  accessToken           TEXT,
  refreshToken          TEXT,
  accessTokenExpiresAt  INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope                 TEXT,
  idToken               TEXT,
  password              TEXT,                 -- credential password hash (email+password sign-in)
  createdAt             INTEGER NOT NULL,
  updatedAt             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);

CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,   -- email (for OTP)
  value      TEXT NOT NULL,   -- the code / token
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER NOT NULL,
  updatedAt  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
