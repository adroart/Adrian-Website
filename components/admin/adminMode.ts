export function adminMode(params: URLSearchParams): 'create' | 'issue' | null {
  const mode = params.get('mode');
  return mode === 'create' || mode === 'issue' ? mode : null;
}

export type ExactAdminPageSelection =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'exact'; id: number }
  | { kind: 'invalid' };

export function exactAdminPageSelection(
  params: URLSearchParams,
  idKey: 'invoiceId' | 'viewingId',
): ExactAdminPageSelection {
  if (params.size === 0) return { kind: 'list' };
  if (params.size === 1 && params.getAll('mode').length === 1 && params.get('mode') === 'create') {
    return { kind: 'create' };
  }
  const ids = params.getAll(idKey);
  if (params.size !== 1 || ids.length !== 1 || !/^[1-9]\d*$/.test(ids[0])) {
    return { kind: 'invalid' };
  }
  const id = Number(ids[0]);
  return Number.isSafeInteger(id) && String(id) === ids[0]
    ? { kind: 'exact', id }
    : { kind: 'invalid' };
}
