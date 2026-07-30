export const PUBLIC_REGISTRY_ARTIST_NAME = 'Adrian Rasmussen' as const;
export const PUBLIC_REGISTRY_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
const MAX_EDITION_NUMBER = 9999;
const PLATE_STATUSES = ['generated', 'active'] as const;
const PROVENANCE_EVENTS = [
  'created',
  'exhibited',
  'sold',
  'commissioned',
  'restored',
  'transferred',
] as const;

export type PublicPlateStatus = (typeof PLATE_STATUSES)[number];
export type PublicProvenanceEventType = (typeof PROVENANCE_EVENTS)[number];

export interface PublicProvenanceEvent {
  year: string;
  event: PublicProvenanceEventType;
  note?: string;
}

export type PublicEditionIdentity =
  | { kind: 'unique'; number: null; size: null; label: 'Unique work' }
  | { kind: 'numbered'; number: number; size: number | null; label: string };

export interface PublicPlateIdentity {
  artworkId: string;
  title: string;
  series: string | null;
  edition: PublicEditionIdentity;
  publicCode: string;
  artistName: typeof PUBLIC_REGISTRY_ARTIST_NAME;
  plateStatus: PublicPlateStatus;
  publicProvenance: PublicProvenanceEvent[];
}

export interface PublicPlateIdentityProjection {
  artworkId: unknown;
  title: unknown;
  series: unknown;
  editionKind: unknown;
  editionNumber: unknown;
  editionSize: unknown;
  publicCode: unknown;
  plateStatus: unknown;
  publicProvenance: unknown;
  [key: string]: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function isBoundedText(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= max
    && value === value.trim();
}

export function isPublicRegistryCode(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_REGISTRY_CODE_PATTERN.test(value);
}

function projectPublicProvenance(value: unknown): PublicProvenanceEvent[] {
  if (!Array.isArray(value)) throw new Error('Invalid public provenance');
  return value.map((candidate) => {
    if (!isObject(candidate)) throw new Error('Invalid public provenance');
    const year = typeof candidate.year === 'string' ? candidate.year.trim() : '';
    const event = candidate.event;
    if (!isBoundedText(year, 40) || !PROVENANCE_EVENTS.includes(event as PublicProvenanceEventType)) {
      throw new Error('Invalid public provenance');
    }
    if (candidate.note === undefined) return { year, event: event as PublicProvenanceEventType };
    const note = typeof candidate.note === 'string' ? candidate.note.trim() : '';
    if (!isBoundedText(note, 500)) throw new Error('Invalid public provenance');
    return { year, event: event as PublicProvenanceEventType, note };
  });
}

function projectEdition(
  kind: unknown,
  number: unknown,
  size: unknown,
): PublicEditionIdentity {
  if (kind === 'unique') {
    if (number !== 0 || size !== null) throw new Error('Invalid public identity edition');
    return { kind: 'unique', number: null, size: null, label: 'Unique work' };
  }

  if (
    kind !== 'numbered'
    || !Number.isSafeInteger(number)
    || (number as number) < 1
    || (number as number) > MAX_EDITION_NUMBER
    || (
      size !== null
      && (
        !Number.isSafeInteger(size)
        || (size as number) < 1
        || (size as number) > MAX_EDITION_NUMBER
        || (number as number) > (size as number)
      )
    )
  ) {
    throw new Error('Invalid public identity edition');
  }

  return {
    kind: 'numbered',
    number: number as number,
    size: size as number | null,
    label: size === null ? `Edition ${number}` : `Edition ${number} of ${size}`,
  };
}

/** Build a privacy-preserving identity by selecting only the public contract. */
export function projectPublicPlateIdentity(
  input: PublicPlateIdentityProjection,
): PublicPlateIdentity {
  const artworkId = typeof input?.artworkId === 'string' ? input.artworkId.trim() : '';
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const series = input?.series == null
    ? null
    : typeof input.series === 'string'
      ? input.series.trim()
      : '';

  if (!ARTWORK_ID_PATTERN.test(artworkId) || !isBoundedText(title, 120)) {
    throw new Error('Invalid public identity artwork metadata');
  }
  if (series !== null && !isBoundedText(series, 80)) {
    throw new Error('Invalid public identity artwork metadata');
  }
  if (!isPublicRegistryCode(input?.publicCode)) {
    throw new Error('Invalid public identity code');
  }
  if (!PLATE_STATUSES.includes(input?.plateStatus as PublicPlateStatus)) {
    throw new Error('Invalid public identity plate status');
  }

  return {
    artworkId,
    title,
    series,
    edition: projectEdition(input.editionKind, input.editionNumber, input.editionSize),
    publicCode: input.publicCode,
    artistName: PUBLIC_REGISTRY_ARTIST_NAME,
    plateStatus: input.plateStatus as PublicPlateStatus,
    publicProvenance: projectPublicProvenance(input.publicProvenance),
  };
}

export function validatePublicPlateIdentity(value: unknown): value is PublicPlateIdentity {
  if (!isObject(value) || !hasExactKeys(value, [
    'artworkId', 'title', 'series', 'edition', 'publicCode', 'artistName',
    'plateStatus', 'publicProvenance',
  ])) return false;
  if (value.artistName !== PUBLIC_REGISTRY_ARTIST_NAME || !isObject(value.edition)) return false;
  if (!hasExactKeys(value.edition, ['kind', 'number', 'size', 'label'])) return false;

  try {
    const projected = projectPublicPlateIdentity({
      artworkId: value.artworkId,
      title: value.title,
      series: value.series,
      editionKind: value.edition.kind,
      editionNumber: value.edition.kind === 'unique' ? 0 : value.edition.number,
      editionSize: value.edition.size,
      publicCode: value.publicCode,
      plateStatus: value.plateStatus,
      publicProvenance: value.publicProvenance,
    });
    if (
      projected.artworkId !== value.artworkId
      || projected.title !== value.title
      || projected.series !== value.series
      || projected.publicCode !== value.publicCode
      || projected.artistName !== value.artistName
      || projected.plateStatus !== value.plateStatus
      || projected.edition.kind !== value.edition.kind
      || projected.edition.number !== value.edition.number
      || projected.edition.size !== value.edition.size
      || projected.edition.label !== value.edition.label
      || !Array.isArray(value.publicProvenance)
      || projected.publicProvenance.length !== value.publicProvenance.length
    ) return false;

    return projected.publicProvenance.every((event, index) => {
      const candidate = value.publicProvenance[index];
      if (!isObject(candidate)) return false;
      const expectedKeys = event.note === undefined ? ['year', 'event'] : ['year', 'event', 'note'];
      return hasExactKeys(candidate, expectedKeys)
        && candidate.year === event.year
        && candidate.event === event.event
        && candidate.note === event.note;
    });
  } catch {
    return false;
  }
}
