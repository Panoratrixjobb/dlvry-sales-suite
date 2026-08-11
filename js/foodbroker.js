// Foodbroker direktesalg — egen underside (2026-08-11), setView()-mønster som Konkurrenter.
// Se konseptsuite-backend/app/routers/foodbroker.py for hele bakgrunnen (Olivia Import-saken):
// "Total 3 år"-modellen fanger under 20 % av FBs direktesalgs-omsetning til denne typen
// kunder, så siden er Excel-drevet i stedet for Power BI-drevet, som resten av appen.
let FB_KUNDER = [];

async function mountFoodbroker(){
  const kanImportere = CURRENT_USER && ['leder','admin','superadmin'].includes(CURRENT_USER.rolle);
  document.getElementById('fbImportPanel').style.display = kanImportere ? '' : 'none';
  await fbLastKunder();
}

async function fbLastKunder(){
  const el = document.getElementById('fbTabell');
  el.innerHTML = '<p class="sub">Laster…</p>';
  try{
    const res = await api('/api/foodbroker/kunder');
    FB_KUNDER = res.kunder || [];
    document.getElementById('fbKpiAntall').textContent = res.antall_kunder.toLocaleString('nb-NO');
    document.getElementById('fbKpiSum').textContent = fmtKr(res.sum_alle_ar);
    fbTegnTabell();
  }catch(e){
    el.innerHTML = '<p class="sub" style="color:var(--d-roed)">Feil ved henting: '+esc(e.message)+'</p>';
  }
}

function fbTegnTabell(){
  const el = document.getElementById('fbTabell');
  if(!FB_KUNDER.length){
    el.innerHTML = '<p class="sub">Ingen direktekunder registrert ennå. '
      + (document.getElementById('fbImportPanel').style.display!=='none'
         ? 'Last opp Foodbrokers regneark over.' : 'Be en leder/admin importere.') + '</p>';
    return;
  }
  const alleAr = Array.from(new Set(FB_KUNDER.flatMap(k=>Object.keys(k.per_ar)))).sort();
  let html = '<table class="d-tabell" style="width:100%"><thead><tr><th>Kunde</th><th>Konsept</th>'
    + alleAr.map(a=>`<th style="text-align:right">${esc(a)}</th>`).join('')
    + '<th style="text-align:right">Vekst</th></tr></thead><tbody>';
  for(const k of FB_KUNDER){
    html += `<tr><td><b>${esc(k.kunde_navn)}</b></td><td class="sub">${esc(k.konsepter.join(', '))}</td>`
      + alleAr.map(a=>`<td style="text-align:right">${k.per_ar[a]!=null ? fmtKr(k.per_ar[a]) : '–'}</td>`).join('')
      + `<td style="text-align:right">${k.vekst_pct!=null ? (k.vekst_pct>=0?'+':'')+k.vekst_pct.toLocaleString('nb-NO')+' %' : '–'}</td></tr>`;
  }
  html += '</tbody></table>';
  el.innerHTML = html;
}

async function fbImporter(bekreft){
  const input = document.getElementById('fbFil');
  const el = document.getElementById('fbImportResultat');
  const fil = input.files[0];
  if(!fil){ el.innerHTML = '<span style="color:var(--d-roed)">Velg en .xlsx-fil først.</span>'; return; }
  if(bekreft && !confirm('Skrive Foodbroker-direktesalget til databasen? Årene i fila erstattes i sin helhet.')) return;
  el.innerHTML = '<span class="sub">Leser fil…</span>';
  try{
    const fd = new FormData(); fd.append('fil', fil);
    const r = await fetch(API_BASE+'/api/foodbroker/importer?bekreft='+(bekreft?'true':'false'),
      {method:'POST', headers:{'Authorization':'Bearer '+TOKEN}, body:fd});
    const txt = await r.text(); let data=null; try{data = txt?JSON.parse(txt):null;}catch(_){data=txt;}
    if(!r.ok){
      const msg = (data && data.detail) ? data.detail : ('HTTP '+r.status);
      throw new Error(typeof msg==='string' ? msg : JSON.stringify(msg));
    }
    let html = '<p style="margin:0 0 8px"><b>'+esc(data.status)+'</b></p>';
    for(const [ar,s] of Object.entries(data.sammendrag||{})){
      html += `<div style="margin-bottom:4px"><b>${esc(ar)}</b> — ${s.rader.toLocaleString('nb-NO')} rader, `
        + `${(s.kunder||[]).length.toLocaleString('nb-NO')} kunder, ${fmtKr(s.sum_kr)}`
        + `<span class="sub"> (${esc((s.kunder||[]).join(', '))})</span></div>`;
    }
    if(data.neste) html += '<p class="sub" style="margin-top:6px">'+esc(data.neste)+'</p>';
    el.innerHTML = html;
    if(bekreft){ input.value=''; await fbLastKunder(); if(typeof toast==='function') toast('Foodbroker-data importert'); }
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }
}
