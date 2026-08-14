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

const katalog = JSON.parse(fs.readFileSync('produkter.json', 'utf8'));
if (!Array.isArray(katalog.k) || !Array.isArray(katalog.rows)) {
  throw new Error('produkter.json må ha array-feltene k og rows');
}

const obligatoriske = ['art', 'navn', 'enhet', 'listepris', 'kostbase', 'kilde'];
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

console.log(`OK: ${scripts.length} inline-script og ${katalog.rows.length} produkter validert`);
