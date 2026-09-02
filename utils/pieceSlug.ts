/**
 * Canonical URL slugs for pieces.
 *
 * Pieces used to be addressed by their catalog id — /creations/SIG-100. That id is a
 * stock-keeping code, not a name: it tells a visitor nothing, it tells a search engine
 * nothing, and it reads as a database leak when someone pastes the link into a message.
 *
 * A piece is now addressed by its title — /creations/amphibian-dream — while every old
 * id URL keeps working and redirects to the canonical one. Ids stay the primary key in
 * the data and in the registry; only the URL changes.
 *
 * All 173 catalogued titles produce distinct slugs, so no disambiguation suffix is needed.
 * `pieceSlug` still falls back to the id if a future title ever slugs to nothing (a title
 * made entirely of punctuation, say), which keeps the function total.
 */

import type { Artwork } from '../types';

/** Lowercase, hyphen-separated, URL-safe. Mirrors scripts/slugify.ts. */
export function slugifyTitle(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** The canonical URL segment for a piece. */
export function pieceSlug(art: Pick<Artwork, 'id' | 'title'>): string {
    return slugifyTitle(art.title) || art.id.toLowerCase();
}

/** The canonical path for a piece. */
export function piecePath(art: Pick<Artwork, 'id' | 'title'>): string {
    return `/creations/${pieceSlug(art)}`;
}

/** The canonical absolute URL for a piece. */
export function pieceUrl(art: Pick<Artwork, 'id' | 'title'>): string {
    return `https://adrianrasmussen.com${piecePath(art)}`;
}

/**
 * Resolve a `:id` route param to a piece, accepting either form.
 *
 * Order matters: an exact id match wins, so a piece whose title happened to slug into
 * another piece's id could never shadow it. Matching is case-insensitive because links
 * get lowercased in the wild.
 */
export function resolvePiece<T extends Pick<Artwork, 'id' | 'title'>>(
    archive: readonly T[],
    param: string | undefined,
): T | undefined {
    if (!param) return undefined;
    const needle = param.toLowerCase();
    return (
        archive.find(a => a.id.toLowerCase() === needle) ??
        archive.find(a => pieceSlug(a) === needle)
    );
}

/** True when the param addressed the piece by its old id rather than its canonical slug. */
export function isLegacyPieceParam(
    art: Pick<Artwork, 'id' | 'title'>,
    param: string | undefined,
): boolean {
    if (!param) return false;
    return param.toLowerCase() !== pieceSlug(art);
}
