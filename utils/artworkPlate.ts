import QRCode from 'qrcode';

const PUBLIC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_CODE_LENGTH = 8;

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

async function renderFrontSvg(publicUrl: string): Promise<string> {
  const svg = await QRCode.toString(publicUrl, {
    type: 'svg',
    errorCorrectionLevel: PLATE_QR_ERROR_CORRECTION,
    margin: PLATE_QR_QUIET_ZONE,
    width: 42,
    color: { dark: '#000000', light: '#ffffff' },
  });

  return svg.replace(
    '<svg ',
    '<svg data-error-correction="Q" data-quiet-zone="4" ',
  ).replace('width="42" height="42"', 'width="42mm" height="42mm"');
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
  if (!input.artworkId) throw new Error('Invalid artwork ID');
  if (!input.generatedAt) throw new Error('Invalid generation time');

  const publicUrl = publicPlateUrl(input.publicCode);
  const [frontSvg, undersideSvg] = await Promise.all([
    renderFrontSvg(publicUrl),
    Promise.resolve(renderUndersideSvg(input)),
  ]);
  const [frontSha256, undersideSha256] = await Promise.all([
    sha256Utf8(frontSvg),
    sha256Utf8(undersideSvg),
  ]);
  const manifest: ArtworkPlateManifest = {
    schemaVersion: 1,
    publicCode: input.publicCode,
    artworkId: input.artworkId,
    editionNumber: input.editionNumber,
    publicUrl,
    ownershipCode: input.ownershipCode,
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
