// Rapportfanene Produktmargin og Prisendringer. Skilt ut av index.html 2026-08-07.
// ===== Produktmargin (Consolidated Model) =====
// Den eneste rapporten i appen som svarer på «hvor tjener vi faktisk penger, per vare».
// Alt annet her er omsetning; dette er dekningsbidrag.
const PM_KONSEPT=[['','Alle konsepter'],['la_salumeria','La Salumeria'],['east_essence','East Essence'],
  ['godt_lokalt','Godt Lokalt'],['wulff_co','Wulff & Co'],['fast_food','Fast Food'],['sabor','Sabor']];
const pmState={ar:new Date().getFullYear(),konsept:'',sorter:'omsetning',sok:''};

function pmSett(felt,verdi){pmState[felt]=felt==='ar'?parseInt(verdi,10):verdi;lastRapProdukt();}

function renderRapProduktSkall(){
  const iAr=new Date().getFullYear();
  const aarValg=[iAr,iAr-1,iAr-2].map(a=>`<option value="${a}" ${a===pmState.ar?'selected':''}>${a}</option>`).join('');
  return `<div class="d-panel">
    <div class="d-panel-hode">
      <h3>Produktmargin</h3>
      <span class="d-sub">Realisert dekningsgrad per vare, mot ${pmState.ar-1}</span>
    </div>
    <p class="d-sub" style="margin:0 0 12px">Tallene er hentet fra Consolidated Model — omsetning og varekost slik grossistene faktisk har rapportert dem. Dette er ikke kalkylens margin, men den vi endte opp med.</p>
    <div class="rap-subrow rap-noprint" style="margin:0 0 12px">
      ${PM_KONSEPT.map(([k,n])=>`<button class="rap-pill small ${k===pmState.konsept?'aktiv':''}" onclick="pmSett('konsept','${k}')">${n}</button>`).join('')}
    </div>
    <div class="d-verktoy rap-noprint">
      <select class="d-input" style="width:110px" onchange="pmSett('ar',this.value)">${aarValg}</select>
      <select class="d-input" style="width:230px" onchange="pmSett('sorter',this.value)">
        <option value="omsetning" ${pmState.sorter==='omsetning'?'selected':''}>Størst omsetning</option>
        <option value="fall" ${pmState.sorter==='fall'?'selected':''}>Største marginfall mot i fjor</option>
        <option value="dg_lav" ${pmState.sorter==='dg_lav'?'selected':''}>Lavest dekningsgrad</option>
        <option value="dg_hoy" ${pmState.sorter==='dg_hoy'?'selected':''}>Høyest dekningsgrad</option>
      </select>
      <input class="d-input" style="width:220px" placeholder="produktnavn eller varenr" value="${esc(pmState.sok)}"
             onchange="pmSett('sok',this.value)">
    </div>
    <div id="pmRapInnhold" style="font-size:13px"></div>
  </div>`;
}

async function lastRapProdukt(){
  const vert=document.getElementById('rapInnhold');
  if(!vert)return;
  vert.innerHTML=renderRapProduktSkall();
  const el=document.getElementById('pmRapInnhold');
  el.innerHTML='<span class="d-sub">Henter…</span>';
  try{
    const p=new URLSearchParams({ar:pmState.ar,mot_ar:pmState.ar-1,sorter:pmState.sorter,grense:'60'});
    if(pmState.konsept)p.set('konsept',pmState.konsept);
    if(pmState.sok)p.set('sok',pmState.sok);
    const d=await api('/api/produkt-margin?'+p.toString());
    if(!d.antall){
      el.innerHTML='<div class="d-tom"><div class="d-tom-tit">Ingen produkter for '+pmState.ar+'</div><div class="d-tom-hjelp">Hent produkt- og margindata i Innstillinger → Datainnhenting.</div></div>';
      return;
    }
    const mnok=v=>(v/1e6).toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2});
    const pp=v=>v==null?'<span class="d-sub">–</span>'
      :`<span style="color:${v<-1?'var(--feil)':(v>1?'var(--ok)':'var(--muted)')};font-weight:600">${v>0?'+':''}${v.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} pp</span>`;
    // Sum-linja er vektet, ikke et snitt av prosentene — se samme resonnement i kalkylen.
    const sumOms=d.produkter.reduce((a,r)=>a+r.belop,0), sumDb=d.produkter.reduce((a,r)=>a+r.db,0);
    el.innerHTML='<div class="table-wrap"><table class="d-tabell" style="min-width:720px"><thead><tr>'
      +'<th>Varenr</th><th title="DLVRYs interne produktnummer — egen nummerserie, ikke koblet mot innkjøpspris">DLVRY-nr</th><th>Produkt</th><th>Kategori</th><th class="tall">Omsetning</th>'
      +`<th class="tall">DB</th><th class="tall">DG ${pmState.ar}</th>`
      +`<th class="tall">DG ${pmState.ar-1}</th><th class="tall">Endring</th></tr></thead><tbody>`
      +d.produkter.map(r=>`<tr>
          <td>${esc(r.varenummer||'–')}</td>
          <td>${esc(r.unikt_produktnummer_hk||'–')}</td>
          <td>${esc(r.navn||'(uten navn)')}${r.margin_usikker?' <span class="d-merke advarsel" title="Én av grossistene bak tallet rapporterer ikke varekost — marginen er for høy">⚠</span>':''}</td>
          <td class="d-sub">${esc(r.kategori||'–')}</td>
          <td class="tall">${mnok(r.belop)}</td>
          <td class="tall">${mnok(r.db)}</td>
          <td class="tall" style="font-weight:600">${r.dg_pct==null?'–':r.dg_pct.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})+' %'}</td>
          <td class="tall d-sub">${r.dg_pct_forrige==null?'–':r.dg_pct_forrige.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})+' %'}</td>
          <td class="tall">${pp(r.dg_endring_pp)}</td></tr>`).join('')
      +`</tbody><tfoot><tr style="font-weight:600;border-top:2px solid var(--d-ramme)">
          <td colspan="4">Sum viste produkter (${d.antall})</td>
          <td class="tall">${mnok(sumOms)}</td>
          <td class="tall">${mnok(sumDb)}</td>
          <td class="tall">${sumOms?((100*sumDb/sumOms).toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})+' %'):'–'}</td>
          <td colspan="2"></td></tr></tfoot></table></div>`
      +'<p class="d-sub" style="margin:8px 0 0">Beløp i MNOK. Sorteringene «lavest DG» og «største fall» viser bare varer med minst 0,1 MNOK i omsetning — resten er for små til å si noe om prising.</p>';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }
}

