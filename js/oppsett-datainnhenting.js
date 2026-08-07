// Innstillinger > Datainnhenting: Power BI, produkt/margin og leverandorpriser.
// Skilt ut av index.html 2026-08-07.
// ============ Hent fra Power BI (erstatter kundedata-opplastingen) ============
// Modell-ID og arbeidsområde fylles fra serveren, så admin bare limer inn tokenet.
// Serveren har en innebygd standard som App Service-konfigurasjon overstyrer — og
// feltet her overstyrer igjen begge, hvis man vil peke på en annen modell.
async function pbFyllStandard(){
  const linje=document.getElementById('pbStatusLinje');
  try{
    const s=await api('/api/powerbi/status');
    const d=document.getElementById('pbDataset'), g=document.getElementById('pbGruppe');
    if(d&&!d.value&&s.dataset_id)d.value=s.dataset_id;
    if(g&&!g.value&&s.group_id)g.value=s.group_id;
    linje.textContent=s.konfigurert
      ? 'Service principal er satt opp — token trengs ikke.'
      : 'Modell: '+(s.dataset_kilde||'')+'. Token må limes inn.';
  }catch(e){ linje.textContent=''; }
}

// Tokenet holdes bare i DOM-feltet og sendes i kroppen (aldri i URL-en, som havner i
// tilgangslogger). Det lagres verken i localStorage eller i basen — utløper av seg selv.
async function hentFraPowerBI(bekreft){
  const el=document.getElementById('pbResultat');
  const knapper=['pbTorrBtn','pbHentBtn'].map(id=>document.getElementById(id));
  const aar=[2024,2025,2026].filter(a=>document.getElementById('pbAr'+a).checked);
  if(!aar.length){el.innerHTML='<span style="color:var(--d-roed)">Velg minst ett år.</span>';return;}
  const body={
    token:document.getElementById('pbToken').value.trim()||null,
    dataset_id:document.getElementById('pbDataset').value.trim()||null,
    group_id:document.getElementById('pbGruppe').value.trim()||null,
  };
  if(bekreft&&!confirm('Skrive '+aar.join(', ')+' til databasen? Låste perioder hoppes over.'))return;
  knapper.forEach(b=>b.disabled=true);
  const start=Date.now();
  el.innerHTML='<span class="sub">Henter fra modellen… (fem spørringer per år, dette tar litt tid)</span>';
  const timer=setInterval(()=>{
    el.innerHTML='<span class="sub">Henter fra modellen… '+Math.round((Date.now()-start)/1000)+' s</span>';
  },1000);
  try{
    const qs=aar.map(a=>'ar='+a).join('&')+'&bekreft='+(bekreft?'true':'false');
    const d=await api('/api/powerbi/hent?'+qs,{method:'POST',body});
    clearInterval(timer);
    let html='<p style="margin:0 0 8px"><b>'+esc(d.status)+'</b> <span class="sub">('+Math.round((Date.now()-start)/1000)+' s)</span></p>';
    for(const [ar,s] of Object.entries(d.sammendrag||{})){
      html+=`<div style="margin-bottom:12px"><b>${esc(ar)}</b> — ${s.kunderader.toLocaleString('nb-NO')} kunderader, `
        +`${s.kunder.toLocaleString('nb-NO')} kundekontoer, ${s.kundeniva_mnok} MNOK på kundenivå `
        +`(grossistnivå ${s.grossistniva_mnok})`;
      const daarlig=(s.dekning_per_grossist||[]).filter(g=>g.dekning!=null&&g.dekning<99.5);
      if(!daarlig.length){
        html+=' · <span style="color:var(--d-gronn);font-weight:600">100 % kundenivå-dekning</span>';
      }else{
        html+='<div class="table-wrap" style="margin-top:6px"><table class="d-tabell" style="min-width:380px"><thead><tr>'
          +'<th>Grossist</th><th class="tall">Kundenivå</th><th class="tall">Totalt</th><th class="tall">Dekning</th></tr></thead><tbody>'
          +daarlig.map(g=>`<tr><td>${esc(g.kode)}</td><td class="tall">${g.kundeniva}</td>`
            +`<td class="tall">${g.grossistniva}</td>`
            +`<td style="text-align:right;font-weight:600;color:${g.dekning>=90?'var(--d-gul)':'var(--d-roed)'}">${g.dekning} %</td></tr>`).join('')
          +'</tbody></table></div>';
      }
      if(s.droppet_fram_i_tid&&s.droppet_fram_i_tid!=='ingen'){
        html+=`<div class="sub" style="margin-top:4px">Hoppet over ${s.droppet_fram_i_tid.rader} rader datert etter uke ${s.siste_godtatte_uke} (${s.droppet_fram_i_tid.mnok} MNOK) — de ville forskjøvet cutoff i hele appen.</div>`;
      }
      const utenfor=s.konsept_utenfor_appen||{};
      if(Object.keys(utenfor).length){
        html+='<div class="sub" style="margin-top:4px">Konsepter utenfor appen (ikke telt med): '
          +Object.entries(utenfor).map(([k,n])=>esc(k||'(tomt)')+' '+n+' rader').join(' · ')+'</div>';
      }
      html+='</div>';
    }
    if(d.hoppet_over_laast&&d.hoppet_over_laast!=='ingen'){
      html+='<p class="sub" style="margin:0 0 8px">Låste perioder hoppet over: '+esc(JSON.stringify(d.hoppet_over_laast))+'</p>';
    }
    html+='<p class="sub" style="margin:0">'+esc(d.neste||'')+'</p>';
    el.innerHTML=html;
    if(bekreft)document.getElementById('pbToken').value='';
  }catch(e){
    clearInterval(timer);
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

// ============ Produkt- og margindata (Consolidated Model) ============
// Sender BARE tokenet — ikke modell-ID-en fra panelet over. Den peker på salgsmodellen,
// og margintallene finnes bare i Consolidated Model, som serveren kjenner selv.
async function hentProduktMargin(bekreft){
  const el=document.getElementById('pmResultat');
  const knapper=['pmTorrBtn','pmHentBtn'].map(id=>document.getElementById(id));
  const aar=[2024,2025,2026].filter(a=>document.getElementById('pmAr'+a).checked);
  if(!aar.length){el.innerHTML='<span style="color:var(--d-roed)">Velg minst ett år.</span>';return;}
  // Panelet låner tokenfeltet fra hentingen over. Uten denne sjekken lot knappen seg
  // trykke med tomt felt, og svaret ble en serverfeil om App Service-konfigurasjon som
  // ikke fortalte det som faktisk manglet: tokenet, i feltet rett over.
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet over først</span>'
        +' <span class="sub">— samme token brukes til begge hentingene.</span>';
      const felt=document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  if(bekreft&&!confirm('Skrive produkt- og margindata for '+aar.join(', ')+' til databasen? Året erstattes i sin helhet.'))return;
  knapper.forEach(b=>b.disabled=true);
  const start=Date.now();
  const timer=setInterval(()=>{
    el.innerHTML='<span class="sub">Henter produktnivå… '+Math.round((Date.now()-start)/1000)+' s (seks konsepter per år)</span>';
  },1000);
  el.innerHTML='<span class="sub">Henter produktnivå…</span>';
  try{
    const qs=aar.map(a=>'ar='+a).join('&')+'&bekreft='+(bekreft?'true':'false');
    const d=await api('/api/powerbi/produkt/hent?'+qs,{method:'POST',body:{token:token||null}});
    clearInterval(timer);
    let html='<p style="margin:0 0 8px"><b>'+esc(d.status)+'</b> <span class="sub">('+Math.round((Date.now()-start)/1000)+' s)</span></p>';
    for(const [ar,s] of Object.entries(d.sammendrag||{})){
      html+=`<div style="margin-bottom:12px"><b>${esc(ar)}</b> — ${s.rader.toLocaleString('nb-NO')} rader, `
        +`${s.produkter.toLocaleString('nb-NO')} produkter, ${s.mnok} MNOK, DB ${s.db_mnok} MNOK `
        +`· <b>DG ${s.dg_pct} %</b>`;
      // Kostdekningen er hele poenget med tørrkjøringen: en grossist uten varekost gir
      // strålende marginer som ikke finnes, og det skal ses her — ikke i et tilbud.
      const svake=(s.kostdekning_per_grossist||[]).filter(g=>!g.kost_palitelig);
      if(svake.length){
        html+='<div class="table-wrap" style="margin-top:6px"><table class="d-tabell" style="min-width:380px"><thead><tr>'
          +'<th>Grossist</th><th class="tall">Omsetning</th><th class="tall">Kost</th><th class="tall">DG</th></tr></thead><tbody>'
          +svake.map(g=>`<tr><td>${esc(g.kode)}</td><td class="tall">${g.mnok}</td>`
            +`<td class="tall">${g.kost_mnok}</td>`
            +`<td style="text-align:right;font-weight:600;color:var(--d-roed)">${g.dg_pct} %</td></tr>`).join('')
          +'</tbody></table><div class="sub" style="margin-top:4px">Disse rapporterer ikke varekost — marginene deres er for høye og merkes som usikre i produktlista.</div></div>';
      }else{
        html+=' · <span style="color:var(--d-gronn);font-weight:600">alle grossister rapporterer varekost</span>';
      }
      if(s.uten_varenummer&&s.uten_varenummer.rader){
        html+=`<div class="sub" style="margin-top:4px">${s.uten_varenummer.rader.toLocaleString('nb-NO')} rader (${s.uten_varenummer.mnok} MNOK) mangler varenummer — de telles med, men kan ikke kobles til prisverktøyet.</div>`;
      }
      if(s.droppet_fram_i_tid){
        html+=`<div class="sub" style="margin-top:4px">Hoppet over ${s.droppet_fram_i_tid} rader datert etter uke ${s.siste_godtatte_uke}.</div>`;
      }
      html+='</div>';
    }
    html+='<p class="sub" style="margin:0">'+esc(d.neste||'')+'</p>';
    el.innerHTML=html;
    if(bekreft){document.getElementById('pbToken').value='';visProduktMargin();}
  }catch(e){
    clearInterval(timer);
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

async function hentPrisliste(bekreft){
  const el=document.getElementById('plResultat');
  const knapper=['plTorrBtn','plHentBtn'].map(id=>document.getElementById(id));
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet øverst først.</span>';
      const f=document.getElementById('pbToken');f.focus();f.scrollIntoView({block:'center'});
      return;
    }
  }
  if(bekreft&&!confirm('Erstatte hele leverandørprislista med den fra modellen?'))return;
  knapper.forEach(b=>b.disabled=true);
  el.innerHTML='<span class="sub">Henter prislista…</span>';
  try{
    const d=await api('/api/powerbi/prisliste/hent?bekreft='+(bekreft?'true':'false'),
                      {method:'POST',body:{token:token||null}});
    const s=d.sammendrag||{};
    el.innerHTML='<p style="margin:0 0 6px"><b>'+esc(d.status)+'</b></p>'
      +`<div>${(s.prisrader||0).toLocaleString('nb-NO')} prisrader på ${(s.produktrader||0).toLocaleString('nb-NO')} produkter `
      +`· <b>${(s.med_prisendring||0).toLocaleString('nb-NO')}</b> med registrert prisendring</div>`
      +`<div class="sub" style="margin-top:4px">${(s.uten_epd||0).toLocaleString('nb-NO')} rader mangler EPD og kan ikke kobles til prisverktøyet.`
      +' EPD-broen dekker uansett bare ca. 46 % av katalogen — resten har vi ikke innkjøpspris for her.</div>'
      +'<p class="sub" style="margin:8px 0 0">'+esc(d.neste||'Se Rapporter → Prisendringer.')+'</p>';
    if(bekreft)document.getElementById('pbToken').value='';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

async function visProduktMargin(){
  const el=document.getElementById('pmTabell');
  const btn=document.getElementById('pmVisBtn');
  btn.disabled=true;el.innerHTML='<span class="sub">Henter…</span>';
  try{
    const p=new URLSearchParams({ar:document.getElementById('pmAr').value,grense:'50'});
    const k=document.getElementById('pmKonsept').value, s=document.getElementById('pmSok').value.trim();
    if(k)p.set('konsept',k);
    if(s)p.set('sok',s);
    const d=await api('/api/produkt-margin?'+p.toString());
    if(!d.antall){el.innerHTML='<span class="sub">Ingen treff. Er dataene hentet for dette året?</span>';btn.disabled=false;return;}
    const mnok=v=>(v/1e6).toFixed(2);
    el.innerHTML='<div class="table-wrap"><table class="d-tabell" style="min-width:640px"><thead><tr>'
      +'<th>Varenr</th><th>Produkt</th><th class="tall">MNOK</th>'
      +'<th class="tall">DB MNOK</th><th class="tall">DG</th><th class="tall">Grossister</th></tr></thead><tbody>'
      +d.produkter.map(r=>`<tr><td>${esc(r.varenummer||'–')}</td>`
        +`<td>${esc(r.navn||'(uten navn)')}${r.margin_usikker?' <span class="sub" title="Minst én grossist bak tallet rapporterer ikke varekost">⚠ usikker</span>':''}</td>`
        +`<td class="tall">${mnok(r.belop)}</td>`
        +`<td class="tall">${mnok(r.db)}</td>`
        +`<td class="tall" style="font-weight:600">${r.dg_pct==null?'–':r.dg_pct+' %'}</td>`
        +`<td class="tall">${r.grossister}</td></tr>`).join('')
      +'</tbody></table></div>';
  }catch(e){ el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>'; }
  finally{ btn.disabled=false; }
}
