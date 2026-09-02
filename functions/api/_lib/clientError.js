/**
 * What a caller is allowed to be told when something throws.
 *
 * These endpoints use a thrown Error's message as the error code, because the
 * libraries beneath them throw their codes that way: `piece_not_held`,
 * `outside_birthday_window`. The trouble is that everything else throws
 * through the same door. A database trigger abort arrives as
 * `D1_ERROR: public dream requires established adult: SQLITE_CONSTRAINT`, and
 * passed on unchanged it reaches a collector as database wording no client
 * can classify and no person can act on. Measured on 2026-09-02: that is
 * exactly what a refused dream was showing.
 *
 * The rule here rests on an invariant the codebase already keeps: every code
 * meant for a caller is a lowercase token, no spaces. Trigger prose and driver
 * errors are neither. So anything that is not token-shaped is an internal
 * detail and becomes the endpoint's own fallback.
 */

/** A code a caller may see: lowercase, digits and underscores, nothing else. */
const CLIENT_CODE = /^[a-z][a-z0-9_]*$/;

/**
 * Trigger aborts that have a real code already. The database enforces some
 * rules a second time, in its own words, and a caller deserves the same answer
 * whichever guard caught it first.
 */
const TRIGGER_CODES = [
  ['public dream requires established adult', 'adult_status_required'],
  ['adult status is required for publicity', 'adult_status_required'],
  ['attributed dream requires name consent', 'name_consent_required'],
  ['dream requires current keeper', 'piece_not_held'],
  ['dream change requires current keeper', 'piece_not_held'],
  ['dream marker requires current keeper', 'piece_not_held'],
  ['piece privacy requires the current keeper', 'piece_not_held'],
  ['piece privacy requires an active curated city', 'city_not_curated'],
  ['forbidden dream tier transition', 'forbidden_tier_transition'],
  ['sealing requires a private never-shone dream', 'shone_cannot_seal'],
  ['a sealed dream pins heirs_may_share to 0', 'dream_sealed'],
];

/**
 * The code to answer with.
 *
 * @param {unknown} thrown   whatever reached the catch
 * @param {string} fallback  the endpoint's own word for "something went wrong"
 * @returns {string} a token safe to put in a response body
 */
export function clientErrorCode(thrown, fallback) {
  const raw = thrown instanceof Error ? thrown.message : thrown;
  if (typeof raw !== 'string' || !raw) return fallback;
  // An explicit mapping wins: the database's wording for a rule the code
  // already has a word for.
  for (const [phrase, code] of TRIGGER_CODES) {
    if (raw.includes(phrase)) return code;
  }
  if (CLIENT_CODE.test(raw)) return raw;
  return fallback;
}
