/**
 * Lightweight in-memory rate limiter shared across the public Pages Functions.
 *
 * IMPORTANT (honest scope): this is per-isolate, best-effort burst protection.
 * Cloudflare runs many isolates across many edge locations, each with its own
 * Map, and isolates recycle, so a determined attacker can dilute it. It raises
 * the cost of casual abuse (form spam, login guessing, email flooding) without
 * a new binding. For durable, global limits, move these calls to a KV namespace
 * or a Durable Object (a wrangler.toml binding change — see SECURITY.md).
 */

const buckets = new Map();

/**
 * Fixed-window counter. Returns { allowed, remaining, retryAfter }.
 * @param {string} key     identity to limit on (e.g. `login:${ip}`)
 * @param {{ max: number, windowMs: number }} opts
 */
export function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const entry = buckets.get(key) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  buckets.set(key, entry);

  // Opportunistic cleanup so the Map can't grow unbounded in a long-lived isolate.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now - v.start > windowMs) buckets.delete(k);
    }
  }

  const allowed = entry.count <= max;
  const retryAfter = Math.max(1, Math.ceil((entry.start + windowMs - now) / 1000));
  return { allowed, remaining: Math.max(0, max - entry.count), retryAfter };
}

/** Best-effort client IP from Cloudflare headers. */
export function clientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  );
}
