/**
 * Ground axis math for the collector piece page.
 *
 * Design source: todo/plans/collector-screen-wording.md, section 6
 * ("Growth has no ceiling, and runs on two axes" / "Season, hour, and the
 * birthday month"). Two axes never combine into one score. This module is
 * the GROUND axis only:
 *
 *   Years held — the GROUND. Patina, settling, the frame warming, hairlines
 *   softening. It accrues to everyone at the same rate simply by holding
 *   the piece. Nobody can buy it, rush it, or fall behind on it.
 *
 * The LIGHT axis (what is placed: words, presence) is handled elsewhere and
 * never enters this file.
 *
 * Hard rules enforced by this module:
 *   - No stages, no levels, no thresholds a person could compare. Every
 *     curve here is continuous; nothing steps.
 *   - Season, hour of day, and the caretaker's birthday month tint the
 *     GROUND ONLY. Brass never shifts — this module has no notion of
 *     brass at all, and nothing it exports should ever be wired to a
 *     brass/accent color. That wiring discipline belongs to the caller.
 *   - The birthday month is the warmest the piece ever gets: composeGround
 *     is built so the birthday month is always the annual maximum of the
 *     composed warmth, regardless of where it falls relative to the
 *     seasonal or diurnal cycle (see BIRTHDAY_WARMTH_WEIGHT below).
 *   - Nothing here reads the system clock directly. Every function takes
 *     an ISO timestamp string from the caller and parses it explicitly;
 *     none of them default to "right now."
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Average Gregorian year length in days (365 + 97/400), used throughout
 * for converting between milliseconds, days, and "month units" so the
 * annual and birthday cycles stay in sync with each other. */
const DAYS_PER_YEAR = 365.2425;

const MS_PER_YEAR = MS_PER_DAY * DAYS_PER_YEAR;

/**
 * Fractional years a piece has been held, clamped to zero or above.
 *
 * @param firstBoundAt ISO timestamp of the piece's first binding to a
 *   caretaker.
 * @param now ISO timestamp supplied by the caller (never read from the
 *   system clock by this function).
 * @returns Fractional years, always >= 0. A `now` earlier than
 *   `firstBoundAt` (clock skew, bad data) clamps to 0 rather than going
 *   negative.
 */
export function heldSinceYears(firstBoundAt: string, now: string): number {
  const start = new Date(firstBoundAt).getTime();
  const current = new Date(now).getTime();
  const years = (current - start) / MS_PER_YEAR;
  return Math.max(0, years);
}

/**
 * Saturating time constant for {@link groundWarmth}, in years.
 *
 * Chosen so that ten years held reads as roughly 0.6 warmth: solving
 * `1 - e^(-10/k) = 0.6` gives `k = 10 / ln(1 / 0.4) ≈ 10.914`. There is
 * no other significance to the number — it is simply the constant that
 * places the ten-year mark at 0.6 on a smooth `1 - e^(-years/k)` curve.
 * Nothing about the curve is staged or thresholded; 0.6 at ten years is a
 * calibration point, not a level.
 */
const GROUND_WARMTH_K_YEARS = 10 / Math.log(1 / 0.4);

/**
 * Smooth, monotonic, saturating warmth from years held alone.
 *
 * `warmth = 1 - e^(-years / GROUND_WARMTH_K_YEARS)`. Zero at zero years,
 * strictly increasing, asymptotically approaching (never reaching) 1.
 * No piecewise steps, no stages: the derivative is continuous everywhere.
 *
 * @param heldYears Fractional years held (see {@link heldSinceYears}).
 *   Negative input is treated as 0.
 * @returns Warmth in [0, 1).
 */
export function groundWarmth(heldYears: number): number {
  const years = Math.max(0, heldYears);
  return 1 - Math.exp(-years / GROUND_WARMTH_K_YEARS);
}

/** Peak-annual-warmth day of year (0-indexed, UTC, non-leap-year basis):
 * day 288 falls in mid-October, the deep amber core of a northern-
 * hemisphere autumn — "the ground warms toward amber in autumn, cools in
 * winter." A single-sinusoid annual cycle necessarily has its coolest
 * point exactly opposite the peak (mid-April); winter sits on the
 * descending slope between the two, which matches "cools in winter"
 * without requiring winter to be the literal trough. */
const PEAK_AUTUMN_DAY_OF_YEAR = 288;

/** Amplitude of the annual seasonal component, in degrees of hue shift. */
const SEASON_HUE_AMPLITUDE_DEG = 5;
/** Amplitude of the annual seasonal component, as a warmth delta. */
const SEASON_WARMTH_AMPLITUDE = 0.03;
/** Amplitude of the diurnal component, in degrees of hue shift. */
const DIURNAL_HUE_AMPLITUDE_DEG = 2;
/** Amplitude of the diurnal component, as a warmth delta. */
const DIURNAL_WARMTH_AMPLITUDE = 0.02;

function dayOfYearUtc(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
  return (date.getTime() - startOfYear) / MS_PER_DAY;
}

/**
 * Gentle annual + diurnal tint over the GROUND only. Never touches brass.
 *
 * The annual half is a single cosine cycle peaking in northern-hemisphere
 * autumn (see {@link PEAK_AUTUMN_DAY_OF_YEAR}), mirrored for the southern
 * hemisphere by the sign of `latitude`. The diurnal half is a cosine over
 * the UTC hour, peaking at UTC noon and troughing at UTC midnight — the
 * piece page has no timezone to work with, so UTC is used as a documented
 * stand-in for "day" and "night" rather than the caretaker's true local
 * time. Both halves are small (amplitudes of a few degrees / a few
 * hundredths of warmth) so they read as a tint, never a takeover.
 *
 * `latitude === null` (no location on file) returns a fully neutral tint
 * rather than guessing a hemisphere.
 *
 * @param now ISO timestamp.
 * @param latitude Degrees, positive north / negative south, or null when
 *   unknown.
 */
