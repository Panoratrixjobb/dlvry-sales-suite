// Innstillinger → Datainnhenting. ETT panel for alle hentingene (2026-09-01) — det som før
// var åtte nummererte bokser man måtte kjøre i riktig rekkefølge.
// Backend: app/samlet_henting.py (rekkefølge og feilhåndtering), routers/samlet_henting.py.
//
// Stegene kommer fra API-et, ikke fra en liste her. Et nytt steg i backend dukker da opp av
// seg selv i stedet for å kreve en frontend-endring i takt.
//
// Normalt hentes bare uker som ikke er låst som fakturert (periode_laas). «Hele året på
// nytt» skrur det av — det er kvartalsjobben, ikke den daglige.

const SH = {status: null, valgt: null, kjorer: false};

async function lastSamletPanel(){
  const vert = document.getElementById('shFriskhet');
  if(!vert) return;
  vert.innerHTML = '<span class="sub">Henter status …</span>';
  try{
    SH.status = await api('/api/powerbi/samlet/status');
  }catch(e){
    vert.innerHTML = '<span style="color:var(--d-roed)">Fikk ikke status: ' + esc(e.message) + '</span>';
    return;
  }
  if(!SH.valgt) SH.valgt = new Set(SH.status.steg.filter(s => s.standard).map(s => s.nokkel));
  vert.innerHTML = shFriskhetHtml(SH.status);
  document.getElementById('shSteg').innerHTML = shStegHtml(SH.status);
  const linje = document.getElementById('shAgentLinje');
  const sist = (SH.status.kjoringer || [])[0];
  if(linje && sist){
    const r = sist.resultat || {};
    const feil = (r.feilede_steg || []).length;
    linje.innerHTML = 'Siste kjøring ' + esc(String(sist.startet_tid || '').slice(0, 16).replace('T', ' '))
      + ' — ' + (sist.status === 'ferdig' && !feil ? '<span style="color:var(--ok)">alt ok</span>'
        : sist.status === 'ferdig' ? `<span style="color:var(--advarsel)">${feil} steg feilet</span>`
        : `<span style="color:var(--d-roed)">${esc(sist.status)}</span>`);
  }
}

const SH_NAVN = {
  salg: 'Salgstall (kunde × konsept × uke)',
  produkt: 'Produkt og margin (konseptvarer)',
  produkt_alle: 'Produktsalg — alle varer',
  grossist_total: 'Grossistenes totalomsetning',
  prisliste: 'Leverandørprisliste',
};

function shFriskhetHtml(d){
  // Alder i timer/dager med farge er hele poenget: «sist oppdatert 28. august» sier lite,
  // «78 t siden» sier med én gang at noe ikke har kjørt.
  const alder = t => t == null ? '<span class="sub">aldri</span>'
    : `<span style="color:${t < 24 ? 'var(--ok)' : (t < 72 ? 'var(--advarsel)' : 'var(--d-roed)')};font-weight:600">`
      + (t < 24 ? Math.round(t) + ' t' : Math.round(t / 24) + ' d') + ' siden</span>';
  return '<table class="d-tabell" style="max-width:640px"><thead><tr><th>Datasett</th>'
    + '<th class="tall">Alder</th><th class="tall">Data t.o.m.</th></tr></thead><tbody>'
    + (d.friskhet || []).map(f => `<tr>
        <td>${esc(SH_NAVN[f.kilde] || f.kilde)}</td>
        <td class="tall">${alder(f.timer_siden)}</td>
        <td class="tall sub">${f.siste_uke ? 'uke ' + f.siste_uke : '–'}</td></tr>`).join('')
    + '</tbody></table>';
}

function shStegHtml(d){
  const standard = d.steg.filter(s => s.standard), ekstra = d.steg.filter(s => !s.standard);
  const boks = s => `<label style="display:block;font-size:12.5px;margin:3px 0">
      <input type="checkbox" ${SH.valgt.has(s.nokkel) ? 'checked' : ''}
             onchange="shVelg('${s.nokkel}',this.checked)"> ${esc(s.navn)}</label>`;
  return '<div style="display:flex;gap:28px;flex-wrap:wrap">'
    + '<div><b style="font-size:12.5px">Daglig kjøring</b>' + standard.map(boks).join('') + '</div>'
    + '<div><b style="font-size:12.5px">Ved behov</b>'
    + '<div class="sub" style="font-size:11.5px;margin-bottom:2px">Tunge eller utfasede — ikke med i den daglige</div>'
    + ekstra.map(boks).join('') + '</div></div>';
}

