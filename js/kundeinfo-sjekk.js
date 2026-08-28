// Kundeinfo-sjekk (steg 21) — datakvalitet på kundekontaktinfo, under Kunder & Leads.
// Se konseptsuite-backend/app/routers/kundeinfo.py + app/kundeinfo_jobb.py for bakgrunn:
// kunde_konsolidert kommer fra Power BI KUNDEINFO (SISTE fakturarad per kunde), kunde_epost
// gir flere e-poster per kunde med kilde-tag, epost-sjekk slår opp BRREG sitt
// epostadresse-felt (finnes ikke for alle enheter — ikke en feil når det mangler).

let KI_MOUNTED = false;
let KI_RADER = [];
let KI_Q = '';
let KI_OFFSET = 0;
const KI_LIMIT = 100;
let KI_APEN_KUNDE = null; // kunde_id for utvidet rad, eller null

async function mountKundeinfoSjekk(){
  const kanAdmin = CURRENT_USER && ['leder','admin','superadmin'].includes(CURRENT_USER.rolle);
  const el = document.getElementById('sub-kundeinfo');
  if(!KI_MOUNTED){
    KI_MOUNTED = true;
    el.innerHTML = `
      <div class="crumb">Kunder med manglende eller uverifisert kontaktinfo — e-post, telefon, org.nr og match mot Power BI KUNDEINFO.</div>
      <div id="kiAdminRad" style="display:none;margin-bottom:14px">
        <button class="d-knapp subtil sm" onclick="kiKjorSynk()">⟳ Kjør KUNDEINFO-synk nå</button>
        <button class="d-knapp subtil sm" onclick="kiMatchLagrede()" title="Kobler det som allerede er hentet fra Power BI mot kundene — ingen ny henting, trenger ikke token">↔ Match lagrede mot kunder</button>
        <span id="kiSynkStatus" class="d-t-hint" style="margin-left:10px"></span>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <div class="d-sok" style="flex:1;min-width:220px">
          <svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
          <input id="kiSearch" type="search" class="d-input" placeholder="Søk navn / orgnr…" oninput="kiOnSearch(this.value)">
        </div>
        <span id="kiCount" class="d-t-label"></span>
      </div>
      <div class="table-wrap" style="border-radius:var(--d-radius-sm);border:1px solid var(--d-ramme)">
        <table class="d-tabell" style="min-width:900px">
          <thead><tr>
            <th>Kundenavn</th><th>Org.nr</th><th>E-post</th><th>Telefon</th><th>Kundekonto</th><th>Flagg</th>
          </tr></thead>
          <tbody id="kiBody"></tbody>
        </table>
      </div>
      <div id="kiPager" style="display:none;gap:14px;align-items:center;justify-content:center;margin-top:14px">
        <button id="kiPrev" class="d-knapp sekundar sm" onclick="kiGaaSide(-1)">‹ Forrige</button>
        <span id="kiPagerInfo" class="d-t-hint"></span>
        <button id="kiNext" class="d-knapp sekundar sm" onclick="kiGaaSide(1)">Neste ›</button>
      </div>
      <div id="kiDetalj" style="margin-top:20px"></div>
    `;
  }
  document.getElementById('kiAdminRad').style.display = kanAdmin ? '' : 'none';
  await kiLastOgVis();
}

function kiOnSearch(v){
  KI_Q = v; KI_OFFSET = 0;
  clearTimeout(window._kiSearchT);
  window._kiSearchT = setTimeout(kiLastOgVis, 300);
}

function kiGaaSide(delta){
  KI_OFFSET = Math.max(0, KI_OFFSET + delta*KI_LIMIT);
  kiLastOgVis();
}

async function kiLastOgVis(){
  const body = document.getElementById('kiBody');
  body.innerHTML = '<tr><td colspan="6" class="sub">Laster…</td></tr>';
  try{
    const qs = new URLSearchParams({limit:KI_LIMIT, offset:KI_OFFSET});
    if(KI_Q) qs.set('q', KI_Q);
    const res = await api('/api/kundeinfo/mangler?' + qs.toString());
    KI_RADER = res.rader || [];
    document.getElementById('kiCount').textContent = res.total.toLocaleString('nb-NO') + ' kunder';
    kiTegnTabell();
    const pager = document.getElementById('kiPager');
    pager.style.display = res.total > KI_LIMIT ? 'flex' : 'none';
    document.getElementById('kiPrev').disabled = KI_OFFSET === 0;
    document.getElementById('kiNext').disabled = KI_OFFSET + KI_LIMIT >= res.total;
    document.getElementById('kiPagerInfo').textContent =
      `${KI_OFFSET+1}–${Math.min(KI_OFFSET+KI_LIMIT, res.total)} av ${res.total}`;
  }catch(e){
    body.innerHTML = '<tr><td colspan="6" class="sub" style="color:var(--d-roed)">Feil ved henting: '+esc(e.message)+'</td></tr>';
  }
}

