export const PUBLIC_REGISTRY_ARTIST_NAME = 'Adrian Rasmussen' as const;
export const PUBLIC_REGISTRY_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
const MAX_EDITION_NUMBER = 9999;
const PLATE_STATUSES = ['generated', 'active', 'superseded'] as const;
const PROVENANCE_EVENTS = [
  'created',
  'exhibited',
  'sold',
  'commissioned',
  'restored',
  'transferred',
] as const;
const CREATOR_HISTORY_ENTRY_TYPES = [
  'contributor',
  'creation_place',
  'intention',
  'material',
  'technique',
  'note',
] as const;

export type PublicPlateStatus = (typeof PLATE_STATUSES)[number];
export type PublicProvenanceEventType = (typeof PROVENANCE_EVENTS)[number];
export type PublicCreatorHistoryEntryType = (typeof CREATOR_HISTORY_ENTRY_TYPES)[number];

export interface PublicProvenanceEvent {
  year: string;
  event: PublicProvenanceEventType;
  note?: string;
}

export interface PublicCreatorHistoryEntry {
  entryType: PublicCreatorHistoryEntryType;
  title: string;
  detail: string | null;
  role: string | null;
  occurredAt: string | null;
}

export type PublicEditionIdentity =
  | { kind: 'unique'; number: null; size: null; label: 'Unique work' }
  | { kind: 'numbered'; number: number; size: number | null; label: string };

interface PublicPlateIdentityBase {
  artworkId: string;
  title: string;
  series: string | null;
  edition: PublicEditionIdentity;
  publicCode: string;
  artistName: typeof PUBLIC_REGISTRY_ARTIST_NAME;
  publicProvenance: PublicProvenanceEvent[];
  creatorHistory: PublicCreatorHistoryEntry[];
}

export type PublicPlateIdentity = PublicPlateIdentityBase & (
  | { plateStatus: 'generated' | 'active' }
  | { plateStatus: 'superseded'; successorDisclosure: 'withheld' }
  | {
      plateStatus: 'superseded';
      successorDisclosure: 'disclosed';
      currentPublicCode: string;
    }
);

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
  creatorHistory: unknown;
  successorDisclosure?: unknown;
  currentPublicCode?: unknown;
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

function nullableBoundedText(value: unknown, max: number): string | null {
  if (value === null) return null;
  if (!isBoundedText(value, max)) throw new Error('Invalid public creator history');
  return value;
}

function isValidOccurredAt(value: string): boolean {
  if (/^\d{4}$/.test(value)) return true;
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) return Number(month[2]) >= 1 && Number(month[2]) <= 12;

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z)?$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  const day = Number(dayText);
  if (monthNumber < 1 || monthNumber > 12
    || day < 1 || day > new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()) {
    return false;
  }
  return hourText === undefined
    || (Number(hourText) <= 23 && Number(minuteText) <= 59 && Number(secondText) <= 59);
}

