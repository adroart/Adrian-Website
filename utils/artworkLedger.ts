export type PublicArtworkLedgerEntry = {
  id: string;
  message?: string;
  mediaUrl?: string;
  createdAt: string;
};

export type ArtworkPriceOccurrence =
  | { precision: 'exact'; value: string }
  | { precision: 'month'; value: string }
  | { precision: 'year'; value: string }
  | { precision: 'unknown'; value: null };

export type KeeperCertificatePrice = {
  amountMinor: number;
  currency: string;
  occurrence: ArtworkPriceOccurrence;
  recordedAt: string;
};

function record(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: string[], code: string) {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error(code);
  }
}

function timestamp(value: unknown, code: string): string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value) throw new Error(code);
  return value;
}

function publicId(value: unknown, code: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(code);
  }
  return value;
}

function occurrence(value: unknown, code: string): ArtworkPriceOccurrence {
  const source = record(value, code);
  exactKeys(source, ['precision', 'value'], code);
  if (source.precision === 'unknown' && source.value === null) {
    return { precision: 'unknown', value: null };
  }
  if (source.precision === 'year' && typeof source.value === 'string'
    && /^\d{4}$/.test(source.value)) {
    return { precision: 'year', value: source.value };
  }
  if (source.precision === 'month' && typeof source.value === 'string'
    && /^\d{4}-(0[1-9]|1[0-2])$/.test(source.value)) {
    return { precision: 'month', value: source.value };
  }
  if (source.precision === 'exact' && typeof source.value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(source.value)
    && new Date(`${source.value}T00:00:00.000Z`).toISOString().slice(0, 10) === source.value) {
    return { precision: 'exact', value: source.value };
  }
  throw new Error(code);
}

export function parsePublicArtworkLedger(value: unknown): PublicArtworkLedgerEntry[] {
  const code = 'invalid_artwork_ledger';
  if (!Array.isArray(value)) throw new Error(code);
  return value.map((candidate) => {
    const source = record(candidate, code);
    const allowed = ['id', 'createdAt'];
    if (Object.hasOwn(source, 'message')) allowed.push('message');
    if (Object.hasOwn(source, 'mediaUrl')) allowed.push('mediaUrl');
    exactKeys(source, allowed, code);
    const id = publicId(source.id, code);
    const createdAt = timestamp(source.createdAt, code);
    const projected: PublicArtworkLedgerEntry = { id, createdAt };
    if (Object.hasOwn(source, 'message')) {
      if (typeof source.message !== 'string' || source.message !== source.message.trim()
        || source.message.length < 1 || source.message.length > 8000) throw new Error(code);
      projected.message = source.message;
    }
    if (Object.hasOwn(source, 'mediaUrl')) {
      const expected = `/api/artwork-ledger/media/${encodeURIComponent(id)}`;
      if (source.mediaUrl !== expected) throw new Error(code);
      projected.mediaUrl = expected;
    }
    if (!projected.message && !projected.mediaUrl) throw new Error(code);
    return projected;
  });
}

export function parseKeeperCertificateLedger(value: unknown): KeeperCertificatePrice[] {
  const code = 'invalid_certificate_ledger';
  const response = record(value, code);
  exactKeys(response, ['ok', 'priceHistory'], code);
  if (response.ok !== true || !Array.isArray(response.priceHistory)) throw new Error(code);
  return response.priceHistory.map((candidate) => {
    const source = record(candidate, code);
    exactKeys(source, ['amountMinor', 'currency', 'occurrence', 'recordedAt'], code);
    if (!Number.isSafeInteger(source.amountMinor) || Number(source.amountMinor) < 0
      || typeof source.currency !== 'string' || !/^[A-Z]{3}$/.test(source.currency)) {
      throw new Error(code);
    }
    return {
      amountMinor: Number(source.amountMinor),
      currency: source.currency,
      occurrence: occurrence(source.occurrence, code),
      recordedAt: timestamp(source.recordedAt, code),
    };
  });
}