function kiFlaggBadges(r){
  const flagg = [];
  if(r.orgnr_mangler) flagg.push('<span class="d-badge graa flat">org.nr mangler</span>');
  if(r.epost_mangler) flagg.push('<span class="d-badge gul flat">e-post mangler</span>');
  if(r.telefon_mangler) flagg.push('<span class="d-badge gul flat">telefon mangler</span>');
  if(r.ingen_match_konsolidert) flagg.push('<span class="d-badge graa flat" title="Ingen treff i Power BI KUNDEINFO-synken">ingen match</span>');
  return flagg.join(' ') || '<span class="d-t-hint">—</span>';
}

function kiTegnTabell(){
  const body = document.getElementById('kiBody');
  if(!KI_RADER.length){
    body.innerHTML = '<tr><td colspan="6" class="sub">Ingen kunder i dette utvalget.</td></tr>';
    return;
  }
  body.innerHTML = KI_RADER.map(r => `
    <tr style="cursor:pointer" onclick="kiApneKunde('${r.id}')">
      <td>${esc(r.navn||'')}</td>
      <td>${esc(r.orgnr||'—')}</td>
      <td>${esc(r.epost||'—')}</td>
      <td>${esc(r.telefon||'—')}</td>
      <td>${esc(r.kundekonto||'—')}</td>
      <td>${kiFlaggBadges(r)}</td>
    </tr>
  `).join('');
}

async function kiApneKunde(kundeId){
  KI_APEN_KUNDE = kundeId;
  const el = document.getElementById('kiDetalj');
  el.innerHTML = '<p class="sub">Laster kundedetaljer…</p>';
  try{
    const eposter = await api(`/api/kunder/${kundeId}/epost`);
    kiTegnDetalj(kundeId, eposter, null);
  }catch(e){
    el.innerHTML = '<p class="sub" style="color:var(--d-roed)">Feil: '+esc(e.message)+'</p>';
  }
}

function kiKildeBadge(kilde){
  if(kilde==='brreg') return '<span class="d-badge gronn flat">BRREG</span>';
  if(kilde==='konsolidert') return '<span class="d-badge bla flat">konsolidert</span>';
  return '<span class="d-badge graa flat">manuell</span>';
}

function kiTegnDetalj(kundeId, eposter, brregResultat){
  const el = document.getElementById('kiDetalj');
  const rader = eposter.map(ep => `
    <div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--d-ramme)">
      <span style="flex:1">${esc(ep.epost)}${ep.er_primaer?' <span class="d-t-hint">(primær)</span>':''}</span>
      ${kiKildeBadge(ep.kilde)}
      <span class="d-t-hint">${esc(ep.type||'ukjent')}</span>
      <button class="d-knapp subtil sm" onclick="kiSlettEpost('${ep.id}','${kundeId}')">Slett</button>
    </div>
  `).join('') || '<p class="sub">Ingen e-poster registrert.</p>';

  let brregHtml = '<button class="d-knapp subtil sm" onclick="kiSjekkBrreg(\''+kundeId+'\')">Sjekk mot BRREG</button>';
  if(brregResultat){
    const b = brregResultat.brreg;
    if(b.status === 'funnet'){
      brregHtml = `<div class="d-t-label">BRREG: <b>${esc(b.epost)}</b>
        <button class="d-knapp subtil sm" onclick="kiLeggTilFraBrreg('${kundeId}','${escJsAttr(b.epost)}')">Legg til fra BRREG</button></div>`;
    }else if(b.status === 'ikke_registrert'){
      brregHtml = '<div class="d-t-hint">BRREG har ingen e-post registrert for denne enheten (normalt, ikke en feil).</div>';
    }else if(b.status === 'ikke_funnet_i_brreg'){
      brregHtml = '<div class="d-t-hint">Fant ikke organisasjonsnummeret i BRREG.</div>';
    }else{
      brregHtml = '<div class="d-t-hint" style="color:var(--d-roed)">BRREG-oppslaget feilet — prøv igjen senere.</div>';
    }
  }

  el.innerHTML = `
    <div class="d-panel">
      <h3>E-poster</h3>
      ${rader}
      <div style="display:flex;gap:8px;margin-top:10px">
        <input id="kiNyEpost" type="email" class="d-input" placeholder="ny@epost.no" style="max-width:260px">
        <button class="d-knapp subtil sm" onclick="kiLeggTilEpost('${kundeId}')">Legg til e-post</button>
      </div>
      <div style="margin-top:14px">${brregHtml}</div>
    </div>
  `;
}

