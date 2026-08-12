export type CollectorLetter = {
  id: string;
  kind: 'kin-claim' | 'anniversary' | 'transfer';
  body: string;
  createdAt: string;
};

const LETTER_KINDS = new Set<CollectorLetter['kind']>([
  'kin-claim', 'anniversary', 'transfer',
]);

function invalid(): never {
  throw new Error('collector_letters_invalid');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])) invalid();
}

function parseLetter(value: unknown): CollectorLetter {
  const letter = record(value);
  exact(letter, ['id', 'kind', 'body', 'createdAt']);
  if (typeof letter.id !== 'string' || !/^letter-[0-9a-f]{64}$/.test(letter.id)
    || !LETTER_KINDS.has(letter.kind as CollectorLetter['kind'])
    || typeof letter.body !== 'string' || !letter.body.length
    || letter.body.length > 2000 || letter.body !== letter.body.trim()
    || letter.body.includes('@')
    || typeof letter.createdAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(letter.createdAt)
    || !Number.isFinite(Date.parse(letter.createdAt))) invalid();
  return {
    id: letter.id,
    kind: letter.kind as CollectorLetter['kind'],
    body: letter.body,
    createdAt: letter.createdAt,
  };
}

export function parseCollectorLetters(value: unknown): CollectorLetter[] {
  const response = record(value);
  exact(response, ['letters']);
  if (!Array.isArray(response.letters)) invalid();
  return response.letters.map(parseLetter);
}

export async function fetchCollectorLetters(
  keeperPieceId: string,
  fetcher: typeof fetch = fetch,
): Promise<CollectorLetter[]> {
  if (!keeperPieceId.trim()) invalid();
  const response = await fetcher(
    `/api/collector/letters?piece=${encodeURIComponent(keeperPieceId)}`,
    {
      method: 'GET', credentials: 'include', cache: 'no-store',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw new Error('collector_letters_request_failed');
  return parseCollectorLetters(await response.json());
}
