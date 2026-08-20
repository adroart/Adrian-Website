/**
 * The four artist-ceremony DEMO chapters for the guided walkthrough: how
 * Adrian himself creates and registers a piece, in what order the codes are
 * born, how a piece already out in the world joins through an invitation
 * instead of a fresh unboxing, how the physical plate comes out of those
 * same two codes, and last, placing more into a piece already registered.
 * Each is played out station by station inside a `CeremonyStation` running
 * against the browser-only demo fetch stub (`demoFetchStub.ts`), never a
 * real backend.
 *
 * `chapters.ts` leads the whole walkthrough with these four, under the
 * 'making' section — this is the process that creates a piece and its
 * codes, not the collector's own journey through one already made.
 */

export type CeremonyChapter = {
  id: string;
  title: string;
  surface: 'register' | 'addtopiece' | 'plate';
  stations: { step: string; label: string; notice: string }[];
};

const registerCeremonyChapter: CeremonyChapter = {
  id: 'ceremony-register',
  title: 'The register ceremony',
  surface: 'register',
  stations: [
    {
      step: 'threshold',
      label: 'Begin',
      notice: 'The opening screen: what registration means, before anything is asked.',
    },
    {
      step: 'work',
      label: 'Choose the work',
      notice: 'Search the catalog, or name a new work that is not in it yet.',
    },
    {
      step: 'edition',
      label: 'The edition',
      notice: 'Unique or numbered, fixed once and asked only here.',
    },
    {
      step: 'unlock',
      label: 'Unlock',
      notice: 'Any word unlocks this demo. The real registry asks for the registry secret.',
    },
    {
      step: 'confirm',
      label: 'Confirm',
      notice: 'The full ledger, one last look before anything is written.',
    },
    {
      step: 'done',
      label: 'Done',
      notice: 'This is where the piece’s two codes are born · the public AR code the world scans, and the Ownership Code, shown here exactly once. In this demo, copying it may fall back to copy-by-hand.',
    },
  ],
};

/**
 * "A piece already in someone's hands": the same register ceremony, walked
 * from its own threshold link rather than its main Begin button. Held mode
 * needs no URL param and no extra prop, it is reachable purely by clicking
 * the threshold's foot link the way Adrian would in the real ceremony, so
 * this chapter shares the 'register' surface and mounts a second, separate
 * instance of the same screen.
 */
const heldCeremonyChapter: CeremonyChapter = {
  id: 'ceremony-held',
  title: 'A piece already in someone’s hands',
  surface: 'register',
  stations: [
    {
      step: 'threshold',
      label: 'Begin',
      notice: 'The same opening screen. Below Begin sits the other door in: “A piece already in someone’s hands.”',
    },
    {
      step: 'work',
      label: 'Choose the work',
      notice: 'The same catalog search. This piece is already with its holder, an invitation will carry the registry to them.',
    },
    {
      step: 'edition',
      label: 'The edition',
      notice: 'Unique or numbered, fixed once, exactly as in the ordinary ceremony.',
    },
    {
      step: 'unlock',
      label: 'Unlock',
      notice: 'Any word unlocks this demo. The real registry asks for the registry secret.',
    },
    {
      step: 'confirm',
      label: 'Confirm',
      notice: 'The ledger, plus one more field here · the holder’s email, so the invitation knows who it is for.',
    },
    {
      step: 'done',
      label: 'Done',
      notice: 'The Ownership Code is copied first, same as any registration. Dismiss it, and the invitation follows · its reference, then a single-use token shown exactly once.',
    },
  ],
};

/**
 * "Preparing the plate": how the two codes born in the register ceremony
 * become a physical object. A purpose-made quiet sequence rather than the
 * real AdminPlateWizard, whose fabricate stage lives inside a full admin
 * desk (its own header, its own Tailwind wood/bronze page chrome, a
 * registered-piece list to choose from) rather than the 390px espresso
 * ceremony card every other chapter wears, and needs a piece-list endpoint
 * on top of prepare-plate to even reach that stage. CeremonyStation instead
 * builds the two plate faces directly with the real generator
 * (utils/artworkPlate.ts) from this demo's own codes, so what is shown is
 * the real SVG output, only reached without the admin desk around it.
 */
const plateCeremonyChapter: CeremonyChapter = {
  id: 'ceremony-plate',
  title: 'Preparing the plate',
  surface: 'plate',
  stations: [
    {
      step: 'front',
      label: 'The front',
      notice: 'The QR the world scans. It carries the public code out into the open, on the piece itself.',
    },
    {
      step: 'underside',
      label: 'The underside',
      notice: 'The code only its caretaker sees, engraved where a stranger holding the piece never looks.',
    },
    {
      step: 'closing',
      label: 'What travels where',
      notice: 'The two SVGs go to the fabricator. The manifest, and the Ownership Code inside it, never leaves the registry.',
    },
  ],
};

const addToPieceCeremonyChapter: CeremonyChapter = {
  id: 'ceremony-add',
  /* deliberately not "Adding to your piece" — that title belongs to the
     collector-facing chapter built from the same-named FLOWS entry (the
     garden). This is the artist-ceremony demo of the same surface, so it
     gets a quieter, distinct title rather than colliding with it verbatim. */
  title: 'Placing more into a piece',
  surface: 'addtopiece',
  stations: [
    {
      step: 'hub',
      label: 'The hub',
      notice: 'One row per thing that can join the piece, nothing required and nothing waiting on anything else.',
    },
    {
      step: 'photo',
      label: 'A photograph',
      notice: 'One image, added straight into the piece’s permanent record.',
    },
    {
      step: 'story',
      label: 'The story',
      notice: 'The words that travel with the piece, kept in its record.',
    },
    {
      step: 'message',
      label: 'A message',
      notice: 'Sealed for the piece’s caretaker, met only when they unlock it.',
    },
  ],
};

/* Walk order: the ordinary register ceremony first, then the held-piece
   variant of the same ceremony right after it (same door, the other way
   in), then the plate those codes become, then the additive add-to-piece
   layer last, since it only ever follows a piece that already exists. */
export const ceremonyChapters: CeremonyChapter[] = [
  registerCeremonyChapter,
  heldCeremonyChapter,
  plateCeremonyChapter,
  addToPieceCeremonyChapter,
];

export {
  registerCeremonyChapter,
  heldCeremonyChapter,
  plateCeremonyChapter,
  addToPieceCeremonyChapter,
};
