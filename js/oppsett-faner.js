// Innstillinger: faner. Skilt ut av index.html 2026-08-07.
// ===== Innstillinger: faner =====
// Panelene blir stående der de er i DOM-en; fanene styrer bare synlighet. Rekkefølgen
// under er den de vises i, og for Datainnhenting er den KJØREREKKEFØLGEN: token, så
// salgstall, så produkt/margin, med Excel-reserven sist.
const OPPSETT_GRUPPER={
  brukere:['brukerFormRad','brukerkort-steg4','invitasjonPanel','feedbackPanel','bulkImportPanel'],
  data:['tokenPanel','powerbiPanel','produktPanel','prislistePanel','dashUploadPanel'],
  beregning:['kildePanel','paritetPanel','formelkonfigPanel'],
  import:['brregPanel','leadsImportPanel'],
};
const OPPSETT_TEKST={
  brukere:'Administrer brukertilgang. Inviter ett nivå ned i hierarkiet.',
  data:'Hent salgs- og margindata fra Power BI. Kjør panelene i rekkefølge — tørrkjør alltid før du lagrer.',
  beregning:'Hvilken kilde dashbordet leser fra, og om appens egne tall stemmer med regnearket.',
  import:'Engangs- og periodiske importer: firmadata fra Brønnøysund og den nasjonale leads-databasen.',
};
// Bare superadmin når Innstillinger i det hele tatt, men de tre siste fanene er
// datateknisk arbeid — leder-/admin-roller skal ikke kunne skrive til dashbordet.
let OPPSETT_ER_ADMIN=false, OPPSETT_FANE='brukere';

function settOppsettFane(fane){
  if(!OPPSETT_GRUPPER[fane]||(!OPPSETT_ER_ADMIN&&fane!=='brukere'))fane='brukere';
  OPPSETT_FANE=fane;
  Object.entries(OPPSETT_GRUPPER).forEach(([navn,ider])=>ider.forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.display=(navn===fane)?'':'none';
  }));
  document.querySelectorAll('[data-oppsettfane]').forEach(b=>{
    b.classList.toggle('aktiv',b.dataset.oppsettfane===fane);
    b.style.display=(OPPSETT_ER_ADMIN||b.dataset.oppsettfane==='brukere')?'':'none';
  });
  const crumb=document.getElementById('oppsettCrumb');
  if(crumb)crumb.textContent=OPPSETT_TEKST[fane]||'';
  // Bakgrunnsjobbene (Fast Food + alle kunder produktmiks) overlever et sideoppfriskning
  // på SERVEREN, men panelene sin lokale poll-tilstand gjør ikke det — uten dette ser et
  // ferdig/pågående kjøring ut som om ingenting noensinne skjedde. Vis siste kjente status
  // hver gang fanen åpnes, ikke bare mens man selv står og poller.
  if(fane==='data'&&OPPSETT_ER_ADMIN)visSisteBakgrunnsjobber();
}

async function visSisteBakgrunnsjobber(){
  for(const [type,elId] of [['fastfood_produkt_per_kunde','ffpResultat'],['kunde_produkt_hent','kpResultat']]){
    const el=document.getElementById(elId);
    if(!el||el.innerHTML.trim())continue;   // ikke overskriv en poll som pågår akkurat nå
    try{
      const j=await api('/api/jobb/siste/'+type);
      if(!j||j.status==='ingen_kjoring_ennaa')continue;
      const tid=j.startet_tid?new Date(j.startet_tid).toLocaleString('nb-NO'):'ukjent tid';
      if(j.status==='kjorer'){
        el.innerHTML=`<span class="sub">⏳ En kjøring startet ${esc(tid)} viser fortsatt «kjører» — ${esc(j.fremdrift||'ingen fremdriftsmelding ennå')}. `
          +`Trykk en av knappene over for å starte en poll som følger den videre, eller start en ny kjøring hvis denne ser fastlåst ut.</span>`;
      }else if(j.status==='feilet'){
        el.innerHTML=`<span style="color:var(--d-roed)">Siste kjøring (startet ${esc(tid)}) feilet: ${esc((j.feilmelding||'').slice(0,300))}</span>`;
      }else if(j.status==='ferdig'){
        const s=(j.resultat&&j.resultat.sammendrag)||{};
        el.innerHTML=`<span class="sub">✓ Siste kjøring (startet ${esc(tid)}, ferdig ${j.ferdig_tid?new Date(j.ferdig_tid).toLocaleString('nb-NO'):''}): `
          +`${esc(j.resultat?.status||'ferdig')}${s.mnok!=null?' — '+s.mnok+' MNOK':''}${s.dekning_pct!=null?', dekning '+s.dekning_pct+' %':''}. `
          +`Trykk en av knappene over for full detalj eller en ny kjøring.</span>`;
      }
    }catch(e){/* stille — bare et bekvemmelighets-oppslag, ikke kritisk */}
  }
}
