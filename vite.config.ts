import path from 'path';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

function mockApiPlugin(): Plugin {
  return {
    name: 'mock-api',
    configureServer(server) {
      server.middlewares.use('/api/inquire', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { name, email, inquiryType, vision, commissionType } = data;
            if (!name || !email || (inquiryType !== 'purchase' && (!vision || !commissionType))) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Please fill in all required fields.' }));
              return;
            }
            console.log('\n[mock /api/inquire]', JSON.stringify(data, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          }
        });
      });
    },
  };
}

/* ─── Oracle card OG page generator ──────────────────────────────────────────
 * Runs as a Vite closeBundle hook so it is guaranteed to execute at the end of
 * every production build, regardless of what else runs in the npm build script.
 * Generates dist/oracle/universal-language/{n}.html for each of the 64 cards.
 * Cloudflare Pages' HTML extension stripping serves 43.html for the URL
 * /oracle/universal-language/43 — matched before _redirects — so WhatsApp's
 * scraper receives the correct og:image on the first byte.
 * ─────────────────────────────────────────────────────────────────────────── */

const CLOUDINARY  = 'https://res.cloudinary.com/dobbosnda/image/upload';
const OG_CROP     = 'f_auto,q_auto,w_300,h_300,c_fill,g_center';
const SITE_URL    = 'https://www.adrianrasmussen.com';

const UL_CARD_NAMES: Record<number, string> = {
   1:"Earth's Breath", 2:'Beyond the Shell', 3:'Messengers of the Infinite',
   4:'Veils of Knowledge', 5:'The Space Between Time', 6:'Harmonious Mirage',
   7:'Essential Nexus', 8:'Odyssey of Freedom', 9:'Ease in This',
  10:'Internal Treasure', 11:'Sol Star', 12:'Petals of Freedom',
  13:'Universal Crest', 14:'Ancestors Bloom', 15:'Ordinary Valiance',
  16:'Grand Rising', 17:'Peral of Christos', 18:'Liberation of the Greater',
  19:'Solection', 20:'Emerging as the Code', 21:'Beyond Binary',
  22:'Treasure of the Way', 23:'Beneath the Surface', 24:'Frequency Flutter',
  25:'The Mysteries Play', 26:'Lighter Than a Feather', 27:'Inner Majesty',
  28:'Becoming the Mystery', 29:'All In', 30:'Sparking the Blaze',
  31:'Theater of Truth', 32:'Art of Living', 33:'Echos of Time',
  34:'Sublime Power', 35:'Navigational Star', 36:'Crystal Creation',
  37:'Journey Home', 38:'Inner Light Symphony', 39:'Nobel Spark',
  40:'Eternal Wellspring', 41:'Beginning and the End', 42:'Moving to Perfection',
  43:'Cipher of Knowledge', 44:"Sophia's Orchestra", 45:'Tribal Tapestry',
  46:'Fountain of Light', 47:'Garden of Alchemy', 48:'Doorways of the Unknown',
  49:'Union in the Ashes', 50:'Melt Into Perfection', 51:'Unshakable Arrival',
  52:'Timeless Blossom', 53:'Creation Oscillation', 54:'Everlasting Bounty',
  55:'Untouched Perfection', 56:'Infinite Journey', 57:'Flight of the Tao',
  58:'Rhythm of Life', 59:'Mystics Treasures', 60:'Woven Light',
  61:'Celestial Remembrance', 62:'Voice of Nature', 63:'Adornments of Time',
  64:'Communion',
};