// ===== Prisendringer fra leverandør (Totalprislista) =====
// Kalkylen regner margin av kostbasen i produkter.json. Når leverandøren justerer prisen,
// er den kostbasen feil — og ingen får vite det. Denne lista er varselet.
const peState={minEndring:2,sok:''};
function peSett(felt,verdi){peState[felt]=felt==='minEndring'?parseFloat(verdi):verdi;lastRapPrisendringer();}

async function lastRapPrisendringer(){
  const vert=document.getElementById('rapInnhold');
  if(!vert)return;
  vert.innerHTML=`<div class="d-panel">
    <div class="d-panel-hode">
      <h3>Prisendringer fra leverandør</h3>
      <span class="d-sub">Totalprislista i Consolidated Model</span>
    </div>
    <p class="d-sub" style="margin:0 0 12px">Varer der leverandøren har endret prisen. Kalkylen bruker fortsatt kostbasen fra produktfila — der de to spriker, regner Tilbudsverktøyet med feil kost.</p>
    <div class="d-verktoy rap-noprint">
      <label class="d-sub">Minste endring
        <select class="d-input" style="width:90px;margin-left:6px" onchange="peSett('minEndring',this.value)">
          ${[2,5,10,20].map(v=>`<option value="${v}" ${v===peState.minEndring?'selected':''}>${v} %</option>`).join('')}
        </select></label>
      <input class="d-input" style="width:220px" placeholder="produkt eller leverandør" value="${esc(peState.sok)}" onchange="peSett('sok',this.value)">
    </div>
    <div id="peInnhold" style="font-size:13px"></div></div>`;
  const el=document.getElementById('peInnhold');
  el.innerHTML='<span class="d-sub">Henter…</span>';
  try{
    const d=await api('/api/prisliste/endringer?min_endring='+peState.minEndring+'&grense=200');
    let rader=d.endringer||[];
    if(peState.sok){
      const s=peState.sok.toLowerCase();
      rader=rader.filter(r=>(r.navn||'').toLowerCase().includes(s)||(r.leverandor||'').toLowerCase().includes(s));
    }
    if(!rader.length){
      el.innerHTML='<div class="d-tom"><div class="d-tom-tit">Ingen prisendringer over '+peState.minEndring+' %</div><div class="d-tom-hjelp">Senk grensen, eller hent prislista i Innstillinger → Datainnhenting.</div></div>';
      return;
    }
    // Kobling mot kalkylens katalog. DB er lastet fra produkter.json ved oppstart.
    const perArt={};DB.forEach(p=>{if(p.art!=null)perArt[String(p.art).trim()]=p;});
    const kr=v=>v==null?'–':v.toLocaleString('nb-NO',{minimumFractionDigits:2,maximumFractionDigits:2});
    let koblet=0;
    const rows=rader.map(r=>{
      const p=perArt[String(r.varenummer||'').trim()]||perArt[String(r.epd||'').trim()];
      if(p)koblet++;
      const opp=r.endring_pct>0;
      return `<tr>
        <td>${esc(r.navn||'(uten navn)')}<div class="d-sub">${esc(r.leverandor||'')}</div></td>
        <td class="d-sub">${esc(r.enhet||'–')}</td>
        <td class="tall">${kr(r.forrige_netto)}</td>
        <td class="tall" style="font-weight:600">${kr(r.netto)}</td>
        <td style="text-align:right;font-weight:600;color:${opp?'var(--advarsel)':'var(--ok)'}">${opp?'+':''}${r.endring_pct.toLocaleString('nb-NO',{minimumFractionDigits:1,maximumFractionDigits:1})} %</td>
        <td class="d-sub">${esc(r.prisdato||'')}</td>
        <td class="tall">${p?kr(p.kostbase):'<span class="d-sub">ikke i kalkylen</span>'}</td>
        <td class="tall">${p?kr(p.listepris):''}</td></tr>`;}).join('');
    el.innerHTML='<div class="table-wrap"><table class="d-tabell" style="min-width:820px"><thead><tr>'
      +'<th>Produkt / leverandør</th><th>Enhet</th><th class="tall">Forrige</th>'
      +'<th class="tall">Ny pris</th><th class="tall">Endring</th><th>Prisdato</th>'
      +'<th class="tall">Kalkylens kostbase</th><th class="tall">Listepris</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table></div>'
      +`<p class="d-sub" style="margin:8px 0 0">${rader.length} varer over ${peState.minEndring} %, hvorav ${koblet} finnes i kalkylens katalog. `
      +'Innkjøpsprisen og kostbasen er <b>ikke nødvendigvis samme enhet</b> — leverandørprisen er ofte per D-pak — så les dem som to opplysninger, ikke som et regnestykke. Endringen i prosent er derimot sammenlignbar med seg selv.</p>';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }
}
