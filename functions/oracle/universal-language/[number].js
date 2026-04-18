/**
 * Cloudflare Pages Function — /oracle/universal-language/[number]
 *
 * Rewrites Open Graph meta tags in index.html before serving so that
 * social platforms (WhatsApp, Telegram, X, iMessage, etc.) display the
 * correct card image and title as a link preview thumbnail.
 *
 * HTMLRewriter runs at the edge — zero latency overhead for real users,
 * and scrapers that don't run JS get the correct tags immediately.
 */

const CLOUDINARY = 'https://res.cloudinary.com/dobbosnda/image/upload';
const OG_CROP    = 'f_auto,q_auto,w_1200,h_1200,c_fill,g_center';
const SITE_URL   = 'https://www.adrianrasmussen.com';

/* ─── Card name lookup (1–64) ────────────────────────────────────────────── */

const CARD_NAMES = {
   1: "Earth's Breath",
   2: 'Beyond the Shell',
   3: 'Messengers of the Infinite',
   4: 'Veils of Knowledge',
   5: 'The Space Between Time',
   6: 'Harmonious Mirage',
   7: 'Essential Nexus',
   8: 'Odyssey of Freedom',
   9: 'Ease in This',
  10: 'Internal Treasure',
  11: 'Sol Star',
  12: 'Petals of Freedom',
  13: 'Universal Crest',
  14: 'Ancestors Bloom',
  15: 'Ordinary Valiance',
  16: 'Grand Rising',
  17: 'Peral of Christos',
  18: 'Liberation of the Greater',
  19: 'Solection',
  20: 'Emerging as the Code',
  21: 'Beyond Binary',
  22: 'Treasure of the Way',
  23: 'Beneath the Surface',
  24: 'Frequency Flutter',
  25: 'The Mysteries Play',
  26: 'Lighter Than a Feather',
  27: 'Inner Majesty',
  28: 'Becoming the Mystery',
  29: 'All In',
  30: 'Sparking the Blaze',
  31: 'Theater of Truth',
  32: 'Art of Living',
  33: 'Echos of Time',
  34: 'Sublime Power',
  35: 'Navigational Star',
  36: 'Crystal Creation',
  37: 'Journey Home',
  38: 'Inner Light Symphony',
  39: 'Nobel Spark',
  40: 'Eternal Wellspring',
  41: 'Beginning and the End',
  42: 'Moving to Perfection',
  43: 'Cipher of Knowledge',
  44: "Sophia's Orchestra",
  45: 'Tribal Tapestry',
  46: 'Fountain of Light',
  47: 'Garden of Alchemy',
  48: 'Doorways of the Unknown',
  49: 'Union in the Ashes',
  50: 'Melt Into Perfection',
  51: 'Unshakable Arrival',
  52: 'Timeless Blossom',
  53: 'Creation Oscillation',
  54: 'Everlasting Bounty',
  55: 'Untouched Perfection',
  56: 'Infinite Journey',
  57: 'Flight of the Tao',
  58: 'Rhythm of Life',
  59: 'Mystics Treasures',
  60: 'Woven Light',
  61: 'Celestial Remembrance',
  62: 'Voice of Nature',
  63: 'Adornments of Time',
  64: 'Communion',
};

/* ─── Cloudinary public ID lookup (1–64) ─────────────────────────────────── */

const CARD_IMAGES = {
   1: '1_o8tafh',
   2: '2_kvndyq',
   3: '3_b8iscb',
   4: '4_qesce2',
   5: '5_egctcj',
   6: '6_w1otd0',
   7: '7_bzq8ct',
   8: '8_nff0od',
   9: '9_tjug04',
  10: '10_ozcqlz',
  11: '11_rtesiu',
  12: '12_xjjkon',
  13: '13_citdc4',
  14: '14_l5ufs8',
  15: '15_vozkvv',
  16: '16_dvhi86',
  17: '17_ntlh1k',
  18: '18_kznsph',
  19: '19_imppfd',
  20: '20_e4a4zp',
  21: '21_vxnf0f',
  22: '22_lldo5g',
  23: '23_kbbbt8',
  24: '24_s6sd3e',
  25: '25_aelw6r',
  26: '26_hoyypz',
  27: '27_fxvwyy',
  28: '28_zr859p',
  29: '29_lhj3ug',
  30: '30_fp8gza',
  31: '31_wiywrb',
  32: '32_x9qxas',
  33: '33_nsf6y8',
  34: '34_n1s8hf',
  35: '35_qdtutl',
  36: '36_k8tlcz',
  37: '37_f4zdoz',
  38: '38_rca4zk',
  39: '39_rnqs4x',
  40: '40_zeqgmt',
  41: '41_qlljho',
  42: '42_jb7xjb',
  43: '43_bhjxku',
  44: '44_p9s6o1',
  45: '45_xjnohi',
  46: '46_hqh9va',
  47: '47_oxq0wy',
  48: '48_ttflpq',
  49: '49_xciocz',
  50: '50_g1vs1y',
  51: '51_pdgusl',
  52: '52_farywa',
  53: '53_hai5ju',
  54: '54_m3cjgp',
  55: '55_olyr5l',
  56: '56_boey2k',
  57: '57_ykvrmw',
  58: '58_hsyihd',
  59: '59_braqjq',
  60: '60_eoiule',
  61: '61_o6dqa5',
  62: '62_rtxmo2',
  63: '63_ns8e6p',
  64: '64_lgyp8t',
};

/* ─── HTMLRewriter handlers ───────────────────────────────────────────────── */

/* ─── Handler ────────────────────────────────────────────────────────────── */

export async function onRequest(context) {
  const { params, env, request } = context;

  const num      = parseInt(params.number, 10);
  const cardName = CARD_NAMES[num];
  const imageId  = CARD_IMAGES[num];

  // Fetch index.html with a clean request — no caller headers that could
  // trigger compression or range responses that break string replacement.
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search   = '';
  const shell = await env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }));
  let html = await shell.text();

  // Unknown card — return shell as-is (React handles the 404 state).
  if (!cardName || !imageId || isNaN(num)) {
    return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
  }

  const title       = `${cardName} · Code ${num} · Universal Language Oracle | Adrian Rasmussen`;
  const description = `Universal Language Oracle card ${num}: ${cardName}. An original airbrushed painting on laser-cut wood by Adrian Rasmussen.`;
  const image       = `${CLOUDINARY}/${OG_CROP}/${imageId}`;

  // Simple string replacement — works regardless of streaming or encoding quirks.
  html = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${title}"`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*"/, `$1${image}"`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*"/, `$1${title}"`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*"/, `$1${description}"`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*"/, `$1${image}"`)
    .replace(/(<meta\s+property="og:image:width"\s+content=")[^"]*"/, `$11200"`)
    .replace(/(<meta\s+property="og:image:height"\s+content=")[^"]*"/, `$11200"`);

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}
