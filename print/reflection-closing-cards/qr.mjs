import QRCode from 'qrcode';
import fs from 'node:fs';
const out = {};
for (const [k, url] of Object.entries({
  oracle: 'https://adrianrasmussen.com/qr/11',
  site: 'https://adrianrasmussen.com/?ref=card',
})) {
  out[k] = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#262321', light: '#0000' } });
}
fs.writeFileSync('print/reflection-closing-cards/qr.json', JSON.stringify(out));
console.log(Object.entries(out).map(([k,v])=>k+' '+v.length+' bytes').join('\n'));