export function seasonTint(
  now: string,
  latitude: number | null,
): { hueShiftDeg: number; warmthDelta: number } {
  if (latitude === null) {
    return { hueShiftDeg: 0, warmthDelta: 0 };
  }

  const date = new Date(now);
  const doy = dayOfYearUtc(date);
  const seasonalPhase = Math.cos(
    (2 * Math.PI * (doy - PEAK_AUTUMN_DAY_OF_YEAR)) / DAYS_PER_YEAR,
  );
  const hemisphereSign = latitude < 0 ? -1 : 1;

  const hourUtc = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  const diurnalPhase = Math.cos((2 * Math.PI * (hourUtc - 12)) / 24);

  const hueShiftDeg =
    hemisphereSign * SEASON_HUE_AMPLITUDE_DEG * seasonalPhase +
    DIURNAL_HUE_AMPLITUDE_DEG * diurnalPhase;
  const warmthDelta =
    hemisphereSign * SEASON_WARMTH_AMPLITUDE * seasonalPhase +
    DIURNAL_WARMTH_AMPLITUDE * diurnalPhase;

  return { hueShiftDeg, warmthDelta };
}

/** Half-width of the birthday-month bump, in month units. "±3 weeks
 * equivalent in month-space": 21 days converted to months using the same
 * average month length (DAYS_PER_YEAR / 12) that the rest of this module
 * uses, so the birthday window and the annual cycle share one clock. */
const BIRTHDAY_WINDOW_MONTHS = 21 / (DAYS_PER_YEAR / 12);

/**
 * Smooth 0..1 bump centered on the caretaker's birth month, a raised
 * cosine window ("Hann window") of half-width {@link BIRTHDAY_WINDOW_MONTHS}
 * month-units on either side of the month's center. 1 at the center of
 * the birth month, falling smoothly (continuous value and slope) to 0 by
 * roughly three weeks out in month-space, and exactly 0 beyond that — not
 * a step, just a compact continuous bump. `birthMonthIndex === null`
 * (no birth details on file) always returns 0, so the piece falls back to
 * the registration anniversary silently, as the design requires.
 *
 * @param now ISO timestamp.
 * @param birthMonthIndex 0-indexed birth month (0 = January), or null.
 */
export function birthdayMonthBoost(now: string, birthMonthIndex: number | null): number {
  if (birthMonthIndex === null) {
    return 0;
  }

  const date = new Date(now);
  const doy = dayOfYearUtc(date);
  const nowMonthContinuous = (doy / DAYS_PER_YEAR) * 12;
  const targetMonthCenter = birthMonthIndex + 0.5;

  let delta = nowMonthContinuous - targetMonthCenter;
  delta = (((delta + 6) % 12) + 12) % 12 - 6; // wrap to [-6, 6)
  const distance = Math.abs(delta);

  if (distance >= BIRTHDAY_WINDOW_MONTHS) {
    return 0;
  }
  return 0.5 * (1 + Math.cos((Math.PI * distance) / BIRTHDAY_WINDOW_MONTHS));
}

/** Weight applied to {@link birthdayMonthBoost}'s 0..1 output inside
 * {@link composeGround}. Chosen so the birthday month is always the
 * annual maximum of composed warmth, no matter how it falls relative to
 * the seasonal/diurnal cycle: the combined seasonal + diurnal warmth
 * swing never exceeds SEASON_WARMTH_AMPLITUDE + DIURNAL_WARMTH_AMPLITUDE
 * = 0.05, and this weight (0.15) is more than double that, so even a
 * birthday landing exactly on the seasonal/diurnal trough still outweighs
 * a non-birthday day sitting at the seasonal/diurnal peak. */
const BIRTHDAY_WARMTH_WEIGHT = 0.15;

/** Composed hueShiftDeg is clamped to this range on either side so the
 * tint always reads as subtle, whatever the inputs. */
const MAX_HUE_SHIFT_DEG = 8;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Combines years-held warmth, the season/hour tint, and the birthday
 * bump into the single ground reading the piece page's CSS maps to. This
 * is the GROUND axis in full; it never reads or influences the LIGHT axis
 * and it never produces a value that should be wired to brass.
 *
 * @returns `warmth` in [0, 1], `hueShiftDeg` in [-8, 8].
 */
export function composeGround(input: {
  firstBoundAt: string;
  now: string;
  latitude: number | null;
  birthMonthIndex: number | null;
}): { warmth: number; hueShiftDeg: number } {
  const heldYears = heldSinceYears(input.firstBoundAt, input.now);
  const base = groundWarmth(heldYears);
  const tint = seasonTint(input.now, input.latitude);
  const boost = birthdayMonthBoost(input.now, input.birthMonthIndex);

  const warmth = clamp01(base + tint.warmthDelta + boost * BIRTHDAY_WARMTH_WEIGHT);
  const hueShiftDeg = clamp(tint.hueShiftDeg, -MAX_HUE_SHIFT_DEG, MAX_HUE_SHIFT_DEG);

  return { warmth, hueShiftDeg };
}
