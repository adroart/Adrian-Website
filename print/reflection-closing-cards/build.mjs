import fs from 'node:fs';
const qr = JSON.parse(fs.readFileSync('print/reflection-closing-cards/qr.json', 'utf8'));
const CLD = 'https://res.cloudinary.com/dobbosnda/image/upload';
const ORACLE_FRONT = `${CLD}/w_1600,q_auto:best,f_jpg/adrian-website/creations/universal-language/fountain-of-light-46`;
// SWAP SLOT: replace with the illuminated photo (portrait, at least 1200x1700 px)
const ART_FRONT = `${CLD}/w_1400,q_auto:best,f_jpg/DSC04374_vviyyc`;
const WATERMARK = `${CLD}/w_1200,e_grayscale,o_9,f_jpg/adrian-website/creations/universal-language/fountain-of-light-46`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Reflection deck, two closing cards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=Karla:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    /* Card: 3.5 x 5 in. Change these two lines if the deck is another size. */
    --card-w: 3.5in; --card-h: 5in; --bleed: 0.125in; --safe: 0.25in;
    --paper:#f5f4f0; --ink:#262321; --wood:#736046; --bronze:#ab9266; --bronze-line:#d5c1a0; --stone:#6f6a62;
    --font-display:'Cormorant Garamond',Georgia,serif; --font-body:'Lora',Georgia,serif; --font-label:'Karla',Helvetica,Arial,sans-serif;
  }
  *{box-sizing:border-box}
  body{margin:0;background:#2b2926;color:var(--ink);font-family:var(--font-body)}
  .sheet{display:flex;flex-wrap:wrap;gap:24px;padding:32px;justify-content:center}
  .face{position:relative;width:calc(var(--card-w) + 2*var(--bleed));height:calc(var(--card-h) + 2*var(--bleed));background:var(--paper);overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,.45)}
  .face .trim{position:absolute;inset:var(--bleed);outline:1px dashed rgba(171,146,102,.55);pointer-events:none}
  .face .label{position:absolute;left:0;right:0;bottom:-22px;text-align:center;font:11px/1 var(--font-label);letter-spacing:.14em;text-transform:uppercase;color:#c2beb8}
  .inner{position:absolute;inset:calc(var(--bleed) + var(--safe));display:flex;flex-direction:column;align-items:center;text-align:center}
  .wm{position:absolute;inset:0;background:url("${WATERMARK}") center/cover no-repeat;pointer-events:none}
  .wm::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(245,244,240,.35),rgba(245,244,240,.85) 30%,rgba(245,244,240,.85) 70%,rgba(245,244,240,.35))}
  h1{font:500 22pt/1.1 var(--font-display);margin:0;letter-spacing:.005em;color:var(--ink)}
  p{margin:0;font:400 9.5pt/1.45 var(--font-body);color:var(--ink)}
  p.soft{color:var(--wood)}
  .rule{width:34px;height:1px;background:var(--bronze);margin:9pt auto}
  .qr{width:1.35in;height:1.35in;display:block;margin:0 auto}
  .qr svg{width:100%;height:100%;display:block}
  .url{font:600 14pt/1.15 var(--font-display);letter-spacing:.01em;color:var(--ink);margin-top:5pt}
  .url small{display:block;font:400 8pt/1.3 var(--font-label);letter-spacing:.16em;text-transform:uppercase;color:var(--stone);margin-top:3pt}
  .eyebrow{font:500 7.5pt/1 var(--font-label);letter-spacing:.2em;text-transform:uppercase;color:var(--stone)}
  .grow{flex:1}

  /* Front, card 1: square oracle-card template inside the portrait card */
  .oracle-front .inner{justify-content:center;gap:9pt}
  .square{width:100%;aspect-ratio:1/1;position:relative;background:#1f1d1a;box-shadow:0 2px 12px rgba(0,0,0,.25)}
  .square img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
  .square .tpl{position:absolute;inset:0;outline:1px solid rgba(213,193,160,.65);outline-offset:-0.09in;pointer-events:none}
  .caption{font:italic 400 9.5pt/1.3 var(--font-display);color:var(--wood)}

  /* Front, card 2: full-bleed artwork */
  .art-front img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}

  @page{size:calc(var(--card-w) + 2*var(--bleed)) calc(var(--card-h) + 2*var(--bleed));margin:0}
  @media print{
    body{background:#fff}
    .sheet{display:block;padding:0}
    .face{box-shadow:none;page-break-after:always;margin:0}
    .face .trim,.face .label{display:none}
  }
</style></head>
<body>
<div class="sheet">

  <!-- ─── Card 1, front: a square oracle card, as the deck will print it ─── -->
  <div class="face oracle-front">
    <div class="inner">
      <div class="square"><img src="${ORACLE_FRONT}" alt=""><div class="tpl"></div></div>
      <div class="caption">Fountain of Light · 46</div>
    </div>
    <div class="trim"></div><div class="label">Card 1 · front · square oracle template</div>
  </div>

  <!-- ─── Card 1, back: the invitation to Mandala Codes ─── -->
  <div class="face">
    <div class="wm"></div>
    <div class="inner">
      <div class="grow"></div>
      <h1>There are 64 more.</h1>
      <div class="rule"></div>
      <p>These cards come from a deck of 64 mandalas, a comprehensive oracle drawing the old systems and the new into one.</p>
      <div class="grow"></div>
      <div class="qr">${qr.oracle}</div>
      <div class="grow"></div>
      <p class="soft">Ask a question. Turn a card.<br>Read what it holds.</p>
      <div class="url">mandalacodes.com<small>Free · no account needed</small></div>
      <div class="grow"></div>
    </div>
    <div class="trim"></div><div class="label">Card 1 · back</div>
  </div>

  <!-- ─── Card 2, front: full-bleed art piece (swap for the illuminated photo) ─── -->
  <div class="face art-front">
    <img src="${ART_FRONT}" alt="">
    <div class="trim"></div><div class="label">Card 2 · front · placeholder, swap for illuminated piece</div>
  </div>

  <!-- ─── Card 2, back: the artist, first person ─── -->
  <div class="face">
    <div class="wm"></div>
    <div class="inner">
      <div class="grow"></div>
      <h1>I made these.</h1>
      <div class="rule"></div>
      <p>Mandalas, laser-cut wooden sculptures, illuminated pieces for homes and retreat spaces.</p>
      <div class="grow"></div>
      <div class="qr">${qr.site}</div>
      <div class="grow"></div>
      <p class="soft">The work, and the writing behind it.</p>
      <div class="url">adrianrasmussen.com<small>IG · technicianofthesacred</small></div>
      <div class="grow"></div>
    </div>
    <div class="trim"></div><div class="label">Card 2 · back</div>
  </div>

</div>
</body></html>`;
fs.writeFileSync('print/reflection-closing-cards/reflection-closing-cards.html', html);
console.log('wrote', html.length, 'bytes');
