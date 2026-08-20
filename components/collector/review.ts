/**
 * The review layer: what is wrong, unresolved, or mine, per screen.
 *
 * This is scaffolding for checking the build, not part of the design. It comes
 * out with the rest of the harness when this becomes the page.
 *
 * The point of it is that a screen cannot be checked by looking at it. Looking
 * tells you whether it is handsome. It does not tell you whether the copy on it
 * is Adrian's or mine, whether a decision underneath it is still open, or which
 * card in the design file it was supposed to match. Each of those is a
 * different kind of wrong, so each gets its own mark.
 */

export type NoteKind =
  /** copy nobody has written yet. Adrian's, and not to be invented. */
  | 'unwritten'
  /** one of the eight open calls decides this screen */
  | 'call'
  /** built without a design card. Judge it fresh; nothing exists to compare. */
  | 'mine'
  /** something is knowingly not right yet, and here is what it should be */
  | 'gap';

export type Note = { kind: NoteKind; text: string };

export const KIND_LABEL: Record<NoteKind, string> = {
  unwritten: 'Not written yet',
  call: 'An open call decides this',
  mine: 'No card was drawn',
  gap: 'Knowingly not right yet',
};

/** the design language every undrawn screen was built to follow */
const FROM_THE_SHAPE =
  'Built from the shape the drawn screens establish: one drawing in the upper third, a short headline, brief body, one brass act in the lower third, skips as plain text links.';

