/**
 * Every string on the collector surface, in one place.
 *
 * No collector string is ever written inline in a component. The wording record
 * (`todo/plans/collector-screen-wording.md`) is the master; section 6 of it wins
 * wherever it disagrees with anything earlier in that file. Locked copy is used
 * verbatim: it is not paraphrased, tightened, or improved, and a locked line is
 * never shortened to make it fit. If it overflows, the layout is wrong.
 *
 * Two markers carry the provenance:
 *   locked(s)      — Adrian's words, settled. Change only with him.
 *   placeholder(s) — not written yet. Renders with a visible marker in dev so
 *                    no placeholder can reach Adrian disguised as finished copy.
 *
 * Every entry carries the section it came from, so "section 6 wins" is
 * checkable against the file rather than against a memory.
 */

/** Whether unwritten copy is marked on screen. On in dev; a reviewer walking
 *  the flow can turn it off to read the screens as a visitor would. */
export const MARKS_DEFAULT =
  typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);

/** Adrian's words, settled. Used verbatim. */
export const locked = (s: string): string => s;

/**
 * Not yet written. Returns the string, and registers it so it can be marked on
 * screen. Never ships silently: a placeholder that nobody can see is a
 * placeholder that reaches Adrian looking finished.
 */
export const placeholder = (s: string): string => s;

/** Every string that came from placeholder(). Drives the marker. */
export const PLACEHOLDERS = new Set<string>();

const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

/**
 * Whether this exact string is unwritten copy. Membership only: whether the
 * mark is *visible* is a CSS matter, set by `data-marks` on the collector root,
 * so toggling it costs no re-render.
 */
export const isPlaceholder = (s: string): boolean => PLACEHOLDERS.has(s);

/* ------------------------------------------------------------------ *
 * The walking example. Every screen swaps in the real piece at runtime.
 * Ordinals shown are samples. — wording record, design rules
 * ------------------------------------------------------------------ */
export const PIECE = {
  series: locked('Universal Language 1'),
  name: locked('Earth’s Breath'),
  /** the piece's own code, for the shell: sixteen ones */
  code: '1111111111111111',
  ordinal: 47,
} as const;

