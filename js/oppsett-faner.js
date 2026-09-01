// Innstillinger: faner. Skilt ut av index.html 2026-08-07.
// ===== Innstillinger: faner =====
// Panelene blir stående der de er i DOM-en; fanene styrer bare synlighet.
// Datainnhenting er ETT panel fra 2026-09-01 (samletPanel) — de åtte nummererte boksene
// er borte, og rekkefølgen de måtte kjøres i ligger nå i backend (app/samlet_henting.py).
const OPPSETT_GRUPPER={
  brukere:['brukerFormRad','brukerkort-steg4','invitasjonPanel','feedbackPanel','bulkImportPanel'],
  data:['tokenPanel','samletPanel','vedlikeholdPanel'],
  beregning:['kildePanel','paritetPanel','formelkonfigPanel'],
  import:['brregPanel','leadsImportPanel'],
  // Avsenderdata for tilbuds-PDF-en (oppsett-grossist-avsender.js). Egen fane fordi
  // det er stamdata om konsernets selskaper, ikke datainnhenting eller import.
  grossister:['grossistAvsenderPanel'],
  // Aktivitetsloggen (2026-09-01) er verken brukeradmin eller datainnhenting — den er
  // innsyn i BRUKEN av appen, og fikk derfor egen fane.
  aktivitet:['aktivitetLoggPanel'],
};
const OPPSETT_TEKST={
  brukere:'Administrer brukertilgang. Inviter ett nivå ned i hierarkiet.',
  data:'Agenten henter automatisk 08:00, 13:00 og 15:00. Her ser du hvor ferske dataene er, og kan kjøre en henting selv.',
  beregning:'Hvilken kilde dashbordet leser fra, og om appens egne tall stemmer med regnearket.',
  import:'Engangs- og periodiske importer: firmadata fra Brønnøysund og den nasjonale leads-databasen.',
  grossister:'Navn, adresse, org.nr. og logo som står som avsender på tilbud til kunde.',
  aktivitet:'Hvem som logger inn, hvor ofte, og hva de jobber med. Registreres fra 01.09.2026.',
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
  // Datainnhenting laster friskhet + siste kjøringer hver gang fanen åpnes. En kjøring
  // lever på SERVEREN og overlever en sideoppfriskning; uten dette ville et ferdig resultat
  // sett ut som om ingenting hadde skjedd.
  if(fane==='data'&&OPPSETT_ER_ADMIN&&typeof lastSamletPanel==='function')lastSamletPanel();
  // Formel-konfig lastes ikke av seg selv, og et tomt panel ser ut som om innholdet ikke
  // finnes — Manuele lette forgjeves etter Konsernselskaper 18.08. Last det når fanen
  // åpnes, men bare hvis det er tomt, så «↻ Last konfig» fortsatt er en ekte oppfrisking
  // og et pågående skjema ikke blir overskrevet.
  if(fane==='beregning'&&OPPSETT_ER_ADMIN&&typeof lastFormelkonfig==='function'){
    const el=document.getElementById('fkInnhold');
    if(el&&!el.innerHTML.trim())lastFormelkonfig();
  }
  // Samme grunn som over: et tomt grossistpanel ser ut som «ingen grossister».
  if(fane==='grossister'&&OPPSETT_ER_ADMIN&&typeof lastGrossistAvsendere==='function'){
    const el=document.getElementById('gaInnhold');
    if(el&&!el.innerHTML.trim())lastGrossistAvsendere();
  }
  // Samme grunn: en tom aktivitetsfane ser ut som «ingen har logget inn».
  if(fane==='aktivitet'&&OPPSETT_ER_ADMIN&&typeof lastAktivitetslogg==='function'){
    const el=document.getElementById('aktInnhold');
    if(el&&!el.innerHTML.trim())lastAktivitetslogg();
  }
}