function projectPublicCreatorHistory(value: unknown): PublicCreatorHistoryEntry[] {
  if (!Array.isArray(value)) throw new Error('Invalid public creator history');
  return value.map((candidate) => {
    if (!isObject(candidate)) throw new Error('Invalid public creator history');
    const entryType = candidate.entryType;
    if (!CREATOR_HISTORY_ENTRY_TYPES.includes(entryType as PublicCreatorHistoryEntryType)) {
      throw new Error('Invalid public creator history');
    }
    if (!isBoundedText(candidate.title, 300)) {
      throw new Error('Invalid public creator history');
    }
    const detail = nullableBoundedText(candidate.detail, 5000);
    const role = nullableBoundedText(candidate.role, 300);
    const occurredAt = nullableBoundedText(candidate.occurredAt, 40);
    if ((entryType === 'contributor' && role === null)
      || (occurredAt !== null && !isValidOccurredAt(occurredAt))) {
      throw new Error('Invalid public creator history');
    }
    return {
      entryType: entryType as PublicCreatorHistoryEntryType,
      title: candidate.title,
      detail,
      role,
      occurredAt,
    };
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

  const identity = {
    artworkId,
    title,
    series,
    edition: projectEdition(input.editionKind, input.editionNumber, input.editionSize),
    publicCode: input.publicCode,
    artistName: PUBLIC_REGISTRY_ARTIST_NAME,
    plateStatus: input.plateStatus as PublicPlateStatus,
    publicProvenance: projectPublicProvenance(input.publicProvenance),
    creatorHistory: projectPublicCreatorHistory(input.creatorHistory),
  };
  if (input.plateStatus !== 'superseded') return identity as PublicPlateIdentity;
  if (input.successorDisclosure === 'withheld') {
    return { ...identity, successorDisclosure: 'withheld' } as PublicPlateIdentity;
  }
  if (input.successorDisclosure === 'disclosed'
    && isPublicRegistryCode(input.currentPublicCode)
    && input.currentPublicCode !== input.publicCode) {
    return {
      ...identity,
      successorDisclosure: 'disclosed',
      currentPublicCode: input.currentPublicCode,
    } as PublicPlateIdentity;
  }
  throw new Error('Invalid public identity successor disclosure');
}

export function validatePublicPlateIdentity(value: unknown): value is PublicPlateIdentity {
  if (!isObject(value)) return false;
  const expectedKeys = value.plateStatus === 'superseded'
    ? value.successorDisclosure === 'disclosed'
      ? [
          'artworkId', 'title', 'series', 'edition', 'publicCode', 'artistName',
          'plateStatus', 'publicProvenance', 'creatorHistory',
          'successorDisclosure', 'currentPublicCode',
        ]
      : [
          'artworkId', 'title', 'series', 'edition', 'publicCode', 'artistName',
          'plateStatus', 'publicProvenance', 'creatorHistory', 'successorDisclosure',
        ]
    : [
    'artworkId', 'title', 'series', 'edition', 'publicCode', 'artistName',
    'plateStatus', 'publicProvenance', 'creatorHistory',
      ];
  if (!hasExactKeys(value, expectedKeys)) return false;
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
      creatorHistory: value.creatorHistory,
      successorDisclosure: value.successorDisclosure,
      currentPublicCode: value.currentPublicCode,
    });
    if (
      projected.artworkId !== value.artworkId
      || projected.title !== value.title
      || projected.series !== value.series
      || projected.publicCode !== value.publicCode
      || projected.artistName !== value.artistName
      || projected.plateStatus !== value.plateStatus
      || ('successorDisclosure' in projected
        && projected.successorDisclosure !== value.successorDisclosure)
      || ('currentPublicCode' in projected
        && projected.currentPublicCode !== value.currentPublicCode)
      || projected.edition.kind !== value.edition.kind
      || projected.edition.number !== value.edition.number
      || projected.edition.size !== value.edition.size
      || projected.edition.label !== value.edition.label
      || !Array.isArray(value.publicProvenance)
      || projected.publicProvenance.length !== value.publicProvenance.length
      || !Array.isArray(value.creatorHistory)
      || projected.creatorHistory.length !== value.creatorHistory.length
    ) return false;

    const validPublicProvenance = projected.publicProvenance.every((event, index) => {
      const candidate = value.publicProvenance[index];
      if (!isObject(candidate)) return false;
      const expectedKeys = event.note === undefined ? ['year', 'event'] : ['year', 'event', 'note'];
      return hasExactKeys(candidate, expectedKeys)
        && candidate.year === event.year
        && candidate.event === event.event
        && candidate.note === event.note;
    });
    if (!validPublicProvenance) return false;
    return projected.creatorHistory.every((entry, index) => {
      const candidate = value.creatorHistory[index];
      return isObject(candidate)
        && hasExactKeys(candidate, ['entryType', 'title', 'detail', 'role', 'occurredAt'])
        && candidate.entryType === entry.entryType
        && candidate.title === entry.title
        && candidate.detail === entry.detail
        && candidate.role === entry.role
        && candidate.occurredAt === entry.occurredAt;
    });
  } catch {
    return false;
  }
}
