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
}
