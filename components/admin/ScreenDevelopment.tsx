/**
 * The screen development system: where the collector journey is looked at
 * while it is being built.
 *
 * WHY THIS PAGE EXISTS. The journey lives on its own branch, `screens`, which
 * Cloudflare builds to a fixed address of its own. That address is the review
 * surface: it carries whatever is currently being worked on, and it is
 * deliberately NOT the public site, so an unfinished screen can never reach
 * anyone holding a piece. The trouble with an address like that is that it is
 * invisible. It lives in a branch name and a deployment list, and six weeks
 * later nobody remembers it exists. So it is written down here, in the back
 * end, where Adrian can find it without asking anyone.
 *
 * THE BRANCH IS PERMANENT. `screens` is not a feature branch and must never be
 * swept by a merged-branch cleanup, even when its work has all landed on main.
 * Deleting it deletes the address. It ends when Adrian says it ends, and until
 * then any tool or session tidying branches leaves it alone.
 *
 * TWO WAYS TO LOOK, and the difference matters. `Review` is the phone at the
 * size the design file draws it, floating, with the jump list and the state
 * switches underneath: honest for checking a screen against its artboard, and
 * wrong for judging how the thing feels. `Use` is the journey with the screen
 * to itself, which is what a collector actually gets. Judge the feel in Use;
 * check the drawing in Review.
 */

import React from 'react';

/** the fixed address the `screens` branch builds to */
const SCREENS_ORIGIN = 'https://screens.adrian-website-421.pages.dev';

type Surface = {
  label: string;
  href: string;
  what: string;
  when: string;
};

const SURFACES: Surface[] = [
  {
    label: 'Use it',
    href: `${SCREENS_ORIGIN}/collector?frame=full`,
    what: 'The journey with the screen to itself, exactly as a collector meets it.',
    when: 'Judging how it feels, and how it holds a real window or a real phone.',
  },
  {
    label: 'Review it',
    href: `${SCREENS_ORIGIN}/collector`,
    what: 'The phone at its drawn size, with the jump list and the state switches under it.',
    when: 'Checking a screen against the design file, and reaching a state the happy path never walks.',
  },
];

const ScreenDevelopment: React.FC = () => (
  <div className="admin-page">
    <header className="admin-page-head">
      <p className="admin-eyebrow">Workshop</p>
      <h1>Screen development system</h1>
      <p className="admin-page-lede">
        Where the collector journey is looked at while it is being built. This is a
        separate build from the live site, so nothing here is public and nothing here
        can disturb what collectors see.
      </p>
    </header>

    <div className="admin-section">
      {SURFACES.map(surface => (
        <article key={surface.label} className="admin-card">
          <h2>{surface.label}</h2>
          <p>{surface.what}</p>
          <p className="admin-muted">{surface.when}</p>
          <p>
            <a href={surface.href} target="_blank" rel="noreferrer">
              {surface.href}
            </a>
          </p>
        </article>
      ))}
    </div>

    <div className="admin-section">
      <article className="admin-card">
        <h2>How long it lasts</h2>
        <p>
          This address is permanent. It stays until you decide to end it, and it is not
          swept away when its work reaches the live site. It updates whenever the
          journey is worked on, so it always shows the current state rather than a
          snapshot.
        </p>
        <p className="admin-muted">
          It is built from a branch named <code>screens</code>. Deleting that branch is
          what ends this address, and nothing else does.
        </p>
      </article>
    </div>
  </div>
);

export default ScreenDevelopment;
