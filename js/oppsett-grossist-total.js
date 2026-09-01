// Oppsett → Datainnhenting, panel 8: grossistenes fulle omsetning fra Consolidated Model.
// Kilden til Rapporter → Totalrapport (alle grossister). Backend: app/grossist_total.py.
//
// Bakgrunnsjobb, ikke synkront kall: uttrekket er lite, men det henter ett år om gangen, og
// et tregt Power BI-svar skal ikke henge en request i minutter.

async function hentGrossistTotal(){
  const el = document.getElementById('gtStatus');
  const knapp = document.getElementById('gtHentBtn');
  const aar = [2024, 2025, 2026].filter(a => document.getElementById('gtAr' + a).checked);
  if(!aar.length){
    el.innerHTML = '<span style="color:var(--d-roed)">Velg minst ett år.</span>';
    return;
  }
  // Samme tokenfelt som hentingene over. Uten denne sjekken svarer serveren med en feil om
  // App Service-konfigurasjon, som ikke sier det som faktisk mangler: tokenet, lenger opp.
  const token = document.getElementById('pbToken').value.trim();
  if(!token){
    let sp = false;
    try{ sp = (await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet øverst først</span>';
      const felt = document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  // Full utskifting per år — verdt en bekreftelse, som ved de andre hentingene.
  if(!confirm('Hente grossistenes totalomsetning for ' + aar.join(', ') + '? Hvert år erstattes i sin helhet.')) return;
  knapp.disabled = true;
  el.innerHTML = '<span class="sub">Starter …</span>';
  try{
    const p = aar.map(a => 'ar=' + a).join('&');
    const res = await api('/api/powerbi/grossist-total/hent?' + p, {method:'POST', body:{token}});
    gtPollJobb(res.jobb_id);
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
    knapp.disabled = false;
  }
}

async function gtPollJobb(jobbId){
  const el = document.getElementById('gtStatus');
  const knapp = document.getElementById('gtHentBtn');
  try{
    const j = await api('/api/jobb/' + jobbId);
    if(j.status === 'kjorer'){
      el.innerHTML = '<span class="sub">' + esc(j.fremdrift || 'kjører …') + '</span>';
      setTimeout(() => gtPollJobb(jobbId), 3000);
      return;
    }
    knapp.disabled = false;
    if(j.status === 'ferdig'){
      const ar = (j.resultat && j.resultat.ar) || [];
      el.innerHTML = '<span style="color:var(--ok)">Ferdig ✓</span> '
        + ar.map(a => `${a.ar}: ${a.mnok.toLocaleString('nb-NO')} MNOK `
            + `(${a.grossister} grossister, t.o.m. uke ${a.siste_uke})`).join(' · ')
        + '<div class="sub" style="margin-top:4px">Konsernintern omsetning er holdt utenfor. '
        + 'Rapporten oppdateres ved neste innlasting av Rapporter.</div>';
      // Dashbordet cacher på MAX(oppdatert_tid), så tallene er ferske ved neste kall.
      // Vi tvinger ikke fram en reload her — brukeren står i Innstillinger.
    }else{
      el.innerHTML = '<span style="color:var(--d-roed)">Feilet: '
        + esc((j.feilmelding || 'ukjent feil').slice(0, 300)) + '</span>';
    }
  }catch(e){
    knapp.disabled = false;
    el.innerHTML = '<span style="color:var(--d-roed)">Feil ved statussjekk: ' + esc(e.message) + '</span>';
  }
}

async function visGrossistTotalStatus(){
  const el = document.getElementById('gtStatus');
  el.innerHTML = '<span class="sub">Henter status …</span>';
  try{
    const d = await api('/api/powerbi/grossist-total/status');
    if(!d.har_data){
      el.innerHTML = '<span class="sub">Ingen data ennå — kjør hentingen.</span>';
      return;
    }
    el.innerHTML = '<table class="d-tabell" style="max-width:560px"><thead><tr><th>År</th>'
      + '<th class="tall">MNOK</th><th class="tall">Grossister</th><th class="tall">T.o.m. uke</th>'
      + '<th>Hentet</th></tr></thead><tbody>'
      + d.ar.map(a => `<tr><td>${a.ar}</td><td class="tall">${a.mnok.toLocaleString('nb-NO')}</td>`
          + `<td class="tall">${a.grossister}</td><td class="tall">${a.siste_uke}</td>`
          + `<td class="sub">${esc(String(a.oppdatert || '').slice(0, 10))}</td></tr>`).join('')
      + '</tbody></table>';
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
  }
}
