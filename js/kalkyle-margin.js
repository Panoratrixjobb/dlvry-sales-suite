// Realisert margin fra Consolidated Model, vist i Tilbudsverktoyet.
// Skilt ut av index.html 2026-08-07.
// ===== Realisert margin fra Consolidated Model, vist i kalkylen =====
// Kalkylen regner margin av listepris og grossistkost — det er den TEORETISKE marginen på
// tilbudet. Her hentes hva de samme varene faktisk har gitt i markedet i år, per varenummer,
// slik at avviket er synlig mens prisen settes og ikke først i et kvartalsmøte.
const MARKED={data:{},nokkel:null,henter:false,ar:null};

function markedCelle(x){
  const m=MARKED.data[String(x.l.art||'')];
  if(!m)return '';
  // Mangler kost → ingen kalkulert margin å sammenligne med (aldri en fabrikkert,
  // bonus-trukket negativ margin som ville farget markedstallet rødt). Se funn #2.
  const kalk=(!x.manglerKost&&x.oms>0)?((x.dlvryMargin-x.bonusKr)/x.oms)*100:null;
  // Fargen sier om vi priser OVER eller UNDER det varen faktisk gir i markedet — det er
  // spørsmålet selgeren har. Grått når vi ikke har en kalkulert margin å måle mot.
  const farge=kalk==null?'var(--muted)':(kalk>=m.dg_pct?'var(--ok)':'var(--advarsel)');
  const trend=(m.dg_pct_ifjor!=null&&Math.abs(m.dg_pct-m.dg_pct_ifjor)>=0.5)
    ? ` <span title="I fjor ${m.dg_pct_ifjor.toLocaleString('nb-NO')} %">${m.dg_pct>m.dg_pct_ifjor?'↑':'↓'}</span>` : '';
  return `<div style="font-size:10px;font-weight:500;color:${farge}" title="Faktisk dekningsgrad i markedet ${MARKED.ar}${m.margin_usikker?' — én av grossistene rapporterer ikke varekost, tallet er for høyt':''}">`
    +`marked ${m.dg_pct.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} %${trend}${m.margin_usikker?' ⚠':''}</div>`;
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
