/**
 * QR Registry — the single source of truth for every QR code
 * Adrian has issued, engraved, or printed.
 *
 * RULES (do not change — printed/engraved QRs depend on them):
 *   Domain:     adrianrasmussen.com
 *   Base path:  /qr/:code
 *   Max code:   11 characters → QR Version 3 (29x29), the minimum
 *               achievable with this domain length.
 *   Charset:    A-Z, 0-9, hyphen. No lowercase (keeps codes readable
 *               when engraved small).
 *
 * HOW IT WORKS:
 *   /qr/:code  →  Cloudflare Function (functions/qr/[number].js)
 *                  routes by pattern:
 *                    • numbers 1-64  →  mandalacodes.com oracle card
 *                    • "oracle"      →  mandalacodes.com oracle home
 *                    • everything else → /works/:code on this site
 *
 *   /works/:id →  Permanent artwork record page (WorksPage.tsx).
 *                 Looks up the piece in FULL_ARCHIVE by id.
 *
 *   /qr        →  Private index page (QRIndex.tsx). Lists every
 *                  registered code, its destination, and these rules.
 */

export interface QREntry {
  code: string;
  type: 'oracle' | 'artwork' | 'exhibition' | 'custom';
  destination: string;
  label: string;
  created: string;
  active: boolean;
  notes?: string;
  /**
   * Living Legacy (gated behind the `livingLegacy` launch flag).
   *
   * The SHA-256 hash of the long recovery code printed on the BACK of the
   * physical piece, under a scratch panel. This is distinct from `code` (the
   * public QR number, which is look-only and binds nobody). The recovery code
   * is the secret that lets a signed-in user register as the piece's steward.
   *
   * NEVER store the plaintext recovery code here or anywhere in the repo. Only
   * the hash lives in source. Generate the code with
   * utils/recoveryCode.generateRecoveryCode(), print it on the piece, hash it
   * with hashRecoveryCode(), and paste ONLY the hash here. Adrian keeps the
   * plaintext offline (the physical scratch panel is the only durable copy).
   *
   * The steward-side bind also writes this hash into legacy `keeper_pieces`; the registry
   * copy is the artist-side worked example and a recovery anchor.
   */
  recoveryCodeHash?: string;
}

export const QR_RULES = {
  maxCodeLength: 11,
  domain: 'adrianrasmussen.com',
  basePath: '/qr/',
  qrVersion: 3,
  gridSize: '29x29',
  errorCorrection: 'M',
  charset: 'A-Z 0-9 hyphen',
  fixedOverhead: 31,
} as const;

export const QR_REGISTRY: QREntry[] = [
  // ── Oracle cards (legacy, printed plaques in the wild) ──────────
  ...Array.from({ length: 64 }, (_, i) => ({
    code: String(i + 1),
    type: 'oracle' as const,
    destination: `https://mandalacodes.com/oracle/universal-language/${i + 1}`,
    label: `Universal Language Oracle Card ${i + 1}`,
    created: '2024',
    active: true,
    notes: 'Printed plaque, redirects to mandalacodes.com',
  })),
  {
    code: 'oracle',
    type: 'oracle' as const,
    destination: 'https://mandalacodes.com/oracle/universal-language',
    label: 'Oracle Deck Home',
    created: '2024',
    active: true,
    notes: 'Printed plaque, redirects to mandalacodes.com',
  },

  // Modern artwork QR identities (public_code values like 'AR-...') are
  // issued through /admin/register and live in the shared D1 `keeper_pieces`
  // table, not here. This file never lists them; the live inventory is
  // served by /api/admin/qr-index, which merges these legacy entries with
  // the current `keeper_pieces` rows at request time.
];