export const REVIEW: Record<string, Note[]> = {
  /* ── the piece page and the code ─────────────────────────────── */

  piece: [
    {
      kind: 'gap',
      text: 'The tail of card 2a was past the 256 KiB read cap, so the foot and the row list were rebuilt from section 6 and from cards 20a and 20h. Split the design file and this can be matched exactly.',
    },
    {
      kind: 'call',
      text: 'Call 6, the orbit’s sizing. Built as 8c, grows with the piece. The design also offers 8a, fills the band, and 8b, held in from the edges.',
    },
    {
      kind: 'unwritten',
      text: 'The dream is placeholder. Its prompt is the highest stakes line in the flow: every guest reads it, and it locks for a year once placed.',
    },
    {
      kind: 'mine',
      text: 'The ground’s warmth curve is mine: roughly 0.6 at ten years held, a season and hour tint of a few hundredths, a birthday bump worth up to .15. Every constant is named and reasoned in utils/collectorGround.ts, for your eye.',
    },
    {
      kind: 'gap',
      text: 'The season and hour tint reads neutral on every real piece today. It needs a latitude, and no curated city carries coordinates yet, so nothing tints by season until one does.',
    },
    {
      kind: 'gap',
      text: 'Section 6’s deep-in inversion, where the page slowly becomes the person and the piece becomes the frame, is not built. One fixed weighting stands at every stage today.',
    },
  ],

  code: [
    { kind: 'gap', text: 'The cells fall back to the platform’s mono. The design specifies IBM Plex Mono, which is not installed.' },
    { kind: 'call', text: 'Call 3 decides the second line: the locked warning closes with “Keep it safe.” and the design drops it.' },
  ],

  codetrue: [
    { kind: 'call', text: 'Call 1 is the wrong code screen this one pairs with, reached by typing sixteen nines.' },
  ],

  /* ── the threshold, all locked copy, none of it drawn ────────── */

  fork: [{ kind: 'mine', text: 'Copy is locked from section 3. The look is mine. ' + FROM_THE_SHAPE }],
  gift: [{ kind: 'mine', text: 'Copy is locked from section 3. The look is mine. ' + FROM_THE_SHAPE }],
  sealed: [{ kind: 'mine', text: 'Copy is locked from section 3. The look is mine. ' + FROM_THE_SHAPE }],
  receiving: [{ kind: 'mine', text: 'Copy is locked from section 3. The look is mine. ' + FROM_THE_SHAPE }],
  written: [{ kind: 'mine', text: 'Copy is locked from section 3. The look is mine. ' + FROM_THE_SHAPE }],

  transfer: [
    { kind: 'call', text: 'Call 2. The button reads Begin the passing, from the wording record. The design’s card 19e reads Release it.' },
  ],

  /* ── the four: your words, my look ───────────────────────────── */

  pull: [{ kind: 'mine', text: 'Every word is yours, verbatim from section 4. The look is mine: no card was drawn for the four. ' + FROM_THE_SHAPE }],
  grid: [{ kind: 'mine', text: 'Every word is yours, verbatim from section 4. The globe is a drawing of mine, and the design manifest names it as one of the seven motifs.' }],
  love: [{ kind: 'mine', text: 'Every word is yours, verbatim from section 4. The glow swelling once is specified in the motion rules and is not built yet.' }],
  carries: [{ kind: 'mine', text: 'Every word is yours, verbatim from section 4. The only screen in the flow with no drawing, per your own note.' }],

  /* ── the gathering ───────────────────────────────────────────── */

  sign: [
    { kind: 'gap', text: 'The note about one account across everything comes from the interactive spec, not from card 9a. The card has no note under the fields.' },
    {
      kind: 'mine',
      text: 'This is the one gathering screen with no back link, because nothing before it is correctable: behind it is the fourth of the four, which is pure receiving. Every screen after it has one, and what you type here survives going back to fix it.',
    },
  ],
  born: [
    { kind: 'gap', text: 'Order changed. The wording record’s map puts Who you are second of five; the interactive spec skipped it entirely. Built in the record’s order, so a full walk reaches every gathering screen.' },
  ],
  lives: [
    {
      kind: 'gap',
      text: 'Call 4 is settled by §7 (2026-08-20, "the gathering, re-ordered"): this stays required either way, and leads into who now, not links. The grain chips read City / Area, and the words themselves are placeholder, not locked, since Adrian named the pair only descriptively ("city, or the area marked less accurate").',
    },
  ],
  links: [{ kind: 'gap', text: 'Three services plus an add another, which the handoff lists as an open call against five named services. Superseded on the required path by the links section of who; survives here as a kept chapter.' }],
  shows: [
    {
      kind: 'gap',
      text: 'Superseded by who (§7, 2026-08-20): shareIntention and shareCity now default true always through registration, and the five identity lamps live on who instead. This screen leaves the required path and stands as a kept surface, for changing any of the seven choices later.',
    },
    {
      kind: 'call',
      text: 'Your chart, Your work and Your mission are placeholder titles, and the seven lamps now outgrow the band, so this screen scrolls against the house law that no setup screen scrolls. Both want your layout ruling.',
    },
    {
      kind: 'gap',
      text: 'The lamps always open at the drawn default, never reading back what was actually saved, so a returning caretaker sees settings that may not be theirs until they retouch every one.',
    },
  ],
  who: [
    {
      kind: 'unwritten',
      text: 'No card was drawn; built fresh from §7 (2026-08-20, "the gathering, re-ordered"). The head, the birthday privacy line, and both links-section strings (the add-a-link note aside) are placeholder, awaiting Adrian.',
    },
    {
      kind: 'gap',
      text: 'The links section’s show-on-the-map toggle is an honest unwired placeholder: no shareLinks field exists on the wire, so the choice stores client-side only, and its own note says so.',
    },
  ],
  explain: [],
  light47: [],

  /* ── the year turns, the passing, the people ─────────────────── */

  ritual: [
    { kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE },
    {
      kind: 'unwritten',
      text: 'The body paragraph is placeholder; Adrian has not ruled on it. The mechanic itself is settled now: three real actions, reinforce, plant anew, mark fulfilled, and each one submits for real.',
    },
  ],
  ritualplant: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  ritualfamily: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],

  passfork: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  passname: [{ kind: 'mine', text: 'No card was drawn. The succession mark is deliberately not on these rows: it sits one tap deeper, inside a person, because adding someone is warm and naming them next is a will.' }],
  passsell: [{ kind: 'mine', text: 'No card was drawn. One line naming what travels, never a triage screen, per section 6.' }],
  passvalue: [{ kind: 'mine', text: 'No card was drawn. The chain is public and the sums are not.' }],
  passready: [{ kind: 'call', text: 'Call 2 decides this button too. It shares card 19e with the release screen.' }],
  passdone: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  passaccept: [
    { kind: 'unwritten', text: 'Every line on this screen is unwritten. No locked copy exists for accepting a release, and card 19f’s wording is the designer’s.' },
  ],

  invite: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  invitesent: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  person: [{ kind: 'mine', text: 'No card was drawn. Where she stands is the private succession mark, and she is never told.' }],
  personSuccession: [{ kind: 'mine', text: 'No card was drawn. One tap deeper than the person row, on purpose: no toggle here, nothing behind it wired yet.' }],

  joinletter: [{ kind: 'mine', text: 'No card was drawn. It arrives from outside the app, because she has no account until she accepts.' }],
  joinhello: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],
  joinwho: [{ kind: 'mine', text: 'No card was drawn. Two things, never five: the record itself belongs to whoever carries the piece.' }],

  inheritletter: [{ kind: 'mine', text: 'No card was drawn. It arrives by letter; there is no door to it inside the app.' }],
  inheritaccept: [{ kind: 'mine', text: 'No card was drawn. By their hand, never by a timer.' }],
  inherit: [{ kind: 'mine', text: 'No card was drawn. What he sealed is sealed and is never shown to them.' }],
  inheritread: [{ kind: 'mine', text: 'No card was drawn. ' + FROM_THE_SHAPE }],

  welcome: [],
  forgot: [{ kind: 'mine', text: 'No card was drawn. Recovery touches the account only; the record and the piece are untouched.' }],

  /* ── the rooms ───────────────────────────────────────────────── */

  story: [{ kind: 'unwritten', text: 'All three paragraphs are placeholder. Adrian’s account of the making goes here, and this row shows the same text to everyone.' }],
  certificate: [{ kind: 'unwritten', text: 'Per piece materials data is Adrian’s and does not exist yet, so the ledger reads from samples.' }],
  history: [{ kind: 'mine', text: 'The two way toggle, how it moved against what was written, is drawn on card 14f. The entries are samples.' }],
  dreams: [{ kind: 'unwritten', text: 'The four dreams are samples, showing the shape. None is anyone’s.' }],
  information: [{ kind: 'unwritten', text: 'Per piece materials data is Adrian’s. What was paid is the one warmed line and is caretaker only.' }],
  garden: [
    { kind: 'call', text: 'Call 7. Built as one at a time plus the index, which the design marks as picked. The card stack, 14b, is marked superseded there and is not built.' },
    { kind: 'unwritten', text: 'All eight questions are placeholder, and so is the guidance under them. They are Adrian’s, and which of them wait for the birthday is still open.' },
    {
      kind: 'gap',
      text: 'The index carries only the one dream slot the wire holds today; the other seven rows read waiting until a real multi-answer model exists behind them.',
    },
    {
      kind: 'gap',
      text: 'Once a dream is first placed there is no wire to change the heirs’ choice again, so the row hides after that rather than pretend a later toggle would save anything.',
    },
    {
      kind: 'call',
      text: 'The writer’s-own-access line under Seal it is Adrian’s spoken ruling, crafted in his diction rather than quoted verbatim, and this exact string has not been read back to him.',
    },
  ],
  family: [{ kind: 'unwritten', text: 'The household and the waiting words are samples. The letter wording has not been worked.' }],
  account: [],
  letters: [{ kind: 'mine', text: 'No card was drawn. Read-only, generated by the backend; the empty line and every letter-kind word are placeholders under the copy freeze.' }],
  /* keyed apart from the walked screen of the same name, which is the second
     of the four */
  grid_room: [
    {
      kind: 'gap',
      text: 'The coastlines are hand drawn and coarse. The design renders real ones from d3, topojson and world-atlas over a CDN inside an iframe, and none of the three is a dependency here. The graticule, the light placement and every style value are the design’s.',
    },
  ],

  /* ── the states ──────────────────────────────────────────────── */

  account_state: [{ kind: 'unwritten', text: 'The copy on card 20c is the designer’s, not Adrian’s. It is unlocked and open to rewriting.' }],
  held: [{ kind: 'unwritten', text: 'The copy on card 20e is the designer’s. The one law it must keep is that it says nothing about who holds the piece.' }],
  plate: [{ kind: 'unwritten', text: 'Card 20f’s copy is the designer’s, and it carries an explicit placeholder for why a plate is replaced.' }],
  offline: [{ kind: 'unwritten', text: 'Card 20g’s copy is the designer’s. The law it keeps is that the screen is a receipt, not a failure.' }],
  recordonly: [{ kind: 'gap', text: 'This is what a scan lands on while the livingLegacy flag is false, which is its state today. No door, no error, no hint that a registry is coming.' }],
  notyet: [{ kind: 'mine', text: 'No card was drawn. The honest door while the passing is unwired: deliberate, not a gap to close, until the transfer backend lands.' }],

  letter: [{ kind: 'unwritten', text: 'Every line is placeholder. Letters have not been worked, and the video capsule’s wording waits on cost research and appears nowhere.' }],
  email: [{ kind: 'unwritten', text: 'Every line is placeholder. The two choices at the foot are the settled mechanic; the words around them are not.' }],
};

/** how many screens carry something worth checking */
export const flagged = (key: string): Note[] => REVIEW[key] ?? [];
