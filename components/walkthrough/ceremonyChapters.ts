/**
 * The two artist-ceremony DEMO chapters for the guided walkthrough: the
 * register ceremony and adding to a piece, each played out station by
 * station inside a `CeremonyStation` running against the browser-only demo
 * fetch stub (`demoFetchStub.ts`), never a real backend.
 */

export type CeremonyChapter = {
  id: string;
  title: string;
  surface: 'register' | 'addtopiece';
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
      notice: 'The Ownership Code shows once and cannot be shown again here. In this demo, copying it may fall back to copy-by-hand.',
    },
  ],
};

const addToPieceCeremonyChapter: CeremonyChapter = {
  id: 'ceremony-add',
  title: 'Adding to your piece',
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

export const ceremonyChapters: CeremonyChapter[] = [
  registerCeremonyChapter,
  addToPieceCeremonyChapter,
];

export { registerCeremonyChapter, addToPieceCeremonyChapter };
