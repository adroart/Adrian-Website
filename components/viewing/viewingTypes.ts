/**
 * Types for "The Viewing" — a private, link-shared art lookbook sent to a single
 * collector. The collector skims a curated set of pieces (art-led), taps to read
 * the full meaning of any one, selects the ones he wants, and requests them.
 *
 * Display-first scaffolding: the viewer renders from a ViewingData object. For
 * now that object is supplied by baked-in sample data (see sampleViewing.ts);
 * later the same shape comes from a token lookup (/api/viewings/:token), built
 * in the admin creator and assembled from the mandalacodes recommendation engine.
 *
 * No prices live here on purpose. The viewing is about desire; the money arrives
 * afterward as an invoice (the existing /admin/invoices flow). Requesting pieces
 * hands the selection off to that flow.
 */

/** One artwork in the viewing, with its reading unfolded only on demand. */
export interface ViewingPiece {
  /** Stable id, used for selection + the request handoff. Usually the piece slug. */
  id: string;
  /** Oracle/code/gate number (1-64). Art piece N == code N. */
  code: number;
  /** The artwork's title, e.g. "Earth's Breath". */
  name: string;
  /** Cloudinary public id or full URL for the hero image. */
  image?: string;
  /** Smaller variant for the cover contact-sheet + recommendation thumbnails. */
  thumb?: string;
  /** The single essence line shown in the skim layer (one sentence). */
  glance: string;

  // ---- Energy layer (revealed on "Read more") — art first, no esoterica ----
  /**
   * A few evocative keywords for the piece, e.g. ["Origination", "Renewal",
   * "First Movement"]. These read as art language; no system knowledge needed.
   */
  keywords?: string[];
  /**
   * A short plain-voice description (2-3 sentences) of what the piece is about
   * and the energy it carries. No "Gift"/"Shadow"/sphere vocabulary — grounded
   * art writing a cold collector understands. This is the heart of the taste.
   */
  description?: string;

  /**
   * Link to the full reading for the curious — the live piece page or the card
   * on mandalacodes. The Gene Keys / Human Design depth lives behind this door,
   * never in the default view. Rendered as a quiet "Go deeper" link.
   */
  pieceUrl?: string;

  /** True if this piece is one of the curator's starred recommendations. */
  recommended?: boolean;
}

/** A single curated pick on the recommendation page, with the personal reason. */
export interface ViewingRecPick {
  /** References a piece already in the viewing by id. */
  pieceId: string;
  /** The artist's one-to-two sentence reason, in his voice. */
  reason: string;
}

/** The signed recommendation that closes the viewing. */
export interface ViewingRecommendation {
  /** The intention this viewing answers, in the collector's own words. */
  intention?: string;
  /** The 2-3 pieces the artist would have him acquire together. */
  picks: ViewingRecPick[];
  /** The closing line above the signature. */
  closing?: string;
  /** Who it's signed by. Defaults to "Adrian". */
  signature?: string;
}

/** The whole viewing — what the viewer component renders. */
export interface ViewingData {
  /** Public token (also the URL segment). Absent in pure-sample mode. */
  token?: string;
  /** Who this was assembled for, e.g. "Daniel". Renders as "For Daniel". */
  recipientName: string;
  /** The italic line under the name on the cover. */
  subtitle: string;
  /** The curated pieces, in display order. */
  pieces: ViewingPiece[];
  /** The closing recommendation, if the artist wrote one. */
  recommendation?: ViewingRecommendation;
  /**
   * When true, append a quiet "The rest of the collection" grid of the deck's
   * other codes at the end — for open/anonymous viewings, not ones personalized
   * for a named collector. Hidden by default.
   */
  showRestOfCollection?: boolean;
}
