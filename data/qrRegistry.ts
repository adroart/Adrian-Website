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
  // Example:
  // {
  //   code: 'MAN-034',
  //   type: 'artwork',
  //   destination: '/works/MAN-034',
  //   label: 'Sol Urchin — Green Blue',
  //   created: '2026',
  //   active: true,
  // },
];
