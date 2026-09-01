// Oppsett → Datainnhenting: «Hent alt». Samme kjøring som agenten gjør automatisk.
// Backend: app/samlet_henting.py (rekkefølge og feilhåndtering), routers/samlet_henting.py.
//
// Ett steg som feiler stopper ikke resten, så visningen må vise steg for steg — en
// samlestatus alene ville skjult at fire av fem gikk bra.

const SH_KILDENAVN = {
  salg: 'Salgstall (kunde × konsept × uke)',
  produkt: 'Produkt og margin (konseptvarer)',
  produkt_alle: 'Produktsalg — alle varer',
  grossist_total: 'Grossistenes totalomsetning',
  prisliste: 'Leverandørprisliste',
};

async function hentAlt(){
  const el = document.getElementById('shStatus');
  const knapp = document.getElementById('shHentBtn');
  const aar = [2024, 2025, 2026].filter(a => document.getElementById('shAr' + a).checked);
  if(!aar.length){
    el.innerHTML = '<span style="color:var(--d-roed)">Velg minst ett år.</span>';
    return;
  }
  const token = document.getElementById('pbToken').value.trim();
  if(!token){
    let sp = false;
    try{ sp = (await api('/api/powerbi/status')).konfigurert; }catch(e){}
    if(!sp){
      el.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i feltet <b>Token</b> i panelet over først.</span>';
      const felt = document.getElementById('pbToken');
      felt.focus(); felt.scrollIntoView({block:'center'});
      return;
    }
  }
  if(!confirm('Hente alt for ' + aar.join(', ') + '? Hvert år erstattes i sin helhet i hver tabell.')) return;
  knapp.disabled = true;
  el.innerHTML = '<span class="sub">Starter …</span>';
  try{
    const p = aar.map(a => 'ar=' + a).join('&');
    const res = await api('/api/powerbi/samlet/hent?' + p, {method:'POST', body:{token}});
    shPollJobb(res.jobb_id, Date.now());
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
    knapp.disabled = false;
  }
}

async function shPollJobb(jobbId, start){
  const el = document.getElementById('shStatus');
  const knapp = document.getElementById('shHentBtn');
  try{
    const j = await api('/api/jobb/' + jobbId);
    if(j.status === 'kjorer'){
      const min = Math.floor((Date.now() - start) / 60000), sek = Math.floor((Date.now() - start) / 1000) % 60;
      el.innerHTML = '<span class="sub">' + esc(j.fremdrift || 'kjører …')
        + ` — ${min} min ${sek} s</span>`;
      setTimeout(() => shPollJobb(jobbId, start), 4000);
      return;
    }
    knapp.disabled = false;
    if(j.status !== 'ferdig'){
      el.innerHTML = '<span style="color:var(--d-roed)">Feilet: '
        + esc((j.feilmelding || 'ukjent feil').slice(0, 300)) + '</span>';
      return;
    }
    el.innerHTML = shResultat(j.resultat || {});
  }catch(e){
    knapp.disabled = false;
    el.innerHTML = '<span style="color:var(--d-roed)">Feil ved statussjekk: ' + esc(e.message) + '</span>';
  }
}

function shResultat(r){
  const merke = r.status === 'ok' ? '<span style="color:var(--ok)">Alt gikk bra ✓</span>'
    : r.status === 'delvis' ? '<span style="color:var(--advarsel)">Delvis — noen steg feilet</span>'
    : '<span style="color:var(--d-roed)">Alle steg feilet</span>';
  const rader = (r.steg || []).map(s => {
    const ok = s.status === 'ok';
    // Detaljene varierer per steg (år-liste, radtall, prisrader). Vi viser det som finnes
    // i stedet for å late som alle stegene rapporterer det samme.
    let d = '';
    if(ok && s.detaljer && Array.isArray(s.detaljer.ar)){
      d = s.detaljer.ar.map(a => `${a.ar}: ${(a.rader||0).toLocaleString('nb-NO')} rader`
        + (a.mnok!=null?` / ${a.mnok.toLocaleString('nb-NO')} MNOK`:'')).join(' · ');
    }else if(ok && s.detaljer){
      d = Object.entries(s.detaljer.sammendrag || s.detaljer)
        .filter(([,v]) => typeof v !== 'object')
        .slice(0, 4).map(([k,v]) => `${k}: ${v}`).join(' · ');
    }
    return `<tr>
      <td>${ok ? '✓' : '<span style="color:var(--d-roed)">✕</span>'}</td>
      <td>${esc(s.navn || s.steg)}</td>
      <td class="sub">${ok ? esc(d) : '<span style="color:var(--d-roed)">' + esc((s.feil||'').slice(0,200)) + '</span>'}</td>
    </tr>`;
  }).join('');
  return `<div style="margin-bottom:6px">${merke} — ${r.antall_ok||0} av ${(r.steg||[]).length} steg, år ${(r.ar||[]).join(', ')}</div>`
    + '<table class="d-tabell" style="max-width:820px"><tbody>' + rader + '</tbody></table>';
}

async function visSamletStatus(){
  const el = document.getElementById('shStatus');
  el.innerHTML = '<span class="sub">Henter status …</span>';
  try{
    const d = await api('/api/powerbi/samlet/status');
    // Fargen på alderen er hele poenget: «sist oppdatert 28. august» sier lite, «for 78
    // timer siden» sier med én gang at noe ikke har kjørt.
    const alder = t => t == null ? '<span class="sub">aldri</span>'
      : `<span style="color:${t < 24 ? 'var(--ok)' : (t < 72 ? 'var(--advarsel)' : 'var(--d-roed)')};font-weight:600">${t < 24 ? Math.round(t) + ' t' : Math.round(t/24) + ' d'} siden</span>`;
    const rader = (d.friskhet || []).map(f => `<tr>
        <td>${esc(SH_KILDENAVN[f.kilde] || f.kilde)}</td>
        <td class="tall">${alder(f.timer_siden)}</td>
        <td class="tall sub">${f.siste_uke ? 'uke ' + f.siste_uke : '–'}</td>
        <td class="sub">${esc(String(f.sist || '').slice(0, 16).replace('T', ' '))}</td>
      </tr>`).join('');
    const kjoring = (d.kjoringer || []).slice(0, 3).map(k => {
      const r = k.resultat || {};
      return `<tr><td class="sub">${esc(String(k.startet_tid || '').slice(0, 16).replace('T', ' '))}</td>
        <td>${esc(k.status)}${r.feilede_steg && r.feilede_steg.length ? ' <span style="color:var(--d-roed)">(' + esc(r.feilede_steg.join(', ')) + ')</span>' : ''}</td>
        <td class="sub">${esc((k.fremdrift || '').slice(0, 60))}</td></tr>`;
    }).join('');
    el.innerHTML = '<b style="font-size:12.5px">Hvor ferske er dataene?</b>'
      + '<table class="d-tabell" style="max-width:720px;margin-bottom:12px"><thead><tr><th>Kilde</th>'
      + '<th class="tall">Alder</th><th class="tall">Data t.o.m.</th><th>Sist hentet</th></tr></thead><tbody>'
      + rader + '</tbody></table>'
      + (kjoring ? '<b style="font-size:12.5px">Siste samlede kjøringer</b>'
          + '<table class="d-tabell" style="max-width:720px"><tbody>' + kjoring + '</tbody></table>'
        : '<span class="sub">Ingen samlet kjøring ennå.</span>');
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
  }
}