export const COPY = {
  /* ---------------------------------------------------------------- *
   * The piece page. wording record §6, 2026-08-10, supersedes §1
   * ---------------------------------------------------------------- */
  page: {
    statusRegistered: locked('Registered · a light in the Resonant Grid'),
    statusUnclaimed: locked('Not yet registered'),

    rowStory: locked('The story'),
    rowCertificate: locked('The certificate'),
    rowHistory: locked('The history'),
    rowDreams: locked('The dreams'),

    /* caretaker-only rows. These exist only when signed in and are never
       visible, greyed, or hinted at otherwise. — §6 */
    rowGarden: locked('Add to your piece'),
    rowInformation: locked('Piece information'),
    rowFamily: locked('The people you love'),
    rowPassing: locked('Passing it on'),
    rowAccount: locked('Your account'),

    /* a text link, not a row, because rows open in place and links travel. */
    siteLink: locked('Into the artist’s website'),

    /* the way in, by state. §6, "Arrival, dressed by relationship" */
    begin: locked('Begin'),
    doorLook: locked('Look through it'),
    doorTend: locked('Sign in to tend it'),
    /* signed in, but the piece is not theirs. Having an account is not the
       same as holding this piece. */
    doorHold: locked('I hold this piece'),

    /* the short line beneath Begin on an unclaimed piece. Proposals doc
       2026-08-12, "The arrivals," Spot 1 — Adrian chose Option B, 2026-08-20. */
    unclaimedNote: locked('This piece has no home yet. Begin gives it one.'),
    /* the short line beneath the two doors, registered-not-yours state.
       Proposals doc 2026-08-12, "The arrivals," Spot 2 — Adrian chose
       Option A, 2026-08-20. */
    registeredNotYoursNote: locked(
      'Someone already tends this piece. Look through it, or say it is yours.',
    ),

    back: locked('Back to the piece'),
    close: locked('Close'),
    open: locked('Open'),

    /* the dream leads the page: the first thing any guest reads. §6 */
    dreamSample: ph(
      'That this house stays a place people arrive at unannounced.',
    ),
    dreamCite: locked('placed this year · opens again near the birthday'),
  },

  /* ---------------------------------------------------------------- *
   * The code. §2 copy LOCKED; shape revised by §6 (sixteen characters,
   * two rows of eight, its own page, the last character is the press).
   * ---------------------------------------------------------------- */
  code: {
    help: locked(
      'Turn the piece over. The code is written on its underside, and only its caretaker can see it.',
    ),
    warn: locked('Whoever holds the code holds access. Keep it safe.'),
    noCode: locked('I don’t have a code'),
    gift: locked('I am giving this to someone'),

    /* the wrong-code state. §3, LOCKED 2026-08-09 */
    wrongHead: locked('The code is not true'),
    wrongBody: locked(
      'It did not match this piece. Turn it over and look again; if it still will not open, Adrian will help.',
    ),
    tryAgain: locked('Try again'),
    contact: locked('Contact Adrian'),

    /* the lock readout under the cells. Mechanical, not copy. */
    stateWaiting: locked('Waiting'),
    stateReading: locked('Reading'),
    stateTrue: locked('True'),
  },

  /* ---------------------------------------------------------------- *
   * The eight states a real person reaches.
   * Source: the Claude Design project, section "the states". That copy is
   * the designer's, NOT Adrian's, except where a locked line already
   * existed — those are swapped in above. Everything here is unlocked.
   * ---------------------------------------------------------------- */
  states: {
    accountHead: ph('One account, every piece'),
    accountBody: ph(
      'The code proves the piece is in your hands. The account is where what you place in it lives, and it is the same account across everything of Adrian’s.',
    ),
    accountHeld: ph('Your code, held here'),
    accountHeldNote: ph('You will not be asked for it again.'),
    accountMake: ph('Make your account'),
    accountHave: ph('I already have one'),

    heldHead: ph('This piece is held'),
    heldBody: ph(
      'Someone is already its caretaker. If it has come to you, the passing is theirs to open from the inside, and Adrian can settle it when they cannot.',
    ),
    heldBody2: ph('The piece keeps what it holds either way. Nothing is lost by waiting.'),
    heldWrite: ph('Write to Adrian'),

    plateHead: ph('The plate on this piece was replaced in 2025.'),
    plateBody: ph(
      'The code you scanned belongs to the first plate and still leads here. One piece, one record, and both plates are part of its story.',
    ),
    plateNote: ph(
      'Adrian’s wording for why a plate is replaced goes here, and it is the same for everyone who reads it.',
    ),

    offlineHead: ph('Your words are here'),
    offlineBody: ph(
      'The piece could not be reached just now. What you wrote is on this phone and stays until it lands.',
    ),
    offlineRetry: ph('Try again'),
    offlineLater: ph('Finish this later'),
  },

  /* ---------------------------------------------------------------- *
   * The threshold. §3, LOCKED
   * ---------------------------------------------------------------- */
  threshold: {
    trueHead: locked('The code is true'),
    trueBody: locked(
      'Earth’s Breath is real, and it is in your hands. It is one light in the Resonant Grid: a living artwork spread across the world. The next few minutes register it as authentic and as yours, and give it its place.',
    ),
    trueContinue: locked('Continue'),
    trueFork: locked('This piece is for someone else'),

    forkHead: locked('For someone else'),
    forkGift: locked('Giving it as a gift'),
    forkGiftNote: locked(
      'leave your wishes with the piece; they are sealed until its new caretaker unlocks it',
    ),
    forkPass: locked('Passing on my own piece'),
    forkPassNote: locked('begin handing your caretakership to another'),

    giftHead: locked('Leave your wishes with it'),
    giftBody: locked(
      'Write what you wish for the one who will hold this piece. Your words seal into it, greet them the day they make it theirs, and live with the piece forever.',
    ),
    giftSeal: locked('Seal your wishes'),

    sealedHead: locked('Something was left for you'),
    sealedBody: locked(
      'Whoever gave you this piece placed words inside it, sealed until this moment.',
    ),
    sealedOpen: locked('Open them'),

    transferHead: locked('Passing it on'),
    transferBody: locked(
      'You are releasing Earth’s Breath to its next caretaker. Everything you placed in it stays with the piece forever, as its story. When they accept, your hold ends and theirs begins.',
    ),
    transferBegin: locked('Begin the passing'),
    transferNot: locked('Not now'),

    receivingHead: locked('A passing begins'),
    receivingBody: locked(
      'Earth’s Breath is real, and it is in your hands. But it is held by another caretaker, and nothing moves without them. We will ask them to let go; when they do, it becomes yours to carry.',
    ),

    writtenHead: locked('We have written to its caretaker'),
    writtenBody: locked(
      'Earth’s Breath is registered to someone. They will confirm the letting go. If thirty days pass in silence, with reminders along the way, the piece passes to you and both of you are told.',
    ),
    writtenReturn: locked('Return to the piece'),
  },

  /* ---------------------------------------------------------------- *
   * The four screens. §4, LOCKED, Adrian's words, verbatim.
   * Nothing is asked on any of the four: pure receiving.
   * No skip link. Tap anywhere advances.
   * ---------------------------------------------------------------- */
  four: {
    pullHead: locked('You felt the pull'),
    pullBody: locked(
      'Perhaps it was beauty. Or the story. Or just a feeling beyond words. There was a connection.',
    ),

    gridHead: locked('The resonant grid'),
    gridBody: locked(
      'The ones who hold these creations feel it too. They weave a grid across the planet. And you are a part of that.',
    ),

    loveHead: locked('When you focus your love, it grows'),
    loveBody: locked(
      'Infuse your love into this art and its light shines brighter. Every time you see it, you will feel everything it holds, and the resonance you have placed within it.',
    ),

    carriesHead: locked('It carries on'),
    carriesBody: locked(
      'Hundreds of years from now, whoever is fortunate enough to caretake this art will feel the love you have infused it with today. Everything you enter now will live with it forever.',
    ),
    carriesBody2: locked('So take a moment, and write your story.'),
    carriesBegin: locked('Begin'),
  },

  /* ---------------------------------------------------------------- *
   * The gathering. §5 wording, §6 structure.
   * Registration is binary; incomplete means not registered.
   * ---------------------------------------------------------------- */
  gathering: {
    eyebrow: locked('Registering Earth’s Breath'),

    signHead: locked('Sign its record'),
    signBody: locked(
      'Earth’s Breath will carry your name from today. Your email is where the piece will write to you.',
    ),
    signNote: locked(
      'One account, and it is not only this piece’s. The same name and password open your readings on Mandala Codes, the ledger, and anything you order from Adrian, already signed in.',
    ),
    signPill: locked('Sign'),
    fieldFirst: locked('First name'),
    fieldLast: locked('Last name'),
    fieldEmail: locked('Email'),
    fieldPassword: locked('Create a password'),
    hintEmail: locked('you@somewhere'),
    hintPassword: locked('at least eight characters'),

    bornHead: locked('Who you are'),
    bornBody: locked(
      'For the piece’s astrology, and for the ones who will find you through it.',
    ),
    /* character-diffed 2026-08-20 against collector-primitives.html's
       `eyebrow:'Born'` — identical, no change. */
    bornEyebrow: locked('Born'),
    bornNote: locked(
      'A full reading needs all three. They are never shown to anyone; only what they produce can be, and only if you choose.',
    ),
    bornWhy: locked('Why we ask'),
    fieldDate: locked('Date'),
    fieldTime: locked('Time'),
    fieldPlace: locked('Place of birth'),
    hintDate: locked('dd / mm / yyyy'),
    hintTime: locked('hh : mm'),
    hintPlace: locked('city, country'),

    livesHead: locked('Where it lives'),
    livesBody: locked('A light must live somewhere.'),
    livesNote: locked(
      'Its light shows at city level at most, never an address. If even the city feels close, you can widen it to the region: the light stays true but cannot be pinpointed.',
    ),
    fieldCity: locked('City'),
    hintCity: locked('where the art hangs'),
    grainCity: locked('Show my city'),
    grainRegion: locked('Widen to the region'),

    linksHead: locked('Your links'),
    linksBody: locked(
      'For the people your piece moves, so they can find who holds it. Everything you add here shows on the piece’s page; leave out anything you would rather keep to yourself.',
    ),
    fieldSite: locked('Your website'),
    hintSite: locked('yourname.com'),
    linksAdd: locked('Add a social link'),
    linksAddNote: locked('Instagram · X · Facebook · and more'),
    linksWhich: locked('Which one'),

    showsHead: locked('What shows'),
    /* §6 line "your piece shines; here is what shows, and anything you
       would rather keep quiet, uncheck." — character-diffed 2026-08-20:
       the record uses a semicolon and lowercase "here" mid-sentence; the
       prior copy here used a period and a capital "Here" (two sentences).
       Corrected to match. */
    showsBody: locked(
      'Your piece shines; here is what shows, and anything you would rather keep quiet, uncheck.',
    ),
    showsPill: locked('Keep these choices'),
    showPlaced: locked('What you place in it'),
    showPlacedNote: locked('Shines as words with no name, unless you uncheck it.'),
    showLight: locked('The light on the map'),
    showLightNote: locked('Your city, never an address. Widen it to the region any time.'),
    showName: locked('Your name and face'),
    showNameNote: locked('Off until you tick it. Your links and your work are separate ticks.'),
    /* birth details are shown to nobody, ever. No switch exists. §6 */
    showBirth: locked('Your birth details'),
    /* character-diffed 2026-08-20: no verbatim UI-drawn line for this exact
       sentence exists in §6 or collector-primitives.html to diff against
       (only the descriptive rule "Birth details are shown to nobody, ever
       ... There is no switch for it anywhere," §6 lines 738/803). Left
       unchanged — nothing to correct it against. */
    showBirthNote: locked('Shown to nobody, ever. There is no switch.'),
    showShows: locked('shows'),
    showQuiet: locked('quiet'),
    showNever: locked('never'),

    /* the skip explainer, and the same sheet "Why we ask" opens. §5 LOCKED */
    explainHead: locked('What this is for'),
    explainBody: locked(
      'Your birthday ties your piece to your astrology, and it lets the piece mark your day: once a year, near your birthday, it asks for a moment with you. Your links are for the people your piece moves, so they can find who holds it. Nothing here is shown without your choice, and everything can be added later.',
    ),
    explainAdd: locked('Add it now'),
    explainSkip: locked('Skip anyway'),

    skip: locked('Skip for now'),
    continue: locked('Continue'),

    /* each required screen says so plainly. §6 */
    required: locked(
      'The piece is not registered until this is placed. Leaving now leaves it unregistered; nothing you have written is lost.',
    ),
  },

  /* ---------------------------------------------------------------- *
   * Ignition. §5 / the globe, LOCKED (map ring open)
   * ---------------------------------------------------------------- */
  ignition: {
    head: locked('You are Light 47'),
    body: locked(
      'Earth’s Breath now shines at city level from where you are. Never an address, never your name unless you opened them.',
    ),
    pill: locked('Open its page'),
  },

  /* ---------------------------------------------------------------- *
   * The rooms behind the rows.
   * The story, the certificate and the history are Adrian's to write; the
   * structure is real and the prose is marked.
   * ---------------------------------------------------------------- */
  rooms: {
    storyLead: ph(
      'Eleven months, one piece of claro walnut, and an argument about where the centre was.',
    ),
    storyBody1: ph(
      'The geometry came first, drawn flat, months before the wood arrived. When it did arrive the grain ran the length of the board and would not agree with the drawing, so the drawing moved.',
    ),
    storyBody2: ph(
      'It is the first of the sixty four. Everything after it inherits the decisions made here, including the ones that were wrong.',
    ),
    storyNote: ph(
      'Adrian’s own words go here, and this row shows the same text to everyone.',
    ),

    /* what anyone who scans the piece can see. Price is caretaker-only. §6 */
    certNote: locked('What anyone who scans the piece can see. What was paid is not here.'),
    certFoot: locked(
      'Authenticity is public. Who holds it, where it lives beyond the city, and what was paid are not.',
    ),

    /* the full record, caretaker-only, and the one place price appears. §6 */
    infoNote: locked('The full record. What was paid appears here and nowhere else.'),
    infoFoot: locked(
      'Everything above except what was paid and the first caretaker is on the public certificate. Being named as the one who brought it to life is yours to open, on What shows.',
    ),

    dreamsNote: locked('What other caretakers chose to let shine. Words with no name.'),
    dreamsFoot: locked(
      'Every one of these was placed by someone who chose to let it shine. None of them carries a name.',
    ),

    historyNote: locked(
      'The public spine. Names appear only where a caretaker chose to be seen.',
    ),

    familyNote: locked(
      'They are known by name and relation. Placing love in a piece is never ownership of it.',
    ),
    /* §6 "The passing, the household, the collaborator, the heir", verbatim:
       "Being on it promises nothing and most people on it will never carry
       the piece." Sits on the room-list screen (rooms.tsx), the household's
       own room — not the yearly-ritual screen (walk.tsx's `ritual` family
       keys above), which already has its own head/body/note. */
    familyPromise: locked(
      'Being on it promises nothing and most people on it will never carry the piece.',
    ),
    familyInvite: locked('Invite someone'),
    familyWaiting: locked('Waiting for you'),
    familyShine: locked('Let it shine'),
    familyKeep: locked('Keep it in the record'),

    accountNote: locked('Nothing from setting up is frozen. Change any of it, any day.'),
    accountFoot: locked(
      'Move house and the light moves with you. Your birth details can be changed or removed; they are shown to nobody either way.',
    ),
    accountSignOut: locked('Sign out'),

    gridNote: locked('Every registered piece, at city level. Never an address.'),
    gridFoot: locked(
      'Forty seven lights so far. A light shows the city and nothing finer; where a place is too small to be anonymous it shows the region instead.',
    ),
    gridName: locked('Earth’s Breath · Sonoma County'),
  },

  /* ---------------------------------------------------------------- *
   * The garden. §6 "A question, opened" — STRUCTURE SETTLED, wording pending.
   *
   * OPEN, and Adrian's: the questions themselves, and which of them wait for
   * the birthday. The eight below show the intended shape and nothing more.
   * ---------------------------------------------------------------- */
  garden: {
    title: locked('Add to your piece'),
    note: locked(
      'Nothing here is required, and nothing expires. One now, five next month, the rest across years.',
    ),
    own: locked('Ask it something of your own'),
    ownNote: locked('Write your own question, then answer it'),
    ownField: locked('Your question'),
    ownHint: ph('What do you want the piece to hold?'),
    answerHint: locked('However much or little you want. You can come back to it.'),

    /* Sharing is the default; the button is how you withhold. §6
       DEPRECATED 2026-08-20: this two-option capsule is superseded by the
       three-tier control below (tierShineTitle / tierKeepTitle /
       tierSealTitle), per §6 "Three tiers, and what outlives you". Kept
       exported so nothing currently reading these keys breaks; do not wire
       new screens to them. */
    whereLabel: locked('Where these words go'),
    whereShine: locked('Shows on the page'),
    whereKeep: locked('Kept in the record'),
    whereNote: locked('Shown words carry no name. Either way they stay in the piece.'),

    /* the L1 pair: the share-choice control's own state line, lit vs
       tapped. §6 "A question, opened," verbatim — the same paragraph that
       names this capsule "the control" and "the button is how you
       withhold." Companion to whereNote above; belongs to the (now
       deprecated) two-option capsule, not the Lamp/"What shows"
       registration screen and not the new three-tier control's own
       (non-verbatim) state captions. */
    shareOnLine: locked('This will shine with the piece · words with no name.'),
    shareOffLine: locked('This stays yours alone · nobody sees it but you.'),

    /* the three tiers. §6 "Three tiers, and what outlives you", titles and
       bodies lifted verbatim from collector-primitives.html's drawn tier
       block (~lines 2536-2610), which matches §6's wording exactly. The
       "Keep it with the piece" body must carry "They may choose to let it
       shine one day" per §6's explicit instruction that the clause "must
       appear on the control." */
    tierShineTitle: locked('Let it shine'),
    tierShineBody: locked(
      'Anyone who meets the piece reads it, as words with no name. Once it shines it stays shining, always.',
    ),
    tierKeepTitle: locked('Keep it with the piece'),
    tierKeepBody: locked(
      'It travels with the piece and only whoever holds it can open it. They may choose to let it shine one day.',
    ),
    tierSealTitle: locked('Seal it'),
    tierSealBody: locked(
      'Nobody opens it again. Not the next caretaker, not your family, not ever. The piece still holds it.',
    ),

    /* the heirs' sub-choice, on by default, hidden when the tier is Seal
       it. §6 "The heirs' right", strings as drawn in collector-primitives.html
       (~lines 2553-2610). */
    heirsOnTitle: locked('The ones who come after may share this'),
    heirsOnNote: locked('On, unless you turn it off for this one thing.'),
    heirsOffTitle: locked('This one goes no further than you'),
    heirsOffNote: locked(
      'Off. It stays with the piece, unopened by anyone after you.',
    ),

    /* Adrian's spoken ruling, 2026-08-20 session, on the writer's own access
       to what they sealed or kept: no verbatim §6 line exists for this, so
       the on-screen line is crafted in §6's diction from his words rather
       than quoted. FLAG FOR ADRIAN'S REVIEW — this exact string has not been
       read back to him. His words: "The writer can always access theirs.
       The writer can always make it go public, but they can never make it
       go private again. Once it's public, it's out there." */
    tierSealWriterNote: locked(
      'You can always open your own. You can let it shine one day. Once it shines, it stays.',
    ),

    place: locked('Place it'),
    finishLater: locked('Finish later'),
    change: locked('Change it'),
    seeAll: locked('See all of them'),
    askOwn: locked('Ask your own'),
    writeIt: locked('Write it'),
    asks: locked('Earth’s Breath asks'),

    stateAnswered: locked('answered'),
    stateShining: locked('answered · shining'),
    stateWaiting: locked('waiting'),
    stateNotYet: locked('not yet'),

    lock: locked(
      'Once placed it settles until your birthday, when it opens to be amended, added to, or left as it is. The exact mechanic is still being decided.',
    ),

    questions: [
      ph('Why you brought it home'),
      ph('Where it hangs'),
      ph('What you were living through'),
      ph('Who holds it after you'),
      ph('A day in this house'),
      ph('What you would tell them'),
      ph('What it has seen'),
      ph('What you hope it outlives'),
    ],
    frames: [
      ph('The person you have in mind, and why them rather than anyone else.'),
      ph(
        'A little guidance on how to answer it: what it is reaching for, and permission to answer it badly. Nothing here is required and nothing expires.',
      ),
    ],
  },

  /* ---------------------------------------------------------------- *
   * The year turns. §6 — one occasion, each person at their own birthday.
   * ---------------------------------------------------------------- */
  ritual: {
    head: locked('The year turns'),
    /* text unchanged; Adrian has not ruled on it, so it moves to ph() rather
       than staying marked as settled. §5 "The yearly ritual" gives only the
       eyebrow/headline/body sketch, not this full paragraph — placeholder. */
    body: ph(
      'Near your birthday the piece asks once. What it holds for the year ahead is yours to place now, and it will be read by everyone who meets the piece until the next time it asks.',
    ),
    note: locked(
      'What you write here shows with the piece. There is no switch for it: placing it is the choosing. Your name is not shown unless you have opened it.',
    ),
    field: locked('the one thing it holds this year'),
    keep: locked('Keep last year’s'),

    /* the ritual's three choices, plus the decline. §5 "The yearly ritual",
       verbatim: "Reinforce the dream it holds · Plant a new dream · Mark it
       fulfilled" and "Secondary: Not this year". */
    reinforce: locked('Reinforce the dream it holds'),
    plantNew: locked('Plant a new dream'),
    markFulfilled: locked('Mark it fulfilled'),
    notThisYear: locked('Not this year'),

    familyHead: locked('The people you love'),
    /* Adrian chose Option A, proposals doc 2026-08-12 "The household" — 2026-08-20 */
    familyBody: locked(
      'Everyone you have invited is asked at their own birthday, and each places one thing for the year. What they write passes through you once, for typos, never for permission.',
    ),
    /* Option A, same doc/date */
    familyNote: locked(
      'Nothing not passed this year is lost, only waiting. A child’s words never carry a name.',
    ),
  },

  /* ---------------------------------------------------------------- *
   * The passing. §6 STRUCTURE BUILT — none of this copy is locked.
   * ---------------------------------------------------------------- */
  passing: {
    forkHead: locked('Passing it on'),
    /* Adrian chose Option A, proposals doc 2026-08-12 "The passing" — 2026-08-20 */
    forkBody: locked('A piece moves in one of two ways, and they are not the same act.'),
    forkLove: locked('To someone you love'),
    /* Option A, same doc/date */
    forkLoveNote: locked('already on the piece; it stays inside the house'),
    forkSell: locked('To someone buying it'),
    /* Option A, same doc/date */
    forkSellNote: locked(
      'a stranger receives it, and what travels is stated now, not decided later',
    ),

    nameHead: locked('It stays in the house'),
    nameBody: locked(
      'They already place their love in this piece, so nothing about it is new to them. What changes is that it becomes theirs to carry.',
    ),
    nameNote: locked(
      'The order is yours and it is private. Nobody on this list is told where they stand, or that they were moved.',
    ),

    sellHead: locked('What travels with it'),
    sellBody: locked(
      'Everything you let shine stays shining, always. What you kept private travels with the piece, and only whoever holds it can open it.',
    ),
    sellNote: locked(
      'Anything you sealed stays sealed, from them and from everyone after them. If there is something you meant to let shine first, the garden is still open.',
    ),
    sellBack: locked('Back to the garden'),

    valueHead: locked('What it was worth'),
    valueBody: locked(
      'The piece keeps its own record of what it has been worth. Anyone can see it has changed hands; only whoever holds it sees these numbers.',
    ),
    valueField: locked('what it was valued at'),
    valueNote: locked('This is what you declare. Nobody confirms it, and the record says so.'),
    valuePaid: locked('Paid'),
    valuePaidNote: locked('the whole of it in money'),
    valuePart: locked('Part trade, part paid'),
    valuePartNote: locked('both, and the value is the two together'),
    valueTrade: locked('Traded'),
    valueTradeNote: locked('another work, or something else entirely'),
    valueGiven: locked('Given'),
    valueGivenNote: locked('no money moved, and it still has a value'),

    readyHead: locked('Let it go'),
    readyBody: locked(
      'When they accept, your hold ends and theirs begins. Everything you placed in it stays with the piece forever, as its story.',
    ),
    readyField: locked('their email'),
    readyNote: locked(
      'They receive an invitation carrying the proof. Until they accept, nothing has moved and you can stop this at any point.',
    ),

    doneHead: locked('It is waiting for them'),
    doneBody: locked(
      'The piece has written to them. When they accept it, you will be told, and this page will no longer be yours.',
    ),

    /* the receiving side of a release. No locked line exists for it. */
    acceptHead: ph('Earth’s Breath is being passed to you'),
    acceptBody: ph(
      'Its caretaker since 2026 is releasing it. Everything placed in it comes with it: the dream it holds, what was written into it, and the names of everyone who loved it before you.',
    ),
    acceptNote: ph(
      'Accepting makes you its caretaker and adds your name to the history. What you place in it from today is yours.',
    ),
    acceptPill: ph('Accept it'),
    acceptNot: ph('This is not for me'),
  },

  /* ---------------------------------------------------------------- *
   * Asking someone on, and arriving by letter. §6, structure only.
   * ---------------------------------------------------------------- */
  people: {
    inviteHead: locked('Ask them onto the piece'),
    inviteBody: locked(
      'They will be able to place their love in it, and nothing else. No code, no transfer, no inheritance.',
    ),
    inviteNote: locked(
      'They receive a letter from the piece rather than from an app. What they place passes through you once before it shines, for typos and judgement, never for permission.',
    ),
    inviteSend: locked('Send it'),
    inviteName: locked('their name'),
    inviteRelation: locked('what they are to you'),
    inviteEmail: locked('their email'),

    sentHead: locked('The piece has written to them'),
    sentBody: locked('When they answer, they appear on the piece and you will be told.'),

    personBody: locked('Wife. On the piece since 2024, and two of her things are shining.'),
    personApprove: locked('Approve what is waiting'),
    personApproveNote: locked('one thing she wrote, not yet shining'),
    personStands: locked('Where she stands'),
    personStandsNote: locked('first in line · private to you, and she is not told'),
    personRemove: locked('Take her off the piece'),
    personRemoveNote: locked('her access ends, and her words stop shining'),
    personNote: locked(
      'Removing someone takes them out of the line as well. Anything of hers that already shines stays shining, because it always does, and her name is on it. She keeps her own copy of what she wrote; it simply leaves the piece.',
    ),

    joinLetterHead: locked('A piece has asked for you'),
    joinLetterBody: locked(
      'Sara holds Earth’s Breath, and she has asked you to place your love in it. The piece is hers to carry; what you put in it is yours.',
    ),
    joinLetterOpen: locked('Open it'),
    joinLetterNot: locked('Not mine'),

    joinHelloHead: locked('You have been added to a piece'),
    joinHelloBody: locked(
      'Sara has placed Earth’s Breath in your hands to write into. The piece is hers to carry; what you put in it is yours.',
    ),
    joinHelloNote: locked(
      'You are not registering it and you are not receiving it. You are being asked to add your love to something she holds.',
    ),

    joinWhoHead: locked('Who you are'),
    joinWhoBody: locked(
      'Your name, so the piece knows whose words these are. Your birthday, so it asks you at your own moment rather than hers.',
    ),
    joinWhoNote: locked(
      'This is the whole of it. Where the art lives, what shows, and the record itself belong to whoever carries the piece.',
    ),
    joinWhoPill: locked('Place me on it'),
    joinWhoName: locked('your name'),
    joinWhoBorn: locked('born'),
  },

  /* ---------------------------------------------------------------- *
   * The heir. §6 "Three tiers, and what outlives you"
   * ---------------------------------------------------------------- */
  heir: {
    letterHead: locked('Earth’s Breath has come to you'),
    letterBody: locked(
      'It was his, and he set it to come to you. Nothing has moved yet: it waits for you to take it up.',
    ),
    letterPill: locked('Take it up'),

    acceptHead: locked('It is yours to carry'),
    acceptBody: locked(
      'From today the piece answers to you. Everything he placed in it stays with it, as its story, and what he kept is now yours to open.',
    ),

    keptHead: locked('What he kept'),
    keptBody: locked(
      'Earth’s Breath is yours to carry now. He wrote things into it that nobody has read, and they are yours to open.',
    ),
    /* character-diffed 2026-08-20 against collector-primitives.html's
       `inherit.note` (~line 2383) — identical, no change. */
    keptNote: locked(
      'You can let any of it shine, and once it shines it stays shining. What he sealed is sealed, and you will not see it: that was his to decide, and he did.',
    ),
    keptPill: locked('Open what he left'),
    keptNot: locked('Not yet'),

    readHead: locked('In his own words'),
    readBody: locked('Three things he kept with the piece. Nobody but you has read them.'),
    readNote: locked(
      'Each of these can be left as it is, or let shine so anyone who meets the piece reads it. Neither is owed.',
    ),
  },

  /* ---------------------------------------------------------------- *
   * Returning. §5, LOCKED
   * ---------------------------------------------------------------- */
  returning: {
    welcomeHead: locked('Welcome back'),
    welcomeBody: locked(
      'Sign in and every piece you caretake opens to you. No code needed; the code sleeps until a passing.',
    ),
    welcomePill: locked('Sign in'),
    welcomeForgot: locked('I forgot my password'),
    welcomeGoogle: locked('Continue with Google'),
    or: locked('or'),

    forgotHead: locked('A way back in'),
    forgotBody: locked(
      'Enter your email and we will send you a way back in. The reset link arrives by email; the record and the piece are untouched.',
    ),
    forgotPill: locked('Send it'),
    forgotBack: locked('Back to sign in'),
  },

  /* ---------------------------------------------------------------- *
   * A letter from the piece. §5 — wording to be worked when letters are.
   * ---------------------------------------------------------------- */
  letter: {
    from: ph('A letter from Earth’s Breath'),
    lead: ph('The house has been quiet since April.'),
    p1: ph(
      'You told it why you brought it home, and it has held that since. It has been watching the light move across the wall and the room fill and empty.',
    ),
    p2: ph(
      'There are others in this house whose love is already in it, whether or not they have said so. If any of them would like to place something, the door is open. Nothing is owed, and nothing waits on it.',
    ),
    p3: ph('It will write again when there is something worth saying.'),
    sign: ph('Sent from the house, not from anyone.'),
    later: ph('Later'),
    openPage: ph('Open its page'),

    emailFrom: ph('An email from Earth’s Breath'),
    emailHead: ph('Ines placed something in Earth’s Breath'),
    emailWho: ph('Your daughter · this morning'),
    emailBody: ph(
      'It is in the record already, and it will stay there. Read it once and decide whether it shines on the piece’s page, as words with no name.',
    ),
    emailWords: ph('Her words'),
    emailQuote: ph(
      '“The first thing I noticed was how the grain moves when you walk past it. I have watched my father stop in front of it a hundred times.”',
    ),
    emailFoot: ph(
      'Nothing happens if you leave this. The words are hers and they are safe in the record either way.',
    ),
  },
} as const;

/* The dev-only placeholder marker registers each ph() string as it is built.
   Referencing COPY here forces that evaluation before any screen renders. */
void COPY;
