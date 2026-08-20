// Innstillinger > Datainnhenting: Power BI, produkt/margin og leverandorpriser.
// Skilt ut av index.html 2026-08-07.

// ============ Diagnostikk: kunde-orgnr / konsern-eksklusjon (2026-08-11) ============
async function orgnrDiagKjor(){
  const sok=document.getElementById('orgnrDiagSok').value.trim();
  const el=document.getElementById('orgnrDiagResultat');
  if(sok.length<2){el.innerHTML='<span style="color:var(--d-roed)">Skriv minst 2 tegn.</span>';return;}
  el.innerHTML='<span class="sub">Søker…</span>';
  try{
    const d=await api('/api/dashboard-excel/diagnostikk/kunde-orgnr?sok='+encodeURIComponent(sok));
    if(!d.treff.length){el.innerHTML='<span class="sub">Ingen treff i kunde_salg_uke for «'+esc(sok)+'».</span>';return;}
    let html='<table class="d-tabell" style="width:100%"><thead><tr>'
      +'<th>Kunde</th><th>Kundenr</th><th>Grossist</th><th>Konsept</th><th>Region</th><th>År</th><th style="text-align:right">Beløp</th>'
      +'<th>Orgnr</th><th>Konsern-treff</th><th>Intern-regel</th></tr></thead><tbody>';
    for(const r of d.treff){
      const konsern=r.konsern_selskap_navn
        ? `<span class="d-badge roed flat" title="${r.konsern_selskap_aktiv?'aktiv':'inaktiv'}">${esc(r.konsern_selskap_navn)}</span>`
        : '<span class="sub">–</span>';
      html+=`<tr><td>${esc(r.navn||'')}</td><td>${esc(r.kundenr||'')}</td><td>${esc(r.grossist||'')}</td>`
        +`<td>${esc(r.konsept||'(mangler)')}</td><td>${esc(r.region||'(mangler)')}</td>`
        +`<td>${esc(String(r.ar))}</td><td style="text-align:right">${Math.round(r.belop).toLocaleString('nb-NO')} kr</td>`
        +`<td>${esc(r.orgnr||'(mangler)')}</td><td>${konsern}</td>`
        +`<td>${r.intern_kunde_regel_treff?'<span class="d-badge gul flat">ja</span>':'<span class="sub">–</span>'}</td></tr>`;
    }
    html+='</tbody></table><p class="sub" style="margin-top:8px">'+esc(d.forklaring)+'</p>';
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }
}
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
    if(s.token_bufret_sekunder>0){
      linje.textContent='Token bufret enda '+Math.ceil(s.token_bufret_sekunder/60)+' min — kan kjøre hentinger uten å lime inn på nytt.';
    }else{
      linje.textContent=s.konfigurert
        ? 'Service principal er satt opp — token trengs ikke.'
        : 'Modell: '+(s.dataset_kilde||'')+'. Token må limes inn.';
    }
  }catch(e){ linje.textContent=''; }
}

