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

const tilgangKilde = fs.readFileSync('js/fb-internokonomi-tilgang.js', 'utf8');
const kanSeFbInternokonomiFor = new Function(`${tilgangKilde}; return kanSeFbInternokonomiFor;`)();
if (!kanSeFbInternokonomiFor({rolle:'superadmin'})) {
  throw new Error('Superadmin må alltid se FB internøkonomi');
}
if (!kanSeFbInternokonomiFor({rolle:'selger',kan_se_fb_internokonomi:true})) {
  throw new Error('Eksplisitt valgt bruker må se FB internøkonomi');
}
for (const rolle of ['selger','salgsjef','leder','admin']) {
  if (kanSeFbInternokonomiFor({rolle})) throw new Error(`${rolle} må være skjermet som standard`);
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
const fbKostIndex = katalog.k.indexOf('fbkostpris');
for (const [index, row] of katalog.rows.entries()) {
  if (!Array.isArray(row) || row.length !== katalog.k.length) {
    throw new Error(`Produktlinje ${index + 1} har feil kolonneantall`);
  }
  if (!String(row[artIndex] ?? '').trim()) throw new Error(`Produktlinje ${index + 1} mangler artikkelnummer`);
  if (!String(row[navnIndex] ?? '').trim()) throw new Error(`Produktlinje ${index + 1} mangler produktnavn`);
  if (Number(row[kostIndex] ?? 0) < 0) throw new Error(`Produktlinje ${index + 1} har negativ kostbase`);
}

// Korrigerte FB-kostbaser fra Excel 14.08.2026. Disse var feil i forrige eksport.
const korrigerteFbKostbaser = new Map([
  ['3519511', 141.37],
  ['3512701', 146.48],
  ['6926265', 127.28],
]);
for (const [art, forventetKost] of korrigerteFbKostbaser) {
  const produkt = katalog.rows.find(row => String(row[artIndex]) === art);
  if (!produkt || Number(produkt[kostIndex]) !== forventetKost || Number(produkt[fbKostIndex]) !== forventetKost) {
    throw new Error(`Foodbroker-kost for ${art} avviker fra korrigert Excel-fil`);
  }
}

if (katalog.meta?.eksporterte_produkter !== katalog.rows.length) {
  throw new Error('Metadata og antall eksporterte produkter stemmer ikke');
}

for (const funksjon of ['fb_stotte_pct', 'fb_stotte_spesialpris', 'Justert grossistkost', 'renderBeslutningsstotte']) {
  if (!html.includes(funksjon)) throw new Error(`Tilbudsverktøyet mangler Foodbroker-/designfunksjonen ${funksjon}`);
}

// FB internøkonomi er fra 2026-08-18 én av modulene i brukerlista, ikke en egen kolonne —
// derfor er det settBrukerModuler (ikke lenger settFbInternokonomiTilgang) som er
// tildelingsveien. Skjermingen inne i tilbudsverktøyet er uørt.
for (const vern of ['x.isFB&&visFbIntern', "if(visFbIntern)rows.push(['Foodbroker-støtte'", 'settBrukerModuler']) {
  if (!html.includes(vern)) throw new Error(`Tilbudsverktøyet mangler tilgangsvern: ${vern}`);
}

// Menyen skal styres av brukerens moduler, ikke av hardkodede rollelister. Testen fanger
// at noen legger rollesjekken tilbake i showApp() neste gang en side skal skjules.
for (const modulvern of ['function harModul(', 'MODUL_FOR_VIEW', 'oppdaterMenyModuler(', "/api/brukere/moduler"]) {
  if (!html.includes(modulvern)) throw new Error(`Modultilgangen mangler ${modulvern}`);
}
for (const rolleliste of ["['leder','admin','superadmin'].includes(CURRENT_USER.rolle)"]) {
  if (html.includes(rolleliste)) throw new Error(`Menytilgang skal komme fra moduler, ikke rollelista ${rolleliste}`);
}

// normalizeDash bygger et EKSPLISITT objekt: et felt backend sender, men som ikke er
// nevnt der, forsvinner stille. Det har skjedd tre ganger (importhus, siste_uke_med_data,
// grossist_trend). Testen fanger den fjerde.
for (const dashFelt of ['siste_uke_med_data:d.siste_uke_med_data', 'importhus:d.importhus',
                        'grossist_trend:d.grossist_trend']) {
  if (!html.includes(dashFelt)) throw new Error(`normalizeDash slipper ikke gjennom ${dashFelt} — feltet blir stille kastet`);
}

// En nettleserfane kan stå åpen over et ukeskifte. Dashboard og Rapporter må da hente
// nye vannmerker, og slideren må flytte seg hvis den fortsatt sto på forrige standarduke.
for (const ferskhetsvern of ['oppdaterDashHvisGammelt(v)', "document.addEventListener('visibilitychange'",
                             'analyseState.week===gammelCutoff']) {
  if (!html.includes(ferskhetsvern)) throw new Error(`Dashboardets automatisk oppdatering mangler ${ferskhetsvern}`);
}

for (const rapportfunksjon of ['hentRapNyeKunder', 'renderRapNyeKunderUke', 'lastNyeKunderCsv', '/api/dashboard-excel/nye-kunder-uke']) {
  if (!html.includes(rapportfunksjon)) throw new Error(`Ukerapporten mangler nye-kunder-funksjonen ${rapportfunksjon}`);
}

for (const brregVern of ["p.set('ekskluder_brreg_risiko','true')", 'BRREG: konkurs/avvikling skjult']) {
  if (!html.includes(brregVern)) throw new Error(`Leadlisten mangler BRREG-filteret: ${brregVern}`);
}

console.log(`OK: ${scripts.length} inline-script og ${katalog.rows.length} produkter validert`);
