// Tester filtrering og sortering i konsernintern-rapporten, uten nettleser.
import fs from 'node:fs';
const html = fs.readFileSync('index.html','utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function rapKiUtvalg'));
const kilde = script.slice(script.indexOf('const RAP_KI = {'), script.indexOf('function renderRapKiDetalj'));
const esc = s => String(s??'');
const {RAP_KI, rapKiUtvalg, rapKiSorter, rapKiFilter, rapKiNullstill} =
  new Function('esc','renderRapKiDetalj','document', kilde + '; return {RAP_KI, rapKiUtvalg, rapKiSorter, rapKiFilter, rapKiNullstill};')(esc, ()=>{}, {getElementById:()=>null});

RAP_KI.data = {rader:[
  {grossist:'D24 Foodbroker AS', kundenr:'61273', kundenavn:'Wulff & Co OSLO', orgnr:'886181132', kjoper:'Wulff & Co AS', konsept:'wulff_co', belop:49549341, kilde:'orgnr'},
  {grossist:'D24 Foodbroker AS', kundenr:'10018', kundenavn:'CARL EVENSEN EFTF.AS', orgnr:'911545446', kjoper:'Carl Evensen EFTF AS', konsept:'la_salumeria', belop:34108756, kilde:'orgnr'},
  {grossist:'D22 Carl Evensen EFTF AS', kundenr:'20411', kundenavn:'Carl Evensen eget lager', orgnr:'911545446', kjoper:'Carl Evensen EFTF AS', konsept:'la_salumeria', belop:812400, kilde:'orgnr'},
  {grossist:'D22 Carl Evensen EFTF AS', kundenr:'20418', kundenavn:'CE ansattsalg', orgnr:'911545446', kjoper:'Carl Evensen EFTF AS', konsept:'east_essence', belop:109340, kilde:'orgnr'},
  {grossist:'D06 Wulff & Co AS', kundenr:'15070', kundenavn:'TROYE Bergen DIREKTE', orgnr:'941945554', kjoper:'Spesialgrossisten Troye AS', konsept:'wulff_co', belop:13497111, kilde:'orgnr'},
]};

const sjekk=(p,m)=>{ if(!p) throw new Error(m); };
const navn=r=>r.map(x=>x.kundenr).join(',');

// Standard: alt, sortert på beløp synkende.
sjekk(rapKiUtvalg().length===5, 'Skal vise alle 5 uten filter');
sjekk(navn(rapKiUtvalg())==='61273,10018,10018'.slice(0,0)+'61273,10018,15070,20411,20418',
      'Standard sortering skal være beløp synkende, fikk '+navn(rapKiUtvalg()));

// Filtrer på D22 — kjernen i det Manuele ba om.
rapKiFilter('grossist','D22 Carl Evensen EFTF AS');
sjekk(rapKiUtvalg().length===2, 'D22-filter skal gi 2 rader, fikk '+rapKiUtvalg().length);
sjekk(rapKiUtvalg().reduce((a,r)=>a+r.belop,0)===921740, 'D22-sum skal bli 921 740');

// Sorter stigende på beløp innenfor filteret.
rapKiSorter('belop');
sjekk(navn(rapKiUtvalg())==='20418,20411', 'Andre klikk på Beløp skal snu til stigende, fikk '+navn(rapKiUtvalg()));

// Sorter på tekstkolonne.
rapKiSorter('kundenavn');
sjekk(navn(rapKiUtvalg())==='20411,20418', 'Kundenavn stigende: Carl før CE, fikk '+navn(rapKiUtvalg()));

// Fritekst innenfor filteret.
RAP_KI.sok='ansatt';
sjekk(navn(rapKiUtvalg())==='20418', 'Søk skal treffe ansattsalg, fikk '+navn(rapKiUtvalg()));
RAP_KI.sok='911545446';
sjekk(rapKiUtvalg().length===2, 'Søk på org.nr skal treffe begge D22-radene');

// Nullstill fjerner alle filtre, men beholder sorteringen.
rapKiNullstill();
sjekk(rapKiUtvalg().length===5, 'Nullstill skal gi alle 5 tilbake');

// Kjøper-filter på tvers av grossister.
rapKiFilter('kjoper','Carl Evensen EFTF AS');
sjekk(rapKiUtvalg().length===3, 'Kjøper-filter skal gi 3 rader (D24 + to D22), fikk '+rapKiUtvalg().length);

console.log('OK — filtrering og sortering virker');
