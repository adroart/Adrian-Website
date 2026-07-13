import QRCode from 'qrcode';
import { isWellFormedRecoveryCode, normalizeRecoveryCode } from './recoveryCode';

const PUBLIC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_LENGTH = 8;
const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
const ARTWORK_ID_MAX_LENGTH = 7;

export const PUBLIC_PLATE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
export const PLATE_QR_ERROR_CORRECTION = 'Q' as const;
export const PLATE_QR_QUIET_ZONE = 4;

type RandomSource = Pick<Crypto, 'getRandomValues'>;

export interface ArtworkPlateInput {
  publicCode: string;
  ownershipCode: string;
  artworkId: string;
  editionNumber: number;
  generatedAt: string;
}

export interface ArtworkPlateManifest {
  schemaVersion: 1;
  publicCode: string;
  artworkId: string;
  editionNumber: number;
  publicUrl: string;
  ownershipCode: string;
  frontSha256: string;
  undersideSha256: string;
  generatedAt: string;
}

export interface ArtworkPlatePackage {
  publicCode: string;
  publicUrl: string;
  frontSvg: string;
  undersideSvg: string;
  frontSha256: string;
  undersideSha256: string;
  manifest: ArtworkPlateManifest;
}

/**
 * Returns one random candidate. The persistence layer owns uniqueness checks
 * and retries this function after a database collision.
 */
export function generatePublicPlateCode(randomSource: RandomSource = crypto): string {
  const characters: string[] = [];
  const rejectionLimit = 256 - (256 % PUBLIC_ALPHABET.length);

  while (characters.length < PUBLIC_CODE_LENGTH) {
    const bytes = randomSource.getRandomValues(new Uint8Array(PUBLIC_CODE_LENGTH));
    for (const byte of bytes) {
      if (byte >= rejectionLimit) continue;
      characters.push(PUBLIC_ALPHABET[byte % PUBLIC_ALPHABET.length]);
      if (characters.length === PUBLIC_CODE_LENGTH) break;
    }
  }

  return `AR-${characters.join('')}`;
}

export function isPublicPlateCode(value: string): boolean {
  return PUBLIC_PLATE_PATTERN.test(value);
}

export function publicPlateUrl(publicCode: string): string {
  if (!isPublicPlateCode(publicCode)) throw new Error('Invalid public plate code');
  return `https://adrianrasmussen.com/qr/${publicCode}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function renderFrontSvg(input: ArtworkPlateInput, publicUrl: string): Promise<string> {
  const qr = QRCode.create(publicUrl, {
    errorCorrectionLevel: PLATE_QR_ERROR_CORRECTION,
  });
  const pathParts: string[] = [];
  for (let y = 0; y < qr.modules.size; y += 1) {
    let x = 0;
    while (x < qr.modules.size) {
      if (!qr.modules.get(x, y)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < qr.modules.size && qr.modules.get(x, y)) x += 1;
      const run = x - start;
      pathParts.push(
        `M${start + PLATE_QR_QUIET_ZONE} ${y + PLATE_QR_QUIET_ZONE}h${run}v1h-${run}z`,
      );
    }
  }
  const publicCode = escapeXml(input.publicCode);
  const artworkIdentity = escapeXml(`${input.artworkId} · edition ${input.editionNumber}`);
  const visibleUrl = escapeXml(publicUrl);

  return '<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="62mm" viewBox="0 0 500 620" ' +
    'shape-rendering="crispEdges" data-error-correction="Q" data-quiet-zone="4">' +
    '<rect width="500" height="620" fill="#fff"/>' +
    `<path fill="#000000" transform="translate(45 15) scale(10)" d="${pathParts.join('')}"/>` +
    `<text x="250" y="468" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" letter-spacing="3">${publicCode}</text>` +
    `<text x="250" y="515" text-anchor="middle" font-family="Arial,sans-serif" font-size="12">${visibleUrl}</text>` +
    `<text x="250" y="558" text-anchor="middle" font-family="Arial,sans-serif" font-size="15">${artworkIdentity}</text>` +
    '</svg>';
}

function renderUndersideSvg(input: ArtworkPlateInput): string {
  const ownershipCode = escapeXml(input.ownershipCode);
  const identity = escapeXml(`${input.artworkId} · edition ${input.editionNumber}`);

  return '<svg xmlns="http://www.w3.org/2000/svg" width="70mm" height="25mm" viewBox="0 0 700 250">' +
    '<rect width="700" height="250" fill="#fff"/>' +
    '<text x="350" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" letter-spacing="4">OWNERSHIP CODE</text>' +
    `<text x="350" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" letter-spacing="3">${ownershipCode}</text>` +
    `<text x="350" y="148" text-anchor="middle" font-family="Arial,sans-serif" font-size="14">${identity}</text>` +
    '<text x="350" y="190" text-anchor="middle" font-family="Arial,sans-serif" font-size="13">Register or transfer at adrianrasmussen.com</text>' +
    '<text x="350" y="218" text-anchor="middle" font-family="Arial,sans-serif" font-size="12">Keep this permanent code with the artwork.</text>' +
    '</svg>';
}

async function sha256Utf8(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildArtworkPlatePackage(
  input: ArtworkPlateInput,
): Promise<ArtworkPlatePackage> {
  if (!isPublicPlateCode(input.publicCode)) throw new Error('Invalid public plate code');
  if (!Number.isInteger(input.editionNumber) || input.editionNumber < 0) {
    throw new Error('Invalid edition number');
  }
  if (
    typeof input.ownershipCode !== 'string' ||
    !isWellFormedRecoveryCode(input.ownershipCode)
  ) {
    throw new Error('Invalid ownership code');
  }
  const canonicalArtworkId =
    typeof input.artworkId === 'string' ? input.artworkId.trim().toUpperCase() : '';
  if (
    canonicalArtworkId.length > ARTWORK_ID_MAX_LENGTH ||
    !ARTWORK_ID_PATTERN.test(canonicalArtworkId)
  ) {
    throw new Error('Invalid artwork ID');
  }
  if (
    typeof input.generatedAt !== 'string' ||
    input.generatedAt.length !== 24 ||
    !Number.isFinite(Date.parse(input.generatedAt)) ||
    new Date(input.generatedAt).toISOString() !== input.generatedAt
  ) {
    throw new Error('Invalid generation time');
  }

  const normalizedOwnershipCode = normalizeRecoveryCode(input.ownershipCode);
  const canonicalInput: ArtworkPlateInput = {
    ...input,
    ownershipCode: normalizedOwnershipCode.match(/.{4}/g)!.join('-'),
    artworkId: canonicalArtworkId,
  };

  const publicUrl = publicPlateUrl(input.publicCode);
  const [frontSvg, undersideSvg] = await Promise.all([
    renderFrontSvg(canonicalInput, publicUrl),
    Promise.resolve(renderUndersideSvg(canonicalInput)),
  ]);
  const [frontSha256, undersideSha256] = await Promise.all([
    sha256Utf8(frontSvg),
    sha256Utf8(undersideSvg),
  ]);
  const manifest: ArtworkPlateManifest = {
    schemaVersion: 1,
    publicCode: input.publicCode,
    artworkId: canonicalInput.artworkId,
    editionNumber: input.editionNumber,
    publicUrl,
    ownershipCode: canonicalInput.ownershipCode,
    frontSha256,
    undersideSha256,
    generatedAt: input.generatedAt,
  };

  return {
    publicCode: input.publicCode,
    publicUrl,
    frontSvg,
    undersideSvg,
    frontSha256,
    undersideSha256,
    manifest,
  };
}
