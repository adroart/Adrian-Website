/**
 * The Successor's Handbook, rendered as one self-contained HTML file.
 *
 * The source of truth is docs/registry-custodian-guide.md, the plain-language
 * custodian guide. Cloudflare Pages Functions cannot read the docs/ folder at
 * runtime, so the markdown is embedded here as the generated HANDBOOK_SOURCE
 * constant between the markers below.
 *
 * REGENERATION: after editing docs/registry-custodian-guide.md, run
 *
 *   node scripts/generate-successor-handbook.mjs
 *
 * which re-splices the markdown into this file. A unit test
 * (tests/successor-handbook.test.ts) fails if the two drift apart.
 *
 * The renderer converts only the markdown subset the guide uses (headings,
 * paragraphs, lists, bold, code spans, fenced code blocks), with no external
 * markdown library, into a quiet, print-friendly page in the same typographic
 * register as the piece records (functions/api/_lib/pieceRecord.js): inline
 * CSS, system serif, no external requests of any kind, readable with
 * JavaScript disabled. Deterministic: identical source produces identical
 * bytes.
 */

export const SUCCESSOR_HANDBOOK_FILENAME = 'successors-handbook.html';

/* HANDBOOK_SOURCE_START generated from docs/registry-custodian-guide.md, do not edit by hand */
export const HANDBOOK_SOURCE = "# The Successor's Handbook\n\nA plain guide for the person who carries Adrian Rasmussen's artwork registry\nafter him. You do not need to be technical to use most of it. Read it once,\nslowly, then keep it with the files it describes. Where it asks for help from\na technical person, one afternoon of ordinary web work is enough.\n\n## What this is\n\n**The registry.** The registry is the permanent record of Adrian Rasmussen's\nartworks. Every registered piece has one public code, printed on the piece and\nin its files, that looks like `AR-XXXXXXXX`. That code names the piece forever.\nThe registry remembers what each piece is, who has kept it, and everything that\nhas happened to it, in order, with nothing erased.\n\n**A piece record.** A piece record is one complete web page for one piece. It\nlives in the `records/` folder, one file per public code. Each file opens in\nany web browser, on any computer, with no internet connection, and carries its\nown proof: instructions printed inside the page let anyone check that the\nrecord has not been altered since the day it was written. These files are made\nto outlive the website.\n\n**The ledger.** The ledger is one file, `registry-ledger.jsonl`, that lists\nevery registry event as one line, and each line is chained to the one before\nit. If anyone changes or removes a line, the chain breaks and a simple check\nsays so. The ledger contains no secrets. It is safe to show, to copy, and to\nkeep in Google Drive.\n\n**The encrypted archive.** The archive is one file,\n`registry-private-recovery.json`, that holds the complete private registry:\nevery piece, every keeper association, every private note, and the sealed\nOwnership Code envelopes. It is encrypted. Without the passkey it is a locked\nbox that reveals nothing, so it is safe to store as a file. With the passkey,\nit can rebuild the entire registry from nothing.\n\n**How they fit.** The records are for reading. The ledger is for checking.\nThe archive is for rebuilding. The passkey opens the archive. Hold all of\nthem, in the way the next section describes, and the registry cannot be lost.\n\n## The two levels of custody\n\n### Level one, hold it\n\nThis level asks almost nothing of you, and it alone preserves everything.\n\nKeep one folder, safe and copied, containing:\n\n- `records/` , the piece record pages, one per piece\n- `media/` , the photographs and files the records refer to\n- `registry-ledger.jsonl` , the chained ledger\n- `registry-private-recovery.json` , the encrypted archive\n- `successors-handbook.html` , this guide, readable in any browser\n\nAnd keep one passkey, described in the next section, stored somewhere else.\n\nThat is the whole duty. The folder plus the passkey preserve every piece,\nevery record, and every code, forever, offline, at no cost. Keep the folder in\nat least two places, for example one copy at home and one in the Google Drive\nmirror or on a second drive. When Adrian, or whoever runs the system, hands\nyou a newer folder, keep the newer one and do not throw away the older one\nuntil the newer one is safely copied.\n\n### Level two, run it\n\nThis level keeps the website and registry alive on the internet. It is\noptional. If it ever becomes too much, fall back to level one and nothing of\nsubstance is lost.\n\nThe accounts that matter:\n\n- **Cloudflare.** One account runs the website (Pages), the registry database\n  (D1), and the private file storage (R2). At this scale the Pages hosting is\n  on the free tier and the database and storage cost cents per month.\n- **The domain registrar.** The account where `adrianrasmussen.com` is\n  registered. The yearly domain renewal, usually ten to twenty dollars, is the\n  main recurring cost of the whole system. If the domain lapses, the printed\n  QR codes stop resolving, so this renewal is the one bill that matters.\n- **Google Drive.** The account holding the mirror folder. The website writes\n  the ledger and the records archive there automatically. The mirror is a\n  public-safe copy, not the private archive. It fits easily in free storage.\n- **The email provider.** The account behind the administrator sign-in email.\n  Losing it makes signing in to the admin pages harder, so keep it renewed\n  and recoverable.\n\nThe routine duties, honestly stated:\n\n- Keep the domain renewed. Turn on auto-renewal if the registrar offers it.\n- Glance at the Google Drive mirror now and then, and confirm the ledger and\n  records files are still updating.\n- A few times a year, and after any new registration, sign in to the admin\n  pages, download a fresh encrypted archive and a fresh ledger, and refresh\n  the held folder from level one.\n\nThat is all. The system was built so that running it costs little money and\nless attention.\n\n## The passkey\n\nThe passkey is one passphrase. It opens one small file, the custody envelope,\nwhich holds the internal keys the archive needs. One passphrase, one envelope\nfile, and the folder above: that is everything a museum or a family member\nneeds to take the registry on.\n\nThe passphrase is a generated phrase of random words, the kind drawn by dice\nfrom a word list. It is written by hand on paper, twice, and each paper copy\nis sealed.\n\nWhere the passkey is kept, filled in by hand by Adrian:\n\n- Written and sealed at: ______________________________________\n- A second sealed copy at: ____________________________________\n\nThe envelope file itself, named like `custody-envelope.json`, is kept with the\narchive folder or alongside it.\n\nThe one absolute rule: **the passkey and the files must never be stored in\nthe same place.** Not in the same drawer, not in the same account, not in the\nsame cloud service. Whoever holds both at once holds the entire registry, so\nthey travel separately and rest separately, always.\n\n## How to restore everything from nothing\n\nSuppose every account is gone and only the held folder, the envelope, and the\npasskey remain. This is the path back. A technical helper can follow it in an\nafternoon using this project's code from its repository, or a packaged copy of\nit, on any ordinary computer with Node.js installed.\n\nFirst, prove the files are intact:\n\n```\nnpm run ledger -- verify registry-ledger.jsonl\n```\n\nThis checks the chained ledger and reports that the chain is whole. If you\nhold an older and a newer ledger, compare them:\n\n```\nnpm run ledger -- diff older-ledger.jsonl newer-ledger.jsonl\n```\n\nAdded lines on the newer file are normal growth. Removed or changed lines mean\nsomething was altered, so stop and investigate before going further.\n\nSecond, prove the passkey opens the envelope, without exposing anything:\n\n```\nnpx tsx scripts/custody-envelope.ts open --check custody-envelope.json\n```\n\nIt asks for the passphrase and reports only which keys the envelope holds,\nnever their values.\n\nThird, when actually restoring, let the envelope write the recovery key file,\na small two line file the restore tool reads:\n\n```\nnpx tsx scripts/custody-envelope.ts open --recovery-key-file registry-recovery.key custody-envelope.json\n```\n\nFourth, turn the encrypted archive into a database restore file:\n\n```\nnpm run ledger -- restore-sql registry-private-recovery.json registry-recovery.key restore.sql\n```\n\nThe tool authenticates the archive, refuses anything damaged or incomplete,\nand writes `restore.sql`. That file contains the decrypted registry, so treat\nit as private, use it promptly, and delete it when done.\n\nFifth, rebuild the online home. A fresh Cloudflare account needs what the\nproject's `wrangler.toml` names: a Pages project built from this repository, a\nD1 database bound as `DB` with every migration in `migrations/` applied in\norder, and two R2 buckets bound as `ARTWORK_REGISTRY_BACKUP` and\n`MUSIC_BUCKET`. Apply `restore.sql` to the new, empty, fully migrated\ndatabase, never to one that already has registry rows in it; the restore\nrefuses a non-empty target on purpose. Copy the held `media/` files back into\nthe private bucket. Then set the secrets the admin endpoints ask for, point\nthe domain at the new Pages project, and scan one piece's QR code to confirm\nit resolves.\n\nThe order matters: verify the ledger, open the envelope, write the key file,\ngenerate the restore, migrate the empty database, restore, then reconnect the\ndomain. Delete the key file and `restore.sql` when the restore is confirmed.\n\n**The test drill.** Once a year, or whenever custody changes hands, walk steps\none through four with the real held files and a scratch database that is\nthrown away afterward. Never aim a restore at the live system. A drill that\nends with a working scratch copy is proof the succession works. A drill that\nfails is the best possible time to find out.\n\n## How to reveal an Ownership Code for a collector who lost theirs\n\nEach piece's keeper holds a private Ownership Code. If a keeper loses theirs,\nthe administrator can reveal it:\n\n1. Sign in to the website with the administrator account.\n2. Open the admin pieces page and complete the registry unlock, the short\n   extra confirmation the sensitive pages require.\n3. Find the piece by its public code and choose **Reveal Ownership Code**.\n4. Read the code to the keeper privately, or hand it over in person. Confirm\n   you are speaking with the verified keeper first.\n\nThe revealed code appears on screen only. Every reveal is recorded in the\nregistry's audit history. This is normal creator access, not an emergency\nmeasure, but it is private: never send an Ownership Code over a public\nchannel or write it where others can read it.\n\n## What must never be done\n\n- **Never publish the private archive.** `registry-private-recovery.json` is\n  safe only while it stays private. Do not post it, share it, or place it in\n  the public Drive mirror.\n- **Never put the passkey online.** Not in email, not in notes apps, not in a\n  password manager that syncs, not in a photo. Paper, sealed, in the named\n  places.\n- **Never delete retired key versions.** Old archives stay readable only\n  while the keys that sealed them survive. Keep every key version the\n  envelope holds, forever.\n- **Never edit the ledger by hand.** The ledger proves itself by its chain.\n  An edited ledger is a broken ledger. If something is wrong, record a\n  correction through the system; do not rewrite history.\n\n## Whom to contact\n\nFilled in by hand by Adrian, and kept current:\n\n- Family contact for the registry: ______________________________\n- Technical helper who knows this system: _______________________\n- Where the code repository lives: ______________________________\n- Registrar and Cloudflare account recovery notes are kept at: ___\n- Anything else the next custodian should know: _________________\n\nIf every contact fails, this handbook, the held folder, and the passkey are\nstill enough. That is what they were made for.\n";
/* HANDBOOK_SOURCE_END */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inline markdown on already-escaped text: `code` spans, then **bold**. */
function inlineHtml(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/**
 * Convert the handbook's markdown subset to HTML body markup.
 * Supported: #/##/### headings, paragraphs, unordered (-) and ordered (1.)
 * lists with wrapped continuation lines, fenced code blocks, bold, code
 * spans. Nothing else appears in the guide.
 */
export function renderHandbookMarkdown(source) {
  const lines = String(source).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listTag = null;
  let item = null;
  let fence = null;

  const flushItem = () => {
    if (item !== null) {
      html.push(`<li>${inlineHtml(item.join(' '))}</li>`);
      item = null;
    }
  };
  const closeList = () => {
    flushItem();
    if (listTag) {
      html.push(`</${listTag}>`);
      listTag = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (fence !== null) {
      if (/^```/.test(line.trim())) {
        html.push(`<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`);
        fence = null;
      } else {
        fence.push(line);
      }
      continue;
    }
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      flushParagraph();
      closeList();
      fence = [];
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineHtml(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^-\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      flushItem();
      if (listTag !== 'ul') {
        closeList();
        listTag = 'ul';
        html.push('<ul>');
      }
      item = [bullet[1]];
      continue;
    }
    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      flushItem();
      if (listTag !== 'ol') {
        closeList();
        listTag = 'ol';
        html.push('<ol>');
      }
      item = [numbered[1]];
      continue;
    }
    if (item !== null) {
      item.push(trimmed);
      continue;
    }
    paragraph.push(trimmed);
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

const HANDBOOK_CSS = `
  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #f7f4ee; color: #2b2620;
    font-family: Georgia, 'Times New Roman', Times, serif;
    line-height: 1.65; padding: 3rem 1.5rem;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-weight: normal; font-size: 1.8rem; margin-bottom: 1rem; }
  h2 { font-weight: normal; font-size: 1.35rem; margin: 2.2rem 0 0.7rem; }
  h3 { font-weight: normal; font-size: 1.1rem; font-style: italic; margin: 1.6rem 0 0.5rem; }
  p { margin: 0.8rem 0; }
  ul, ol { margin: 0.8rem 0 0.8rem 1.4rem; }
  li { margin: 0.45rem 0; }
  strong { font-weight: bold; }
  code {
    font-family: 'Courier New', Courier, monospace; font-size: 0.92em;
    background: #efeae0; padding: 0.05rem 0.3rem;
    overflow-wrap: anywhere;
  }
  pre {
    background: #efeae0; padding: 0.8rem 1rem; margin: 0.8rem 0;
    overflow-x: auto;
  }
  pre code { background: none; padding: 0; }
  @media print {
    body { background: #ffffff; color: #000000; padding: 0; }
    pre, code { background: #f2f2f2; }
    h2 { page-break-after: avoid; }
    pre { page-break-inside: avoid; }
  }
`;

/**
 * Render the complete self-contained handbook page from the embedded source.
 * No external stylesheets, fonts, scripts, images, or links of any kind.
 */
export function renderSuccessorHandbookHtml(source = HANDBOOK_SOURCE) {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>The Successor's Handbook · Adrian Rasmussen</title>",
    `<style>${HANDBOOK_CSS}</style>`,
    '</head>',
    '<body>',
    '<main>',
    renderHandbookMarkdown(source),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