// Bruker-tilbakemelding 2026-08-11 (fra Brukere-siden): manuell drag-select over
// PowerShell-kommandoen var tungvint. Kopier-knapp ved siden av <code>-blokken, samme
// mønster som kopierFeedbackPrompt (index.html) — clipboard-API krever https/localhost,
// derfor textarea-fallbacket.
async function kopierPbKommando(){
  const tekst=document.getElementById('pbKommando').textContent;
  const btn=document.getElementById('pbKopierKommandoBtn');
  try{
    await navigator.clipboard.writeText(tekst);
  }catch(e){
    const ta=document.createElement('textarea');
    ta.value=tekst;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy')}catch(_){ alert(tekst); }
    ta.remove();
  }
  if(btn){const org=btn.textContent;btn.textContent='✓ Kopiert';btn.disabled=true;
    setTimeout(()=>{btn.textContent=org;btn.disabled=false},1500);}
  if(typeof toast==='function')toast('Kommando kopiert');
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
    const paagaende=!!document.getElementById('pbPaagaendeUke')?.checked;
    const qs=aar.map(a=>'ar='+a).join('&')+'&bekreft='+(bekreft?'true':'false')
      +'&ta_med_paagaende_uke='+(paagaende?'true':'false');
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
      // Importscope + integritetsfunn (funn #1): hvilke uker som faktisk skrives, hva som
      // holdes tilbake (fersk uke som ikke er i takt), og strukturelle blokkeringer.
      // Hvor fersk modellen er, og hvor fersk importen blir. Står de likt, er alt som
      // finnes hentet inn; spriker de, sier neste linje hvorfor.
      const mh=s.modellen_har_data_til;
      if(mh&&typeof mh==='object'){
        html+=`<div class="sub" style="margin-top:4px">Modellen har omsetning t.o.m. <b>uke ${mh.uke} ${esc(mh.ukedag_navn)}</b> (${(mh.belop_den_dagen||0).toLocaleString('nb-NO')} kr den dagen).</div>`;
        const df=s.dagsfordeling_ferskeste_uke||[];
        if(df.length){
          html+='<div class="sub" style="margin-top:2px">Uke '+mh.uke+' dag for dag: '
            +df.map(d=>esc(d.ukedag_navn)+' '+(d.belop||0).toLocaleString('nb-NO')+' kr').join(' · ')+'</div>';
        }
      }else if(mh){
        html+='<div class="sub" style="margin-top:4px">Modellen ga ingen dagsdata.</div>';
      }
      if(s.importeres_til_uke!=null){
        html+=`<div class="sub" style="margin-top:4px">Importeres til og med uke <b>${s.importeres_til_uke}</b>.</div>`;
      }
      const tv=(s.advarsler||{}).tvunget_inn;
      if(tv){
        html+=`<div style="margin-top:6px;color:var(--d-gul,#b8860b);font-weight:600">⚠ Pågående uke tatt inn på tvers av avvik: uke ${(tv.uker||[]).join(', ')}</div>`
          +`<div class="sub" style="color:var(--d-gul,#b8860b)">${esc(tv.merknad||'')}</div>`;
      }
      const fh=s.fersk_omsetning_holdt_tilbake;
      if(fh){
        html+=`<div style="margin-top:6px;color:var(--d-gul,#b8860b);font-weight:600">⚠ Modellen er ferskere enn importen: modellen har data til ${esc(fh.modellen_til)}, men det skrives bare ${esc(fh.importeres_til)}.</div>`
          +`<div class="sub" style="color:var(--d-gul,#b8860b)">${esc(fh.arsak)}</div>`;
      }
      const bf=s.blokkerende_funn||{};
      if(bf.konsepter_mangler_i_uttrekk){
        html+='<div style="margin-top:6px;color:var(--d-roed);font-weight:600">⛔ Strukturell feil — importen blokkeres for dette året:</div>'
          +'<div class="sub" style="color:var(--d-roed)">Forventet konsept mangler helt i uttrekket, men har data i DB (trolig navnebytte / brutt relasjon i modellen): '
          +bf.konsepter_mangler_i_uttrekk.map(x=>esc(x.konsept)+' ('+x.eksisterende_mnok+' MNOK)').join(', ')+'</div>';
      }
      const adv=s.advarsler||{};
      const holdt=adv.uker_holdt_tilbake;
      if(holdt){
        html+=`<div style="margin-top:6px;color:var(--d-gul,#b8860b);font-weight:600">⚠ Uker holdt tilbake (fersk/uferdig data — grossist- og kundenivå ikke i takt ennå, importeres senere): uke ${(holdt.tilbakeholdte_uker||[]).join(', ')}</div>`;
        const av=(holdt.dekningsavvik||[]).slice(0,8);
        if(av.length){
          html+='<div class="table-wrap" style="margin-top:4px"><table class="d-tabell" style="min-width:440px"><thead><tr>'
            +'<th>Grossist</th><th>Konsept</th><th class="tall">Uke</th><th class="tall">Grossist kr</th><th class="tall">Kunde kr</th><th class="tall">Avvik</th></tr></thead><tbody>'
            +av.map(x=>`<tr><td>${esc(x.grossist)}</td><td>${esc(x.konsept)}</td><td class="tall">${x.uke}</td><td class="tall">${(x.grossist_kr||0).toLocaleString('nb-NO')}</td><td class="tall">${(x.kunde_kr||0).toLocaleString('nb-NO')}</td><td class="tall" style="color:var(--d-gul,#b8860b)">${(x.avvik_kr||0).toLocaleString('nb-NO')}</td></tr>`).join('')
            +'</tbody></table></div>';
        }
      }
      if(adv.forventede_konsepter_uten_data){
        html+='<div class="sub" style="margin-top:4px">Forventede konsepter uten data (verken i uttrekk eller DB) — kontroller om de faktisk er lansert: '
          +adv.forventede_konsepter_uten_data.map(esc).join(', ')+'</div>';
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
      // vs_konsept_grossist_uke: samme sjekk som avdekket Fast Food- og Foodbroker-
      // dekningsgapene 2026-08-11 — produktnivå (denne hentingen) mot konsept_grossist_uke
      // (Total 3 år, ingen produktkobling). Stor differanse = samme mønster her også.
      const vs=(s.vs_konsept_grossist_uke||[]).filter(v=>v.differanse_pct!=null);
      if(vs.length){
        const storeGap=vs.filter(v=>Math.abs(v.differanse_pct)>10);
        html+='<div class="table-wrap" style="margin-top:8px"><table class="d-tabell" style="min-width:420px"><thead><tr>'
          +'<th>Konsept</th><th class="tall">Produktnivå</th><th class="tall">Total 3 år (uten produkt)</th><th class="tall">Differanse</th></tr></thead><tbody>'
          +vs.map(v=>`<tr><td>${esc(v.konsept)}</td><td class="tall">${v.produkt_mnok}</td>`
            +`<td class="tall">${v.konsept_grossist_uke_mnok}</td>`
            +`<td style="text-align:right;font-weight:${Math.abs(v.differanse_pct)>10?600:400};color:${Math.abs(v.differanse_pct)>10?'var(--d-roed)':'inherit'}">${v.differanse_pct} %</td></tr>`).join('')
          +'</tbody></table>'
          +(storeGap.length
            ? `<div class="sub" style="margin-top:4px;color:var(--d-roed)">${storeGap.map(v=>esc(v.konsept)).join(', ')}: produktnivå fanger vesentlig mindre enn Total 3 år — samme mønster som Fast Food/Foodbroker-sakene, verdt å granske.</div>`
            : '<div class="sub" style="margin-top:4px">Ingen konsept med stort avvik — produktnivå ser ut til å dekke det samme som Total 3 år.</div>')
          +'</div>';
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

// ============ Fast Food: kundeliste fra Segment1 (erstatter 100TNOK-Excel-fila) ============
async function hentFastFoodKunderFraSegment(bekreft){
  const el=document.getElementById('ffkResultat');
  const knapper=['ffkTorrBtn','ffkHentBtn'].map(id=>document.getElementById(id));
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet øverst først</span>'
        +' <span class="sub">— samme token brukes til alle hentingene.</span>';
      const felt=document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  if(bekreft&&!confirm('Erstatte Fast Food-kundelista med hele Segment1=FASTFOOD fra modellen? Kunder som faller ut deaktiveres (slettes ikke).'))return;
  knapper.forEach(b=>b.disabled=true);
  el.innerHTML='<span class="sub">Henter kundeliste fra Segment1…</span>';
  try{
    const d=await api('/api/fastfood/kunder/hent-fra-segment?bekreft='+(bekreft?'true':'false'),
                      {method:'POST',body:{token:token||null}});
    const s=d.sammendrag||{};
    let html='<p style="margin:0 0 8px"><b>'+esc(d.status)+'</b></p>';
    html+=`<div>${(s.funnet_i_modellen||0).toLocaleString('nb-NO')} funnet i modellen · `
      +`<b>${(s.gyldige_kunder||0).toLocaleString('nb-NO')}</b> gyldige · `
      +`${(s.nye_kunder||0).toLocaleString('nb-NO')} nye · ${(s.oppdaterte||0).toLocaleString('nb-NO')} oppdaterte`
      +(s.deaktiveres_falt_ut?` · <span style="color:var(--d-gul)">${s.deaktiveres_falt_ut} faller ut (deaktiveres)</span>`:'')+'</div>';
    if(s.ugyldig_kundekonto_format){
      html+=`<div class="sub" style="margin-top:4px">${s.ugyldig_kundekonto_format} rader hadde et kundekonto-format som ikke matcher DNN-mønsteret — hoppet over.</div>`;
    }
    if(s.gyldige_kunder){
      const orgnrOk=s.med_orgnr||0, andel=Math.round(100*orgnrOk/s.gyldige_kunder);
      html+=`<div class="sub" style="margin-top:4px">${orgnrOk.toLocaleString('nb-NO')} av ${s.gyldige_kunder.toLocaleString('nb-NO')} (${andel} %) fikk orgnr med — det panel 5 bruker til å plassere salg hos andre grossister riktig. Lavt tall her betyr panel 5 faller tilbake til det svakere kundenr-matchet.</div>`;
    }
    html+='<p class="sub" style="margin:8px 0 0">'+esc(d.neste||'')+'</p>';
    el.innerHTML=html;
    if(bekreft)document.getElementById('pbToken').value='';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

// ============ Fast Food: produkt per kunde (fastfood.py fase 2) ============
async function hentFastFoodProduktPerKunde(bekreft){
  const el=document.getElementById('ffpResultat');
  const knapper=['ffpTorrBtn','ffpHentBtn'].map(id=>document.getElementById(id));
  const aar=[2024,2025,2026].filter(a=>document.getElementById('ffpAr'+a).checked);
  if(!aar.length){el.innerHTML='<span style="color:var(--d-roed)">Velg minst ett år.</span>';return;}
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet øverst først</span>'
        +' <span class="sub">— samme token brukes til alle hentingene.</span>';
      const felt=document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  if(bekreft&&!confirm('Skrive produkt per Fast Food-kunde for '+aar.join(', ')+' til databasen? Året erstattes i sin helhet.'))return;
  knapper.forEach(b=>b.disabled=true);
  const start=Date.now();
  el.innerHTML='<span class="sub">Starter henting…</span>';
  try{
    // Kjører som BAKGRUNNSJOBB (rettet 2026-08-12): et synkront kall som tar 10+ minutter
    // blir stille kuttet av Azure App Service sin front-end-timeout lenge før jobben er
    // ferdig. Se app/jobber.py. Denne funksjonen bare starter jobben og poller status.
    const qs=aar.map(a=>'ar='+a).join('&')+'&bekreft='+(bekreft?'true':'false');
    const start_svar=await api('/api/fastfood/produkt-per-kunde/hent?'+qs,{method:'POST',body:{token:token||null}});
    const jobbId=start_svar.jobb_id;
    let j=null;
    while(true){
      await new Promise(r=>setTimeout(r,3000));
      const sek=Math.round((Date.now()-start)/1000);
      try{
        j=await api('/api/jobb/'+jobbId);
      }catch(e){
        el.innerHTML=`<span class="sub">Kjører… ${sek} s (mistet kontakt med statussjekken et øyeblikk, prøver igjen)</span>`;
        continue;
      }
      if(j.status==='kjorer'){
        el.innerHTML=`<span class="sub">${esc(j.fremdrift||'Kjører…')} (${sek} s)</span>`;
        continue;
      }
      break;
    }
    if(j.status==='feilet'){
      el.innerHTML='<span style="color:var(--d-roed)">Jobben feilet: '+esc(j.feilmelding||'ukjent feil')+'</span>';
      return;
    }
    const d=j.resultat;
    let html='<p style="margin:0 0 8px"><b>'+esc(d.status)+'</b> <span class="sub">('+Math.round((Date.now()-start)/1000)+' s)</span></p>';
    for(const [ar,s] of Object.entries(d.sammendrag||{})){
      html+=`<div style="margin-bottom:8px"><b>${esc(ar)}</b> — `
        +`<b>${s.ekte_kundeomsetning_mnok!=null?s.ekte_kundeomsetning_mnok+' MNOK':'–'}</b> ekte kundeomsetning `
        +`(${(s.ekte_kunder_med_salg||0).toLocaleString('nb-NO')} kunder) — dette skrives som kundens totale omsetning/DG.</div>`;
      html+=`<div style="margin-bottom:8px" class="sub">Produktmiks (egen, delvis kilde — kun til «vis produkter» per kunde): `
        +`${s.rader.toLocaleString('nb-NO')} rader, ${s.kunder_med_treff.toLocaleString('nb-NO')} kunder med treff, `
        +`${s.produkter.toLocaleString('nb-NO')} produkter, ${s.mnok} MNOK — vesentlig lavere enn kundeomsetningen over er FORVENTET `
        +`(produktkoblingen i modellen dekker ikke alt salget for dette segmentet).</div>`;
      if(s.matchet_pa_kundekonto){
        html+=`<div class="sub" style="margin-top:2px">${s.matchet_pa_kundekonto.toLocaleString('nb-NO')} rader matchet direkte på kundekonto (primærveien — bør være så godt som alle).</div>`;
      }
      if(s.matchet_pa_orgnr){
        html+=`<div class="sub" style="margin-top:2px">${s.matchet_pa_orgnr.toLocaleString('nb-NO')} rader matchet på organisasjonsnummer hos en annen grossist enn kunden ble registrert med — tatt med (sikker match, samme reelle bedrift).</div>`;
      }
      if(s.matchet_pa_annen_grossist){
        html+=`<div class="sub" style="margin-top:2px">${s.matchet_pa_annen_grossist.toLocaleString('nb-NO')} rader matchet på kundenr alene (orgnr manglet) hos en annen grossist enn kunden ble registrert med — tatt med.</div>`;
      }
      if(s.matchet_pa_navn){
        html+=`<div class="sub" style="margin-top:2px">${s.matchet_pa_navn.toLocaleString('nb-NO')} rader matchet på kundenavn (kundenr var tvetydig og orgnr manglet) — tatt med.</div>`;
      }
      if(s.kundenr_utenfor_lista){
        html+=`<div class="sub" style="margin-top:2px">${s.kundenr_utenfor_lista.toLocaleString('nb-NO')} rader matchet ingen Fast Food-kunde i det hele tatt — droppet.</div>`;
      }
      if(s.annen_bedrift_kundenr_kollisjon){
        html+=`<div class="sub" style="margin-top:2px">${s.annen_bedrift_kundenr_kollisjon.toLocaleString('nb-NO')} rader droppet: kundenr deles med en Fast Food-kunde, men navnet i modellen viser at det er en helt annen bedrift — trygt ekskludert, ingen handling nødvendig.</div>`;
      }
      if(s.kundenr_tvetydig_droppet){
        html+=`<div class="sub" style="margin-top:2px">${s.kundenr_tvetydig_droppet.toLocaleString('nb-NO')} rader droppet: kundenr er tvetydig OG navnet i modellen mangler eller matcher flere kandidater — kunne ikke avgjøre hvilken.</div>`;
      }
      if(s.droppet_fram_i_tid){
        html+=`<div class="sub" style="margin-top:2px">Hoppet over ${s.droppet_fram_i_tid} rader datert fram i tid.</div>`;
      }
      html+='</div>';
    }
    // tvetydige_kundenr_detaljer / annen_bedrift_detaljer viser de FAKTISKE radene som ikke
    // lot seg plassere — kjente kandidater (hvem kundenr ELLERS tilhører) OG hvilken
    // grossist/navn den ukjente raden faktisk hadde. Delt i to lister siden bruker-
    // tilbakemelding 2026-08-11 påpekte at «kunne ikke avgjøre hvilken» var misvisende når
    // radens navn tydelig viser at det er en helt annen, urelatert bedrift (D06 Tønsberg
    // Fisk AS o.l.) — det er ikke en uløst tvetydighet, bare en kundenr-kollisjon uten
    // videre betydning.
    const lagDetaljListe=(tittel, liste, farge)=>{
      if(!liste.length)return'';
      const vis=liste.slice(0,30);
      const sum=liste.reduce((s,t)=>s+(t.sum_belop||0),0);
      let h=`<details style="margin:0 0 8px"><summary class="sub" style="cursor:pointer">`
        +`${liste.length.toLocaleString('nb-NO')} ${tittel} (~${Math.round(sum/1000).toLocaleString('nb-NO')} TNOK) — vis eksempler</summary>`
        +'<div style="margin-top:6px;max-height:320px;overflow:auto" class="sub">';
      for(const t of vis){
        const kjente=(t.kjente_kandidater||[]).map(k=>`${esc(k.kundekonto)} ${esc(k.kundenavn||'')}`.trim()).join(' vs. ');
        const ukjente=(t.ukjente_rader||[]).map(u=>`${esc(u.grossist_kode)} ${esc(u.kundenavn||'')} (${Math.round(u.belop).toLocaleString('nb-NO')} kr)`.trim()).join(', ');
        h+=`<div style="margin-bottom:6px"><b>kundenr ${esc(t.kundenr)}</b> — kjent: ${kjente || '(ingen registrert)'}<br>`
          +`<span style="color:var(${farge})">droppet:</span> ${ukjente || '(ukjent kilde)'}</div>`;
      }
      if(liste.length>vis.length){
        h+=`<div>… og ${(liste.length-vis.length).toLocaleString('nb-NO')} til.</div>`;
      }
      return h+'</div></details>';
    };
    html+=lagDetaljListe('kundenr kunne IKKE avgjøres (navn manglet eller var flertydig)', d.tvetydige_kundenr_detaljer||[], '--d-roed');
    html+=lagDetaljListe('kundenr trygt ekskludert (navnet viser en annen bedrift — ingen handling nødvendig)', d.annen_bedrift_detaljer||[], '--d-graa');
    if(!(d.tvetydige_kundenr_detaljer||[]).length && !(d.annen_bedrift_detaljer||[]).length && (d.tvetydige_kundenr||[]).length){
      html+=`<div class="sub" style="margin:0 0 8px">${d.tvetydige_kundenr.length.toLocaleString('nb-NO')} kundenr deler flere Fast Food-kunder i kundelista, men ingen av dem forårsaket droppede rader denne kjøringen.</div>`;
    }
    html+='<p class="sub" style="margin:0">'+esc(d.neste||'')+'</p>';
    el.innerHTML=html;
    if(bekreft)document.getElementById('pbToken').value='';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

// ============ Alle kunder: produktmiks (kunde_produkt.py) ============
async function hentKundeProduktMiks(bekreft){
  const el=document.getElementById('kpResultat');
  const knapper=['kpTorrBtn','kpHentBtn'].map(id=>document.getElementById(id));
  const aar=document.querySelector('input[name="kpAr"]:checked')?.value;
  if(!aar){el.innerHTML='<span style="color:var(--d-roed)">Velg et år.</span>';return;}
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet øverst først</span>'
        +' <span class="sub">— samme token brukes til alle hentingene.</span>';
      const felt=document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  const full=document.getElementById('kpFull').checked;
  if(bekreft&&!confirm('Skrive produktmiks for ALLE kunder ('+aar+(full?', HELE året':', bare ferskeste data')+') til databasen?'))return;
  knapper.forEach(b=>b.disabled=true);
  const start=Date.now();
  el.innerHTML='<span class="sub">Starter henting…</span>';
  try{
    const start_svar=await api('/api/kunde-produkt/hent?ar='+aar+'&bekreft='+(bekreft?'true':'false')+'&full='+(full?'true':'false'),
      {method:'POST',body:{token:token||null}});
    const jobbId=start_svar.jobb_id;
    let j=null;
    while(true){
      await new Promise(r=>setTimeout(r,3000));
      const sek=Math.round((Date.now()-start)/1000);
      try{
        j=await api('/api/jobb/'+jobbId);
      }catch(e){
        el.innerHTML=`<span class="sub">Kjører… ${sek} s (mistet kontakt med statussjekken et øyeblikk, prøver igjen)</span>`;
        continue;
      }
      if(j.status==='kjorer'){
        el.innerHTML=`<span class="sub">${esc(j.fremdrift||'Kjører…')} (${sek} s)</span>`;
        continue;
      }
      break;
    }
    if(j.status==='feilet'){
      el.innerHTML='<span style="color:var(--d-roed)">Jobben feilet: '+esc(j.feilmelding||'ukjent feil')+'</span>';
      return;
    }
    const d=j.resultat;
    const s=d.sammendrag||{};
    const p=s.periode||{};
    let html='<p style="margin:0 0 8px"><b>'+esc(d.status)+'</b> <span class="sub">('+Math.round((Date.now()-start)/1000)+' s)</span></p>';
    if(p.modus){
      html+=`<div class="sub" style="margin-bottom:8px">Modus: <b>${p.modus==='full'?'full — hele året':'ferskeste data'}</b>`
        // Hoppede måneder har to helt ulike grunner, og å kalle begge «hentet+låst» var
        // direkte misvisende: i full-modus er de hoppet over fordi de ikke har VÆRT ennå.
        // siste_reelle_maaned kommer fra backend (_manedene_a_hente) og skiller dem.
        +(p.hoppet_over&&p.hoppet_over.length
            ? (p.siste_reelle_maaned
                ? `, hoppet over ${p.hoppet_over.length} måned(er): ${p.hoppet_over.join(', ')} `
                  + `(${p.modus==='full' ? 'ikke vært ennå' : 'allerede hentet+låst, eller ikke vært ennå'})`
                : `, hoppet over ${p.hoppet_over.length} måned(er) som allerede var hentet+låst: ${p.hoppet_over.join(', ')}`)
            : '')
        +(s.maneder_hentet_denne_kjoringen?`. Hentet nå: ${s.maneder_hentet_denne_kjoringen.join(', ')}.`:'.')+'</div>';
    }
    if(s.mnok_totalt_etter_kjoring!=null){
      html+=`<div style="margin-bottom:8px"><b>${s.mnok_totalt_etter_kjoring} MNOK</b> produktmiks-omsetning totalt for året etter denne kjøringen `
        +`(${s.mnok_denne_kjoringen} MNOK hentet nå) `
        +`(${(s.unike_kunder_med_produktrader||0).toLocaleString('nb-NO')} av ${(s.kundekontoer_i_modellen||0).toLocaleString('nb-NO')} kundekontoer i denne kjøringen, `
        +`${(s.produkter||0).toLocaleString('nb-NO')} produkter, ${(s.rader||0).toLocaleString('nb-NO')} rader)</div>`;
      html+=`<div class="sub" style="margin-bottom:8px">Referanse (kunde × år, uten produktkobling): ${s.referanse_mnok_uten_produktkobling} MNOK — `
        +`<b>dekning ${s.dekning_pct!=null?s.dekning_pct+' %':'–'}</b>. Bør være nær 100 %.</div>`;
    }
    if(s.uten_produktkobling&&s.uten_produktkobling.rader){
      html+=`<div class="sub" style="margin-bottom:8px">${s.uten_produktkobling.rader.toLocaleString('nb-NO')} rader (${s.uten_produktkobling.mnok} MNOK) mangler varenummer — telles med, men kan ikke kobles til prisverktøyet.</div>`;
    }
    html+='<p class="sub" style="margin:0">'+esc(d.neste||'')+'</p>';
    el.innerHTML=html;
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

// ============ Kundenumre som er samme kunde (2026-08-19) ============
// Bakgrunn: D22 ga Cici Kirkegata/Cici Osteria/Maximus nye kundenumre etter et eierskifte,
// og Ukerapporten viste tre av våre største kunder som nye. Se konseptsuite-backend
// app/kundekonto.py — navnet er den eneste koblingen som overlever et org.nr-bytte.

async function hentKundenavn(bekreft){
  const el=document.getElementById('kkResultat');
  const knapper=['kkNavnTorrBtn','kkNavnBtn'].map(id=>document.getElementById(id));
  const token=document.getElementById('pbToken').value.trim();
  if(!token){
    let sp=false;
    try{ sp=(await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML='<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet øverst først.</span>';
      const f=document.getElementById('pbToken');f.focus();f.scrollIntoView({block:'center'});
      return;
    }
  }
  knapper.forEach(b=>b.disabled=true);
  el.innerHTML='<span class="sub">Henter kundenavn fra kundedimensjonen…</span>';
  try{
    const d=await api('/api/kundekonto/hent-navn?bekreft='+(bekreft?'true':'false'),
                      {method:'POST',body:{token:token||null}});
    const s=d.sammendrag||{};
    el.innerHTML='<p style="margin:0 0 6px"><b>'+esc(d.status)+'</b></p>'
      +`<div>${(s.kontoer||0).toLocaleString('nb-NO')} kundekontoer i kundedimensjonen · `
      +`${(s.uten_navn||0).toLocaleString('nb-NO')} uten navn`
      +(s.navn_lik_kundenr?` · ${s.navn_lik_kundenr.toLocaleString('nb-NO')} har kundenummeret som navn`:'')
      +(s.rader_uten_kontonokkel?` · ${s.rader_uten_kontonokkel} rader uten Dxx-kontonøkkel (hoppet over)`:'')+'</div>'
      +'<p class="sub" style="margin:8px 0 0">'+esc(d.neste||'')+'</p>';
    if(bekreft)document.getElementById('pbToken').value='';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

function kkGruppeHtml(g){
  const rader=(g.kontoer||[]).map(k=>{
    const periode=(k.forste_ar?`${k.forste_ar} uke ${k.forste_uke}`:'–')
      +' → '+(k.siste_ar?`${k.siste_ar} uke ${k.siste_uke}`:'–');
    return `<tr>
      <td>${esc(k.grossist_kode||'–')}</td>
      <td><b>${esc(k.kundenr)}</b> ${k.gjeldende
          ? '<span class="rap-new-concept">gjeldende</span>'
          : '<span class="sub">tidligere</span>'}</td>
      <td class="sub">${esc(k.orgnr||'–')}</td>
      <td class="sub">${esc(periode)}</td>
      <td class="tall">${fmtKr(k.oms_2025||0)}</td>
      <td class="tall">${fmtKr(k.oms_2026||0)}</td>
    </tr>`;
  }).join('');
  return `<details style="margin:6px 0;border-top:1px solid var(--d-kantlinje);padding-top:6px">
    <summary style="cursor:pointer"><b>${esc(g.navn||'(uten navn)')}</b>
      <span class="sub"> — ${(g.kontoer||[]).length} kundenumre hos ${g.antall_grossister} grossist${g.antall_grossister===1?'':'er'}
      · ${fmtKr((g.oms_2025||0)+(g.oms_2026||0))} ekstern${g.oms_intern?' · '+fmtKr(g.oms_intern)+' intern':''}</span>
      ${g.renummerert?'<span class="rap-new-concept">renummerert</span>':''}
      <span class="sub" title="Signalet som knyttet kontoene sammen">koblet på ${esc((g.koblet_paa||[]).join(' + ')||'navn')}</span></summary>
    <div style="overflow-x:auto"><table class="d-tabell"><thead><tr>
      <th>Grossist</th><th>Kundenr</th><th>Org.nr</th><th>Første → siste kjøp</th>
      <th class="tall">2025</th><th class="tall">2026</th>
    </tr></thead><tbody>${rader}</tbody></table></div>
  </details>`;
}

async function kkKontroll(){
  const el=document.getElementById('kkResultat');
  const btn=document.getElementById('kkKontrollBtn');
  btn.disabled=true;
  el.innerHTML='<span class="sub">Kjører kontroll over alle grossister…</span>';
  try{
    const gr=document.getElementById('kkGrossist').value.trim();
    const sok=document.getElementById('kkSok').value.trim();
    const qs='?kun_renummerering='+(document.getElementById('kkKunRenum').checked?'true':'false')
      +'&kun_flere_grossister='+(document.getElementById('kkKunFlereGr').checked?'true':'false')
      +(gr?'&grossist_kode='+encodeURIComponent(gr):'')
      +(sok?'&sok='+encodeURIComponent(sok):'');
    const d=await api('/api/kundekonto/kontroll'+qs);
    const s=d.sammendrag||{};
    let html='<p style="margin:0 0 6px"><b>'+esc(d.status)+'</b></p>'
      +kkUtdatertVarsel(d.gruppering_status)
      +`<div>${(s.kontoer_totalt||0).toLocaleString('nb-NO')} kundekontoer med salg · `
      +`<b>${(s.grupper||0).toLocaleString('nb-NO')}</b> grupper med mer enn ett kundenummer `
      +`(${(s.kontoer_i_grupper||0).toLocaleString('nb-NO')} kontoer)</div>`
      +`<div style="margin-top:2px">Derav <b>${(s.grupper_med_renummerering||0).toLocaleString('nb-NO')}</b> renummereringer hos samme grossist · `
      +`<b>${(s.grupper_med_flere_grossister||0).toLocaleString('nb-NO')}</b> kunder hos flere grossister `
      +`(${(s.grupper_koblet_kun_paa_orgnr||0).toLocaleString('nb-NO')} funnet kun via org.nr) · `
      +`${(s.kontoer_som_blir_historiske||0).toLocaleString('nb-NO')} kundenumre blir merket som tidligere</div>`;
    if(s.kontoer_uten_brukbart_navn){
      const dg=s.uten_navn_diagnose||{};
      const TEKST={
        mangler_navnerad:'ingen rad i kundedimensjonen for (grossist, kundenr) — kontoen finnes i salgsdataene, men ikke i navneuttrekket',
        navnerad_uten_navn:'raden finnes, men navnefeltet er tomt i modellen',
        navn_er_kundenr:'navnet ER kundenummeret — modellen har ikke noe navn å gi',
        navn_for_kort:'navnet er for kort til å identifisere en kunde'
      };
      html+=`<div class="sub" style="margin-top:6px"><b>${s.kontoer_uten_brukbart_navn.toLocaleString('nb-NO')}</b> kontoer mangler brukbart navn og kan ikke grupperes på navn`
        +(dg.ekstern_omsetning?` (${fmtKr(dg.ekstern_omsetning)} ekstern omsetning)`:'')+'. Fordelt på årsak:</div>';
      html+='<ul class="sub" style="margin:4px 0 0 18px">'
        +Object.entries(dg.per_arsak||{}).map(([k,v])=>
          `<li><b>${v.toLocaleString('nb-NO')}</b> — ${esc(TEKST[k]||k)}</li>`).join('')
        +'</ul>';
      if((dg.eksempler||[]).length){
        html+='<details class="sub" style="margin-top:4px"><summary style="cursor:pointer">Vis de største uten navn</summary>'
          +'<div style="overflow-x:auto"><table class="d-tabell"><thead><tr><th>Grossist</th><th>Kundenr</th><th>Org.nr</th><th>Årsak</th><th class="tall">Omsetning</th></tr></thead><tbody>'
          +dg.eksempler.map(e=>`<tr><td>${esc(e.grossist_kode||'–')}</td><td>${esc(e.kundenr)}</td>`
            +`<td>${esc(e.orgnr||'–')}</td><td>${esc(e.grunn)}</td>`
            +`<td class="tall">${fmtKr(e.omsetning||0)}</td></tr>`).join('')
          +'</tbody></table></div></details>';
      }
    }
    (s.grupper_forkastet_for_store||[]).forEach(f=>{
      html+=`<div class="sub" style="margin-top:4px;color:var(--d-gul)">«${esc(f.navn||f.navn_nokkel)}» har ${f.antall_kontoer} kontoer og er hoppet over — det ser ut som en samlepost hos grossisten, ikke ett kundenavn.</div>`;
    });
    html+=`<p class="sub" style="margin:8px 0 4px">Viser ${(d.grupper||[]).length} av ${d.antall_i_utvalg||0} i utvalget`
      +(d.avkortet?` (${d.avkortet} til er ikke vist)`:'')+'.</p>';
    html+=(d.grupper||[]).map(kkGruppeHtml).join('')||'<div class="sub">Ingen grupper i utvalget.</div>';
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{btn.disabled=false;}
}

async function kkKjor(){
  if(!confirm('Lagre grupperingen? Kundekortene vil deretter vise samlet historikk på tvers av kundenummerbytte. Kontrollen kan kjøres på nytt når som helst — grupperingen bygges alltid fra salgsdataene.'))return;
  const el=document.getElementById('kkResultat');
  const btn=document.getElementById('kkKjorBtn');
  btn.disabled=true;
  el.innerHTML='<span class="sub">Lagrer gruppering…</span>';
  try{
    const d=await api('/api/kundekonto/kjor',{method:'POST'});
    const s=d.sammendrag||{};
    el.innerHTML='<p style="margin:0 0 6px"><b>'+esc(d.status)+'</b></p>'
      +`<div><b>${(d.grupper_skrevet||0).toLocaleString('nb-NO')}</b> grupper · `
      +`${(d.kontoer_skrevet||0).toLocaleString('nb-NO')} kundenumre · `
      +`${(s.grupper_med_renummerering||0).toLocaleString('nb-NO')} renummereringer</div>`
      +'<p class="sub" style="margin:8px 0 0">'+esc(d.neste||'')+'</p>';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{btn.disabled=false;}
}

// Dublette KUNDERADER i CRM — en annen ting enn grupperingen over. Grupperingen samler
// salgskontoene; kunderadene står urørt. Kragerø Resort har tre kunderader på samme
// org.nr som alle nå viser samme historikk, men fortsatt er tre rader i kundelista.
// Denne visningen leser bare — ingenting slås sammen.
// Hva salgsdataene sier om hvert dublettsett — samme tekster som backend sender med i
// tørrkjøringen, her fordi lista viser dem per sett.
// Advarsel når den lagrede grupperingen er eldre enn navnene. Da er alle «kontoer uten
// gruppe» sannsynligvis bare et resultat av rekkefølgen, ikke av manglende data.
function kkUtdatertVarsel(st){
  if(!st||!st.utdatert)return '';
  return '<div style="background:var(--d-gul-bg);color:var(--d-gul);border:1px solid #E9D9A8;'
    +'border-radius:6px;padding:8px 12px;margin:6px 0;font-size:12.5px">'
    +'⚠ Kundenavnene er hentet <b>etter</b> at grupperingen sist ble lagret'
    +(st.navn_hentet?' ('+esc(st.navn_hentet.slice(0,16).replace('T',' '))+' mot '
      +esc((st.gruppering_lagret||'aldri').slice(0,16).replace('T',' '))+')':'')
    +'. Grupperingen står da på de gamle navnene. Kjør <b>Lagre gruppering</b> på nytt før du går videre.</div>';
}

const KK_GRUNN={
  en_kontogruppe:'Alle kundekontoene på org.nr-et hører til samme kunde.',
  en_kundekonto:'Org.nr-et har bare én kundekonto — det finnes bare ett sted å være.',
  flere_kontogrupper:'Salgsdataene viser FLERE utsalgssteder på dette org.nr-et (kjede). Å slå sammen ville blandet stedene.',
  kontoer_uten_gruppe:'Org.nr-et har kundekontoer som ikke er med i noen gruppe — kjør grupperingen på nytt, eller så mangler de navn.',
  ingen_salgsdata:'Ingen av kunderadene har kjøpt noe. Uten salgsdata finnes det ingenting å bekrefte med.'
};

async function kkDuplikater(){
  const el=document.getElementById('kkDupResultat');
  const btn=document.getElementById('kkDupBtn');
  btn.disabled=true;
  el.innerHTML='<span class="sub">Leter etter dublette kunderader…</span>';
  try{
    const sok=document.getElementById('kkSok').value.trim();
    const d=await api('/api/kundekonto/duplikater'+(sok?'?sok='+encodeURIComponent(sok):''));
    let html=kkUtdatertVarsel(d.gruppering_status)
      +`<p style="margin:0 0 6px"><b>${(d.antall_sett||0).toLocaleString('nb-NO')} sett med dublette kunderader</b> `
      +`(${(d.antall_rader||0).toLocaleString('nb-NO')} rader) · `
      +`<b>${(d.antall_sikre||0).toLocaleString('nb-NO')}</b> bekreftet av salgsdataene og klare til sammenslåing</p>`
      +((Object.keys(d.ikke_bekreftet_per_grunn||{}).length)
        ? '<ul class="sub" style="margin:0 0 8px 18px">'
          +Object.entries(d.ikke_bekreftet_per_grunn).map(([k,v])=>
            `<li><b>${v.toLocaleString('nb-NO')}</b> ikke bekreftet — ${esc(KK_GRUNN[k]||k)}</li>`).join('')
          +'</ul>' : '')
      +'<p class="sub" style="margin:0 0 8px">Dette er en oversikt — ingenting er slått sammen. Grupperingen over samler salgskontoene; kunderadene i CRM står urørt.</p>';
    if(d.antall_i_utvalg===0){
      el.innerHTML=html+'<div class="sub">Ingen dublette kunderader i utvalget.</div>';
      return;
    }
    html+=(d.sett||[]).map(sett=>{
      const rader=(sett.kunder||[]).map(k=>{
        const innhold=Object.entries(k.innhold||{})
          .map(([t,n])=>`${esc(t)} ${n}`).join(' · ')||'ingenting';
        return `<tr${k.id===sett.foreslatt_beholdt?' style="font-weight:600"':''}>
          <td>${k.id===sett.foreslatt_beholdt?'▸ ':''}${esc(k.navn||'(uten navn)')}</td>
          <td class="sub">${esc(k.kundekonto||'–')}</td>
          <td class="sub">${esc(k.grossister||'–')}</td>
          <td class="sub">${esc(k.selger||'ingen')}</td>
          <td class="sub">${esc(k.status||'–')}</td>
          <td class="sub">${innhold}</td></tr>`;
      }).join('');
      return `<details style="margin:6px 0;border-top:1px solid var(--d-kantlinje);padding-top:6px">
        <summary style="cursor:pointer"><b>${esc(sett.kunder[0].navn||sett.orgnr)}</b>
          <span class="sub"> — ${sett.antall_rader} kunderader · org.nr ${esc(sett.orgnr)}</span>
          <span class="rap-new-concept" title="${esc(KK_GRUNN[sett.grunn]||sett.grunn||'')}">${sett.sikkerhet==='orgnr'?'ikke bekreftet':'bekreftet'}</span></summary>
        <div style="overflow-x:auto"><table class="d-tabell"><thead><tr>
          <th>Kundenavn</th><th>Kundekonto</th><th>Grossister</th><th>Selger</th><th>Status</th><th>Innhold</th>
        </tr></thead><tbody>${rader}</tbody></table></div>
        <p class="sub" style="margin:6px 0 0">▸ = raden som bærer mest innhold. Et forslag til hvilken som bør beholdes, ikke et vedtak.</p>
      </details>`;
    }).join('');
    if(d.avkortet)html+=`<p class="sub" style="margin:8px 0 0">${d.avkortet} sett til er ikke vist.</p>`;
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{btn.disabled=false;}
}

async function kkSlaaSammen(bekreft){
  const el=document.getElementById('kkSamResultat');
  const knapper=['kkSamTorrBtn','kkSamBtn'].map(id=>document.getElementById(id));
  const orgnr=document.getElementById('kkSamOrgnr').value.trim();
  const overstyr=document.getElementById('kkSamOverstyr').checked;
  if(overstyr&&!orgnr){
    el.innerHTML='<span style="color:var(--d-roed)">Overstyring krever et org.nr — den gjelder én kunde om gangen.</span>';
    return;
  }
  if(bekreft&&!confirm(overstyr
      ? 'OVERSTYRING: slå sammen kunderadene på org.nr '+orgnr+' selv om salgsdataene IKKE bekrefter at de er samme sted? Dette er din vurdering, ikke appens. Kjøringen merkes som overstyrt og kan angres i sin helhet.'
      : orgnr
      ? 'Slå sammen kunderadene på org.nr '+orgnr+'? Kjøringen kan angres i sin helhet etterpå.'
      : 'Slå sammen ALLE bekreftede dublettsett? Kjøringen kan angres i sin helhet etterpå — men tørrkjør først hvis du ikke har gjort det.'))return;
  knapper.forEach(b=>b.disabled=true);
  el.innerHTML='<span class="sub">'+(bekreft?'Slår sammen…':'Regner ut hva som ville skjedd…')+'</span>';
  try{
    // Sammenslåingen kjøres i batcher (se MAKS_SETT_PER_KJORING i backend) og gjentas til
    // «gjenstar» er null. retry:false: et automatisk nytt forsøk på en 502 ville startet en
    // ANDRE kjøring mens serveren fortsatt jobbet med den første.
    let d=null,runder=0,sumKunder=0,sumRader=0,sumKonflikt=0;
    do{
      d=await api('/api/kundekonto/slaa-sammen?bekreft='+(bekreft?'true':'false'),
                  {method:'POST',body:{orgnr:orgnr||null,overstyr:overstyr},retry:false});
      if(!bekreft)break;
      runder++; sumKunder+=d.kunder_slettet||0; sumRader+=d.rader_flyttet||0;
      sumKonflikt+=d.rader_beholdt_pga_unik_nokkel||0;
      if(d.gjenstar)el.innerHTML='<span class="sub">Slår sammen… '
        +sumKunder.toLocaleString('nb-NO')+' kunderader gjort, '
        +d.gjenstar.toLocaleString('nb-NO')+' sett igjen (runde '+runder+')</span>';
    }while(bekreft&&d.gjenstar>0&&runder<200);
    const s=d.sammendrag||{};
    let html='<p style="margin:0 0 6px"><b>'+esc(d.status)+'</b></p>';
    if(bekreft){
      html+=`<div>${runder} ${runder===1?'runde':'runder'} · `
        +`<b>${sumKunder.toLocaleString('nb-NO')}</b> kunderader slått sammen · `
        +`${sumRader.toLocaleString('nb-NO')} rader flyttet`
        +(sumKonflikt?` · ${sumKonflikt} ble liggende (fantes allerede på den beholdte raden)`:'')+'</div>'
        +(d.gjenstar?`<p class="sub" style="margin:6px 0 0">${d.gjenstar} sett gjenstår — trykk «Slå sammen» igjen.</p>`:'')
        +`<p class="sub" style="margin:8px 0 0">Angre under «Tidligere kjøringer» — hver runde er sin egen kjøring.</p>`;
    }else{
      html+=`<div>${(s.sett||0).toLocaleString('nb-NO')} sett · `
        +`<b>${(s.kunder_som_slettes||0).toLocaleString('nb-NO')}</b> kunderader ville blitt slått sammen · `
        +`${(s.rader_som_flyttes||0).toLocaleString('nb-NO')} rader ville blitt flyttet</div>`;
      // Null sett er ikke et svar i seg selv: enten finnes det ingen dubletter, eller så
      // finnes de uten at salgsdataene bekrefter dem. Bare det siste er noe å gjøre noe med.
      html+=kkUtdatertVarsel(d.gruppering_status);
      if(!s.sett&&s.dublettsett_funnet){
        html+=`<div class="sub" style="margin-top:4px">${s.dublettsett_funnet.toLocaleString('nb-NO')} dublettsett finnes i utvalget, men ingen er bekreftet av salgsdataene:</div>`
          +'<ul class="sub" style="margin:4px 0 0 18px">'
          +Object.entries(s.ikke_bekreftet_per_grunn||{}).map(([k,v])=>
            `<li><b>${v.toLocaleString('nb-NO')}</b> — ${esc((d.grunner_forklart||{})[k]||k)}</li>`).join('')
          +'</ul>';
        if(d.kan_overstyres){
          html+='<div class="sub" style="margin-top:4px">Er du sikker på at dette ER samme kunde, kryss av for <b>Overstyr</b> og kjør igjen — den gjelder bare dette org.nr-et.</div>';
        }
        if((d.lose_kontoer||[]).length){
          html+='<div class="sub" style="margin-top:4px">Kontoene som står utenfor gruppen: '
            +d.lose_kontoer.map(k=>'<code>'+esc(k)+'</code>').join(', ')+'</div>';
        }
      }
      if((d.sett||[]).length){
        html+='<div style="overflow-x:auto;margin-top:6px"><table class="d-tabell"><thead><tr>'
          +'<th>Org.nr</th><th>Beholdes</th><th>Slettes</th><th class="tall">Rader som flyttes</th>'
          +'</tr></thead><tbody>'
          +d.sett.map(x=>`<tr${x.overstyrt?' style="background:var(--d-gul-bg)"':''}>`
            +`<td>${esc(x.orgnr)}${x.overstyrt?' <span class="rap-new-concept" title="'+esc(x.grunn_tekst||'')+'">overstyrt</span>':''}</td>`
            +`<td><b>${esc(x.beholdes||'')}</b></td>`
            +`<td class="sub">${esc((x.slettes||[]).join(', '))}</td>`
            +`<td class="tall">${x.rader_som_flyttes}</td></tr>`
            +(x.overstyrt?`<tr><td colspan="4" class="sub">Ikke bekreftet: ${esc(x.grunn_tekst||x.grunn||'')}</td></tr>`:'')).join('')
          +'</tbody></table></div>';
      }
      html+='<p class="sub" style="margin:8px 0 0">'+esc(d.neste||'')+'</p>';
    }
    el.innerHTML=html;
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{knapper.forEach(b=>b.disabled=false);}
}

async function kkKjoringer(){
  const el=document.getElementById('kkSamResultat');
  const btn=document.getElementById('kkKjoringerBtn');
  btn.disabled=true;
  el.innerHTML='<span class="sub">Henter kjøringer…</span>';
  try{
    const d=await api('/api/kundekonto/sammenslainger');
    const k=d.kjoringer||[];
    el.innerHTML=k.length
      ? '<div style="overflow-x:auto"><table class="d-tabell"><thead><tr><th>Tidspunkt</th><th>Utført av</th>'
        +'<th class="tall">Kunder slått sammen</th><th></th></tr></thead><tbody>'
        +k.map(r=>`<tr><td>${esc((r.tid||'').slice(0,16).replace('T',' '))}</td>`
          +`<td class="sub">${esc(r.utfort_av||'–')}</td>`
          +`<td class="tall">${r.kunder_slettet}${r.overstyrt?' <span class="rap-new-concept">overstyrt</span>':''}</td>`
          +`<td>${r.angret==r.kunder_slettet
              ? '<span class="sub">angret</span>'
              : `<button class="d-knapp subtil sm" onclick="kkAngre('${esc(r.kjoring_id)}')">Angre</button>`}</td></tr>`).join('')
        +'</tbody></table></div>'
      : '<div class="sub">Ingen sammenslåinger er kjørt ennå.</div>';
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }finally{btn.disabled=false;}
}

async function kkAngre(kjoringId){
  if(!confirm('Angre denne sammenslåingen? Kunderadene vekkes igjen og alt innhold flyttes tilbake dit det kom fra.'))return;
  const el=document.getElementById('kkSamResultat');
  el.innerHTML='<span class="sub">Angrer…</span>';
  try{
    const d=await api('/api/kundekonto/sammenslaing/'+encodeURIComponent(kjoringId)+'/angre',{method:'POST'});
    el.innerHTML='<p style="margin:0"><b>'+esc(d.status)+'</b> — '
      +`${(d.kunder_gjenopprettet||0).toLocaleString('nb-NO')} kunder gjenopprettet, `
      +`${(d.rader_flyttet_tilbake||0).toLocaleString('nb-NO')} rader flyttet tilbake.</p>`;
  }catch(e){
    el.innerHTML='<span style="color:var(--d-roed)">Feil: '+esc(e.message)+'</span>';
  }
}