function shVelg(nokkel, paa){
  if(paa) SH.valgt.add(nokkel); else SH.valgt.delete(nokkel);
}

async function hentAlt(){
  const el = document.getElementById('shStatus');
  const knapp = document.getElementById('shHentBtn');
  if(SH.kjorer) return;
  const steg = [...SH.valgt];
  if(!steg.length){
    el.innerHTML = '<span style="color:var(--d-roed)">Kryss av minst ett steg.</span>';
    return;
  }
  const aar = [2024, 2025, 2026].filter(a => document.getElementById('shAr' + a).checked);
  if(!aar.length){
    el.innerHTML = '<span style="color:var(--d-roed)">Velg minst ett år.</span>';
    return;
  }
  const full = document.getElementById('shFull').checked;
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
  if(full && !confirm('«Hele året på nytt» henter alt for ' + aar.join(', ')
      + ' — det tar mange minutter. Uten den hentes bare uker som ikke er fakturert. Fortsette?')) return;
  SH.kjorer = true; knapp.disabled = true;
  el.innerHTML = '<span class="sub">Starter …</span>';
  try{
    const p = aar.map(a => 'ar=' + a).concat(steg.map(s => 'steg=' + s));
    if(full) p.push('full=true');
    const res = await api('/api/powerbi/samlet/hent?' + p.join('&'), {method:'POST', body:{token}});
    shPollJobb(res.jobb_id, Date.now());
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
    SH.kjorer = false; knapp.disabled = false;
  }
}

async function shPollJobb(jobbId, start){
  const el = document.getElementById('shStatus');
  const knapp = document.getElementById('shHentBtn');
  try{
    const j = await api('/api/jobb/' + jobbId);
    if(j.status === 'kjorer'){
      const gaatt = Math.floor((Date.now() - start) / 1000);
      el.innerHTML = '<span class="sub">' + esc(j.fremdrift || 'kjører …')
        + ` — ${Math.floor(gaatt / 60)} min ${gaatt % 60} s</span>`;
      setTimeout(() => shPollJobb(jobbId, start), 4000);
      return;
    }
    SH.kjorer = false; knapp.disabled = false;
    el.innerHTML = j.status === 'ferdig' ? shResultat(j.resultat || {})
      : '<span style="color:var(--d-roed)">Feilet: ' + esc((j.feilmelding || 'ukjent feil').slice(0, 300)) + '</span>';
    lastSamletPanel();   // frisk opp aldersteksten
  }catch(e){
    SH.kjorer = false; knapp.disabled = false;
    el.innerHTML = '<span style="color:var(--d-roed)">Feil ved statussjekk: ' + esc(e.message) + '</span>';
  }
}

function shResultat(r){
  const merke = r.status === 'ok' ? '<span style="color:var(--ok)">Alt gikk bra ✓</span>'
    : r.status === 'delvis' ? '<span style="color:var(--advarsel)">Delvis — noen steg feilet</span>'
    : '<span style="color:var(--d-roed)">Alle steg feilet</span>';
  // Ett steg kan feile mens fire går bra, så resultatet vises steg for steg. En samlestatus
  // alene ville skjult hvilket som mangler.
  const rader = (r.steg || []).map(s => {
    const ok = s.status === 'ok';
    let d = '';
    if(ok && s.detaljer && Array.isArray(s.detaljer.ar)){
      d = s.detaljer.ar.map(a => a.hoppet_over ? `${a.ar}: ${a.hoppet_over}`
        : `${a.ar}: ${(a.rader || 0).toLocaleString('nb-NO')} rader`
          + (a.uke_fra ? ` (fra uke ${a.uke_fra})` : '')).join(' · ');
    }else if(ok && s.detaljer){
      d = Object.entries(s.detaljer.sammendrag || s.detaljer)
        .filter(([, v]) => typeof v !== 'object').slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`).join(' · ');
    }
    return `<tr><td>${ok ? '✓' : '<span style="color:var(--d-roed)">✕</span>'}</td>
      <td>${esc(s.navn || s.steg)}</td>
      <td class="sub">${ok ? esc(d) : '<span style="color:var(--d-roed)">' + esc((s.feil || '').slice(0, 200)) + '</span>'}</td></tr>`;
  }).join('');
  return `<div style="margin-bottom:6px">${merke} — ${r.antall_ok || 0} av ${(r.steg || []).length} steg`
    + `, år ${(r.ar || []).join(', ')} (${r.modus === 'full' ? 'hele året' : 'bare åpne uker'})</div>`
    + '<table class="d-tabell" style="max-width:820px"><tbody>' + rader + '</tbody></table>';
}
