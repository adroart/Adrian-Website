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
   * is the secret that lets a signed-in user bind themselves as the piece's
   * keeper.
   *
   * NEVER store the plaintext recovery code here or anywhere in the repo. Only
   * the hash lives in source. Generate the code with
   * utils/recoveryCode.generateRecoveryCode(), print it on the piece, hash it
   * with hashRecoveryCode(), and paste ONLY the hash here. Adrian keeps the
   * plaintext offline (the physical scratch panel is the only durable copy).
   *
   * The keeper-side bind also writes this hash into keeper_pieces; the registry
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

  // ── Artwork QR codes ────────────────────────────────────────────
  // Add entries here as you engrave/print QR codes for pieces.
  // The code should match the artwork ID in FULL_ARCHIVE.

  // Living Legacy worked example (gated behind the `livingLegacy` flag).
  // UL-100 ("Art of Living - 32") is a real piece in FULL_ARCHIVE. The public
  // QR (code 'UL-100') is look-only and routes to /works/UL-100. The keeper
  // binds with a LONG recovery code printed under a scratch panel on the back
  // of the art, distinct from this public number. Only the SHA-256 hash of that
  // code lives in source; the plaintext stays offline on the physical piece.
  //
  // NOTE: recoveryCodeHash below is a worked-EXAMPLE hash. Before a real
  // print run, Adrian generates a fresh random code per piece with
  // utils/recoveryCode.generateRecoveryCode(), prints it, hashes it, and
  // replaces this value. See todo/plans/living-legacy.md.
  {
    code: 'UL-100',
    type: 'artwork',
    destination: '/works/UL-100',
    label: 'Art of Living - 32 · Universal Language',
    created: '2026',
    active: true,
    recoveryCodeHash:
      '4f7f0287d2909b11da94d68e90524cf37f5b93cbc77ebd28a1ab701a27d12c62',
    notes:
      'Living Legacy keeper piece. Recovery code is on the back of the art, not this QR number.',
  },
];
