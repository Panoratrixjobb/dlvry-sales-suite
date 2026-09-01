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
