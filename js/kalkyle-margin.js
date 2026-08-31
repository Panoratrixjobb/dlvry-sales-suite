// Realisert margin fra Consolidated Model, vist i Tilbudsverktoyet.
// Skilt ut av index.html 2026-08-07.
// ===== Realisert margin fra Consolidated Model, vist i kalkylen =====
// Kalkylen regner margin av listepris og grossistkost — det er den TEORETISKE marginen på
// tilbudet. Her hentes hva de samme varene FAKTISK har gitt oss hittil i år, per varenummer,
// slik at avviket er synlig mens prisen settes og ikke først i et kvartalsmøte.
//
// «Marked» var et misvisende ord og er tatt ut (Manuele 2026-08-31): tallet er ikke
// markedspriser eller konkurrenter, det er SUM(DB Salg)/SUM(omsetning) på varen over alle
// kunder og grossister i inneværende år — vår egen oppnådde dekningsgrad. Konsernintern
// omsetning er filtrert bort i modellen, og grossister uten rapportert varekost (D07)
// merkes med ⚠. Derfor heter det nå «oppnådd DG i år».
const MARKED={data:{},nokkel:null,henter:false,ar:null};

// Sammenlignbar marginprosent for én linje — den som kan settes opp mot oppnådd DG.
//
// Oppnådd DG måles mot GROSSISTENS varekost. For en Foodbroker-vare er det internprisen
// Foodbroker fakturerer grossisten, altså ETT ledd. Kalkylens margin % måles mot DLVRYs
// egen kostbase (Foodbrokers importkost), altså TO ledd. Å trekke det ene fra det andre
// ga et avvik som systematisk så 15–25 pp for pent ut på Foodbroker-varer, og et tall som
// alltid ser bra ut slutter man å reagere på.
//
// compute() regner allerede grossistMargin mot justert grossistkost — den kosten
// grossisten faktisk sitter med etter eventuell Foodbroker-støtte — og faller tilbake til
// DLVRYs kostbase for varer uten eget ledd. Det er nøyaktig samme nivå som modellen måler,
// så avviket blir eple-mot-eple. Marginkolonnen over viser fortsatt TOTALmarginen; det er
// bare sammenligningen som byttes.
function sammenlignbarMarginPct(x){
  if(x.manglerKost||!(x.oms>0))return null;
  return (x.grossistMargin/x.oms)*100;
}

// Avviket — ikke markedstallet alene — er det selgeren skal reagere på. Totalen har hatt
// «Avvik mot marked» som KPI en stund; her står det samme regnestykket per produktlinje,
// slik at man ser HVILKEN vare som drar kalkylen under markedet. Ønsket av Manuele
// 2026-08-31. Avviket er i PROSENTPOENG (pp): differansen mellom to prosenttall.
function markedCelle(x){
  const m=MARKED.data[String(x.l.art||'')];
  if(!m)return '';
  // Mangler kost → ingen kalkulert margin å sammenligne med (aldri en fabrikkert,
  // bonus-trukket negativ margin som ville farget markedstallet rødt). Se funn #2.
  const kalk=sammenlignbarMarginPct(x);
  // Fargen sier om vi priser OVER eller UNDER det varen faktisk har gitt oss i år — det er
  // spørsmålet selgeren har. Grått når vi ikke har en kalkulert margin å måle mot.
  const farge=kalk==null?'var(--muted)':(kalk>=m.dg_pct?'var(--ok)':'var(--advarsel)');
  const trend=(m.dg_pct_ifjor!=null&&Math.abs(m.dg_pct-m.dg_pct_ifjor)>=0.5)
    ? ` <span title="I fjor ${m.dg_pct_ifjor.toLocaleString('nb-NO')} %">${m.dg_pct>m.dg_pct_ifjor?'↑':'↓'}</span>` : '';
  const pp=kalk==null?'':(()=>{
    const a=kalk-m.dg_pct;
    return ` · <strong title="Sammenlignbar margin på denne linja (${kalk.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} %) minus oppnådd DG. Måles mot grossistens varekost på begge sider${x.isFB?' — Foodbroker-leddet er holdt utenfor HER, slik at tallene er sammenlignbare. Margin %-en over er fortsatt totalmarginen.':'.'}">`
      +`${a>0?'+':''}${a.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} pp</strong>`;
  })();
  return `<div style="font-size:10px;font-weight:500;color:${farge}" title="Dekningsgraden DLVRY faktisk har oppnådd på denne varen i ${MARKED.ar}, hos alle kunder og grossister. Ikke markedspriser eller konkurrenter — våre egne fakturerte salg${m.margin_usikker?'. NB: én av grossistene rapporterer ikke varekost, så tallet er for høyt':''}">`
    +`oppnådd ${m.dg_pct.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} %${trend}${m.margin_usikker?' ⚠':''}${pp}</div>`;
}

async function sikreMarkedsmargin(){
  // Nøkkelen er varenumrene i kurven. Uendret kurv → ingen ny henting, og render() kan
  // derfor kalle denne fritt uten å sette i gang en løkke.
  const numre=[...new Set(state.cart.map(l=>String(l.art||'').trim()).filter(Boolean))];
  const nokkel=numre.join(',');
  if(nokkel===MARKED.nokkel||MARKED.henter)return;
  if(!numre.length){MARKED.nokkel=nokkel;MARKED.data={};return;}
  MARKED.henter=true;
  try{
    const d=await api('/api/produkt-margin/oppslag',{method:'POST',body:{varenumre:numre}});
    MARKED.data=d.treff||{};MARKED.ar=d.ar;
  }catch(e){
    // Ingen margindata hentet ennå, eller ingen tilgang — kalkylen skal virke uansett.
    MARKED.data={};
  }finally{
    MARKED.nokkel=nokkel;MARKED.henter=false;render();
  }
}
