export function adminMode(params: URLSearchParams): 'create' | 'issue' | null {
  const mode = params.get('mode');
  return mode === 'create' || mode === 'issue' ? mode : null;
}
