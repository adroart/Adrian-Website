-- Durable rate-limit counters for the abuse-prone auth / email / compute
-- endpoints. Better Auth's built-in limiter defaults to in-memory storage,
-- which on Cloudflare Pages Functions does NOT persist across edge isolates,
-- so it is not a real brute-force / email-bomb control. This table backs a
-- small fail-open limiter (functions/api/_lib/rate-limit.js) instead.
--
-- Shared `adrian-website` D1 (binding DB). Bucket keys are route-namespaced
-- (e.g. `auth:otp:<ip>`) so the two sites never collide. Rows self-expire by
-- window comparison; an occasional cleanup of old rows is optional, not
-- required for correctness.
--
-- Applying this migration touches the shared `adrian-website` D1 database,
-- which the Adrian-Website repo also has migrations against — see
-- docs/d1-migrations.md before running `wrangler d1 migrations apply
-- adrian-website --remote` from this checkout, and check
-- `wrangler d1 migrations list adrian-website --remote` from BOTH repos
-- first so this filename doesn't collide with one already used there.
-- Until applied, the limiter fails OPEN (allows requests) — never locks anyone
-- out — so this migration can land before or after the code deploy.

CREATE TABLE IF NOT EXISTS rate_limit_hits (
  bucket       TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL   -- ms epoch when the current window opened
);
