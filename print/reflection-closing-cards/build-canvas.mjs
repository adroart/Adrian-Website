import fs from 'node:fs';
const qr = JSON.parse(fs.readFileSync('print/reflection-closing-cards/qr.json', 'utf8'));
// Recolor QR modules per style: the generator wrote #262321 on transparent.
const qrInk = (svg, ink) => svg.replace(/#262321/g, ink);
const CLD = 'https://res.cloudinary.com/dobbosnda/image/upload';
const ART = `${CLD}/w_1400,q_auto:best,f_jpg/adrian-website/print/reflection-cards/illuminated-piece-front`;
const SOL = `${CLD}/w_1400,q_auto:best,f_jpg/adrian-website/print/reflection-cards/sol-star-11-card-front`;
const SOL_RAW = `${CLD}/w_1400,q_auto:best,f_jpg/adrian-website/creations/universal-language/sol-star-11`;
const ART_BG = `${CLD}/w_900,e_blur:600,e_brightness:-45,q_auto,f_jpg/adrian-website/print/reflection-cards/illuminated-piece-front`;
const SOL_BG = `${CLD}/w_900,e_blur:600,e_brightness:-45,q_auto,f_jpg/adrian-website/creations/universal-language/sol-star-11`;
const SOL_WM = `${CLD}/w_900,e_grayscale,q_auto,f_jpg/adrian-website/creations/universal-language/sol-star-11`;

// Card 3.5 x 5 in, shown at 2x (672 x 960). Bleed not drawn; the frame IS the trim.
const W = 672, H = 960, GAP = 56, LABEL = 44;
const col = (i) => 80 + i * (W + GAP);
const row = (j) => 120 + j * (H + GAP + LABEL);

const copy1 = {
  h: 'There are 64 more.',
  p: 'These cards come from a deck of 64 mandalas, a comprehensive oracle drawing the old systems and the new into one.',
  soft: 'Ask a question. Turn a card.<br>Read what it holds.',
  url: 'mandalacodes.com', sub: 'Free · no account needed',
};
const copy2 = {
  h: 'I made these.',
  p: 'Mandalas, laser-cut wooden sculptures, illuminated pieces for homes and retreat spaces.',
  soft: 'The work, and the writing behind it.',
  url: 'adrianrasmussen.com', sub: 'IG · technicianofthesacred',
};

function back(style, c, code, extraCls = '', bg = '') {
  const qrsvg = style === 'wood' ? qrInk(qr[code], '#262321') : qrInk(qr[code], '#262321');
  return `
  <div class="card ${style} ${extraCls}" ${bg ? `style="background-image:url('${bg}')"` : ''}>
    <div class="scrim"></div>
    <div class="inner">
      <div class="grow"></div>
      <div class="h">${c.h}</div>
      <div class="rule"></div>
      <div class="p">${c.p}</div>
      <div class="grow"></div>
      <div class="qrtile"><div class="qr">${qrsvg}</div></div>
      <div class="grow"></div>
      <div class="p soft">${c.soft}</div>
      <div class="url">${c.url}</div>
      <div class="sub">${c.sub}</div>
      <div class="grow"></div>
    </div>
  </div>`;
}

function frame(x, y, label, body) {
  return `
  <div class="frame" style="left:${x}px;top:${y}px" data-screen-label="${label}">
    <div class="lbl" data-drags-parent="1">${label}</div>
    ${body}
  </div>`;
}

const fronts = `
  ${frame(col(0), row(0), 'Card 1 · front · Sol Star, square card on the portrait blank', `
    <div class="card front1"><div class="sq"><img src="${SOL}" alt=""></div><div class="cap">Sol Star · Eleven</div></div>`)}
  ${frame(col(0), row(1), 'Card 2 · front · illuminated piece, full bleed', `
    <div class="card"><img class="bleed" src="${ART}" alt=""></div>`)}
`;

const styles = [
  ['wood',  'A · Deep wood',  'Dark ground, the card reads as the back of a sculpture'],
  ['parch', 'B · Parchment',  'Warm mid tone with the mandala ghosted behind'],
  ['artc', 'C · Art bleed',  'The artwork continues, softened, behind the words'],
];
let frames = fronts;
styles.forEach(([key, name], i) => {
  const bg1 = key === 'artc' ? SOL_BG : key === 'parch' ? SOL_WM : '';
  const bg2 = key === 'artc' ? ART_BG : key === 'parch' ? SOL_WM : '';
  frames += frame(col(i + 1), row(0), `${name} · card 1 back`, back(key, copy1, 'oracle', '', bg1));
  frames += frame(col(i + 1), row(1), `${name} · card 2 back`, back(key, copy2, 'site', '', bg2));
});

const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="./support.js"></script>
  </head>
  <body>
    <x-dc>
      <helmet data-dc-atomics>
        <meta name="design_doc_mode" content="canvas">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Lora:ital,wght@0,400;0,500;1,400&family=Karla:wght@400;500&display=swap" rel="stylesheet">
        <style>
          a{color:#ab9266}a:hover{color:#736046}
          .frame{position:absolute;width:${W}px}
          .lbl{position:absolute;top:-${LABEL}px;left:0;right:0;font:500 15px/1 Karla,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8a857c;white-space:nowrap;cursor:grab}
          .card{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#262321;background-size:cover;background-position:center;box-shadow:0 10px 40px rgba(0,0,0,.35)}
          .inner{position:absolute;inset:88px 72px;display:flex;flex-direction:column;align-items:center;text-align:center}
          .grow{flex:1}
          .scrim{position:absolute;inset:0;pointer-events:none}
          .h{font:500 50px/1.1 'Cormorant Garamond',Georgia,serif;letter-spacing:.005em}
          .rule{width:68px;height:2px;margin:22px auto}
          .p{font:400 21px/1.5 Lora,Georgia,serif;text-wrap:pretty}
          .qrtile{padding:22px;display:flex}
          .qr{width:230px;height:230px}
          .qr svg{width:100%;height:100%;display:block}
          .url{font:600 32px/1.15 'Cormorant Garamond',Georgia,serif;letter-spacing:.01em;margin-top:14px}
          .sub{font:400 15px/1.3 Karla,Helvetica,sans-serif;letter-spacing:.18em;text-transform:uppercase;margin-top:8px}

          /* fronts */
          .front1{background:#262321}
          .sq{position:absolute;left:52px;right:52px;top:50%;transform:translateY(-56%);aspect-ratio:1/1;box-shadow:0 8px 30px rgba(0,0,0,.5)}
          .sq img{width:100%;height:100%;object-fit:cover;display:block}
          .cap{position:absolute;left:0;right:0;bottom:78px;text-align:center;font:italic 400 24px/1 'Cormorant Garamond',Georgia,serif;color:#d5c1a0}
          .bleed{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}

          /* A · deep wood */
          .wood{background:#262321;color:#ebe8e1}
          .wood .rule{background:#ab9266}
          .wood .p{color:#e0d8cc}
          .wood .soft{color:#c4aa7c}
          .wood .qrtile{background:#f5f4f0;border-radius:4px}
          .wood .url{color:#f5f4f0}
          .wood .sub{color:#ab9266}

          /* B · parchment */
          .parch{background-color:#e6d9c3;color:#262321}
          .parch .scrim{background:linear-gradient(180deg,rgba(230,217,195,.55),rgba(230,217,195,.92) 22%,rgba(230,217,195,.92) 78%,rgba(230,217,195,.55));mix-blend-mode:normal}
          .parch .rule{background:#725d3d}
          .parch .p{color:#3d3226}
          .parch .soft{color:#725d3d}
          .parch .qrtile{background:#f5f4f0;border-radius:4px;box-shadow:0 2px 10px rgba(61,50,38,.18)}
          .parch .url{color:#262321}
          .parch .sub{color:#6f6a62}
          .parch .inner{z-index:1}

          /* C · art bleed */
          .bleedc{}

          .card.artc{color:#f5f4f0}
          .card.artc .scrim{background:radial-gradient(ellipse at 50% 50%,rgba(23,19,16,.72),rgba(23,19,16,.9))}
          .card.artc .inner{z-index:1}
          .card.artc .rule{background:#d5c1a0}
          .card.artc .p{color:#ebe8e1}
          .card.artc .soft{color:#d5c1a0}
          .card.artc .qrtile{background:#f5f4f0;border-radius:4px}
          .card.artc .url{color:#faf6f0}
          .card.artc .sub{color:#c4aa7c}
        </style>
      </helmet>
      ${frames}
    </x-dc>
    <script
      type="text/x-dc"
      data-dc-script
      data-props='{}'
    >
      class Component extends DCLogic {
        renderVals() { return {}; }
      }
    </script>
  </body>
</html>`;
fs.writeFileSync('print/reflection-closing-cards/canvas.dc.html', html);
console.log('bytes', html.length);
