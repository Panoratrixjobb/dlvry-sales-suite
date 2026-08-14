import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(script => script.trim());

for (const [index, script] of scripts.entries()) {
  try {
    new Function(script);
  } catch (error) {
    throw new Error(`JavaScript-feil i inline-script ${index + 1}: ${error.message}`);
  }
}

const fbPrisflytKilde = fs.readFileSync('js/fb-prisflyt.js', 'utf8');
const beregnFbPrisflyt = new Function(`${fbPrisflytKilde}; return beregnFbPrisflyt;`)();
const prosentFlyt = beregnFbPrisflyt({kilde:'Foodbroker',fbkostpris:100,grossistprisFB:140,fbStottePct:0.10,fbStotteSpesialpris:null},100,false);
if (prosentFlyt.justertGrossistkost !== 126 || prosentFlyt.fbStottePerEnhet !== 14 || prosentFlyt.underFbKost) {
  throw new Error('Foodbroker-støtteprosent følger ikke Excel-regelen');
}
const spesialFlyt = beregnFbPrisflyt({kilde:'Foodbroker',fbkostpris:100,grossistprisFB:140,fbStottePct:0.10,fbStotteSpesialpris:90},100,false);
if (spesialFlyt.justertGrossistkost !== 90 || spesialFlyt.fbStottePerEnhet !== 50 || !spesialFlyt.underFbKost) {
  throw new Error('Støttet internpris skal overstyre prosent og varsle under FB-kost');
}

const katalog = JSON.parse(fs.readFileSync('produkter.json', 'utf8'));
if (!Array.isArray(katalog.k) || !Array.isArray(katalog.rows)) {
  throw new Error('produkter.json må ha array-feltene k og rows');
}

const obligatoriske = ['art', 'navn', 'enhet', 'listepris', 'kostbase', 'kilde', 'fbkostpris', 'grossistprisFB'];
for (const felt of obligatoriske) {
  if (!katalog.k.includes(felt)) throw new Error(`produkter.json mangler kolonnen ${felt}`);
}

const artIndex = katalog.k.indexOf('art');
const navnIndex = katalog.k.indexOf('navn');
const kostIndex = katalog.k.indexOf('kostbase');
for (const [index, row] of katalog.rows.entries()) {
  if (!Array.isArray(row) || row.length !== katalog.k.length) {
    throw new Error(`Produktlinje ${index + 1} har feil kolonneantall`);
  }
  if (!String(row[artIndex] ?? '').trim()) throw new Error(`Produktlinje ${index + 1} mangler artikkelnummer`);
  if (!String(row[navnIndex] ?? '').trim()) throw new Error(`Produktlinje ${index + 1} mangler produktnavn`);
  if (Number(row[kostIndex] ?? 0) < 0) throw new Error(`Produktlinje ${index + 1} har negativ kostbase`);
}

if (katalog.meta?.eksporterte_produkter !== katalog.rows.length) {
  throw new Error('Metadata og antall eksporterte produkter stemmer ikke');
}

for (const funksjon of ['fb_stotte_pct', 'fb_stotte_spesialpris', 'Justert grossistkost', 'renderBeslutningsstotte']) {
  if (!html.includes(funksjon)) throw new Error(`Tilbudsverktøyet mangler Foodbroker-/designfunksjonen ${funksjon}`);
}

console.log(`OK: ${scripts.length} inline-script og ${katalog.rows.length} produkter validert`);