async function kiLeggTilEpost(kundeId){
  const input = document.getElementById('kiNyEpost');
  const epost = (input.value||'').trim();
  if(!epost) return;
  try{
    await api(`/api/kunder/${kundeId}/epost`, {method:'POST', body:{epost, kilde:'manuell'}});
    input.value = '';
    toast('E-post lagt til');
    await kiApneKunde(kundeId);
  }catch(e){ toast('Feil: '+e.message); }
}

async function kiLeggTilFraBrreg(kundeId, epost){
  try{
    await api(`/api/kunder/${kundeId}/epost`, {method:'POST', body:{epost, kilde:'brreg', type:'ukjent'}});
    toast('E-post fra BRREG lagt til');
    await kiApneKunde(kundeId);
  }catch(e){ toast('Feil: '+e.message); }
}

async function kiSlettEpost(epostId, kundeId){
  if(!confirm('Slette denne e-posten?')) return;
  try{
    await api(`/api/kunder/epost/${epostId}`, {method:'DELETE'});
    toast('E-post slettet');
    await kiApneKunde(kundeId);
  }catch(e){ toast('Feil: '+e.message); }
}

async function kiSjekkBrreg(kundeId){
  try{
    const res = await api(`/api/kunder/${kundeId}/epost-sjekk`, {method:'POST'});
    const eposter = await api(`/api/kunder/${kundeId}/epost`);
    kiTegnDetalj(kundeId, eposter, res);
  }catch(e){ toast('Feil: '+e.message); }
}

async function kiKjorSynk(){
  const statusEl = document.getElementById('kiSynkStatus');
  // Samme token-felt som resten av Oppsett > Datainnhenting (js/oppsett-datainnhenting.js)
  // — service principal er ikke satt opp ennå, så et manuelt limt-inn token må sendes med.
  const tokenEl = document.getElementById('pbToken');
  const token = tokenEl ? tokenEl.value.trim() : '';
  if(!token){
    statusEl.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i feltet '
      + '<b>Token</b> i Oppsett → Datainnhenting først.</span>';
    return;
  }
  try{
    const res = await api('/api/kundeinfo/hent', {method:'POST', body:{token}});
    statusEl.textContent = 'Synk startet — kan ta flere minutter …';
    kiPollJobb(res.jobb_id);
  }catch(e){ statusEl.textContent = 'Feil: '+e.message; }
}

// Matcher BARE det som allerede ligger i kunde_konsolidert mot kundene — hentingen fra
// Power BI er den dyre delen (dag for dag bakover i tid), så et matchesteg som feiler skal
// ikke tvinge fram en ny full henting. Se konseptsuite-backend/app/kundeinfo_jobb.py.
async function kiMatchLagrede(){
  const statusEl = document.getElementById('kiSynkStatus');
  statusEl.textContent = 'Matcher …';
  try{
    const r = await api('/api/kundeinfo/match-lagrede', {method:'POST'});
    const ubrukelig = r.kunder_med_ubrukelig_postnr_sted
      ? `, ${r.kunder_med_ubrukelig_postnr_sted} hoppet over (ubrukelig postnr/sted)` : '';
    statusEl.textContent = `Ferdig: ${r.kunder_matchet||0} koblet, `
      + `${r.kunder_med_utfylt_postnr_sted||0} fikk postnr/sted${ubrukelig}.`;
    kiLastOgVis();
  }catch(e){ statusEl.textContent = 'Feil: '+e.message; }
}

async function kiPollJobb(jobbId){
  const statusEl = document.getElementById('kiSynkStatus');
  try{
    const j = await api('/api/jobb/'+jobbId);
    if(j.status === 'kjorer'){
      statusEl.textContent = j.fremdrift || 'kjører …';
      setTimeout(() => kiPollJobb(jobbId), 5000);
    }else if(j.status === 'ferdig'){
      const r = j.resultat || {};
      statusEl.textContent = `Ferdig: ${r.kunder_funnet||0} kunder funnet, ${r.kunder_ikke_funnet||0} ikke funnet (${r.arsak_stopp||''}).`;
      kiLastOgVis();
    }else{
      statusEl.textContent = 'Feilet: ' + (j.feilmelding||'ukjent feil').slice(0,200);
    }
  }catch(e){ statusEl.textContent = 'Feil ved statussjekk: '+e.message; }
}