const UL_CARD_IMAGES: Record<number, string> = {
   1:'1_o8tafh',  2:'2_kvndyq',  3:'3_b8iscb',  4:'4_qesce2',  5:'5_egctcj',
   6:'6_w1otd0',  7:'7_bzq8ct',  8:'8_nff0od',  9:'9_tjug04', 10:'10_ozcqlz',
  11:'11_rtesiu', 12:'12_xjjkon', 13:'13_citdc4', 14:'14_l5ufs8', 15:'15_vozkvv',
  16:'16_dvhi86', 17:'17_ntlh1k', 18:'18_kznsph', 19:'19_imppfd', 20:'20_e4a4zp',
  21:'21_vxnf0f', 22:'22_lldo5g', 23:'23_kbbbt8', 24:'24_s6sd3e', 25:'25_aelw6r',
  26:'26_hoyypz', 27:'27_fxvwyy', 28:'28_zr859p', 29:'29_lhj3ug', 30:'30_fp8gza',
  31:'31_wiywrb', 32:'32_x9qxas', 33:'33_nsf6y8', 34:'34_n1s8hf', 35:'35_qdtutl',
  36:'36_k8tlcz', 37:'37_f4zdoz', 38:'38_rca4zk', 39:'39_rnqs4x', 40:'40_zeqgmt',
  41:'41_qlljho', 42:'42_jb7xjb', 43:'43_bhjxku', 44:'44_p9s6o1', 45:'45_xjnohi',
  46:'46_hqh9va', 47:'47_oxq0wy', 48:'48_ttflpq', 49:'49_xciocz', 50:'50_g1vs1y',
  51:'51_pdgusl', 52:'52_farywa', 53:'53_hai5ju', 54:'54_m3cjgp', 55:'55_olyr5l',
  56:'56_boey2k', 57:'57_ykvrmw', 58:'58_hsyihd', 59:'59_braqjq', 60:'60_eoiule',
  61:'61_o6dqa5', 62:'62_rtxmo2', 63:'63_ns8e6p', 64:'64_lgyp8t',
};

function generateOgPagesPlugin(): Plugin {
  return {
    name: 'generate-oracle-og-pages',
    apply: 'build',
    closeBundle() {
      const distIndex = path.resolve(__dirname, 'dist/index.html');
      const template  = readFileSync(distIndex, 'utf-8');
      const ulDir     = path.resolve(__dirname, 'dist/oracle/universal-language');
      mkdirSync(ulDir, { recursive: true });

      let count = 0;
      for (let num = 1; num <= 64; num++) {
        const cardName = UL_CARD_NAMES[num];
        const imageId  = UL_CARD_IMAGES[num];
        if (!cardName || !imageId) continue;

        const title       = `${cardName} · Code ${num} · Universal Language Oracle`;
        const description = `An original multi-dimensional wooden sculpture by Adrian Rasmussen. Open the reading and receive what it holds.`;
        const image       = `${CLOUDINARY}/${OG_CROP}/${imageId}`;
        const url         = `${SITE_URL}/oracle/universal-language/${num}`;

        let html = template
          .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
          .replace(/(<meta name="description"\s+content=")[^"]*(")/,        `$1${description}$2`)
          .replace(/(<meta property="og:title"\s+content=")[^"]*(")/,       `$1${title}$2`)
          .replace(/(<meta property="og:description"\s+content=")[^"]*(")/,  `$1${description}$2`)
          .replace(/(<meta property="og:image"\s+content=")[^"]*(")/,        `$1${image}$2`)
          .replace(/(<meta name="twitter:title"\s+content=")[^"]*(")/,       `$1${title}$2`)
          .replace(/(<meta name="twitter:description"\s+content=")[^"]*(")/,`$1${description}$2`)
          .replace(/(<meta name="twitter:image"\s+content=")[^"]*(")/,       `$1${image}$2`)
          .replace(/(<meta property="og:image:width"\s+content=")[^"]*(")/,  `$1300$2`)
          .replace(/(<meta property="og:image:height"\s+content=")[^"]*(")/,  `$1300$2`);

        if (!html.includes('<link rel="canonical"')) {
          html = html.replace(
            /(<meta property="og:image:height"[^>]*>)/,
            `$1\n    <link rel="canonical" href="${url}" />`,
          );
        }

        writeFileSync(path.join(ulDir, `${num}.html`), html, 'utf-8');
        count++;
      }
      console.log(`✓ Oracle OG pages: generated ${count} card pages`);
    },
  };
}

export default defineConfig({
  server: {
    port: 8888,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 8888,
      protocol: 'ws',
    },
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  plugins: [react(), mockApiPlugin(), generateOgPagesPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
