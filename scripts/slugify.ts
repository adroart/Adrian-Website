/** Converts a title to a lowercase, hyphen-separated filename-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')   // strip non-alphanumeric except spaces/hyphens
    .replace(/[\s_]+/g, '-')    // spaces and underscores to hyphens
    .replace(/-+/g, '-')        // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');   // trim leading/trailing hyphens
}
