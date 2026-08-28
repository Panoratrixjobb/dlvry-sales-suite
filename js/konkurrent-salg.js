// Konkurrentsalg — hvilke produkter kundene kjøper fra konkurrerende leverandører.
// Se konseptsuite-backend/app/routers/konkurrent_salg.py for datagrunnlaget.
//
// Flyten er tredelt og rekkefølgen betyr noe: finn skrivemåter → BEKREFT hvilke som er
// leverandøren → hent. Bekreftelsen er bevisst manuell, fordi salgsdataene inneholder
// «JIM LORENTZEN» og «Haugen Gardsmat Drift AS» som er helt andre firmaer enn Oluf
// Lorentzen og Haugen Gruppen. Et automatisk «inneholder navnet» ville blandet dem.

let KSALG_MOUNTED = false;
let KSALG_LIMIT = 200;
let KSALG_OFFSET = 0;
let KSALG_VARIANTER = null;   // svaret fra «Finn skrivemåter», null før det er kjørt

async function mountKonkurrentSalg(){
  const el = document.getElementById('sub-konkSalg');
  const kanAdmin = CURRENT_USER && ['leder','admin','superadmin'].includes(CURRENT_USER.rolle);
  if(!KSALG_MOUNTED){
    KSALG_MOUNTED = true;
    el.innerHTML = `
      <div id="ksAdmin" style="display:none;margin-bottom:16px">
        <div class="d-panel" style="padding:14px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <button class="d-knapp subtil sm" onclick="ksFinnVarianter()">🔍 Finn skrivemåter</button>
            <button class="d-knapp subtil sm" onclick="ksHent()">⟳ Hent salg</button>
            <span id="ksStatus" class="d-t-hint"></span>
          </div>
          <div class="d-t-hint" style="margin-top:8px">
            Leverandørnavnene i salgsdataene er rå — samme konkurrent har flere skrivemåter.
            Finn dem, huk av hvilke som hører til hver konkurrent, og hent så salget.
            Krever token i Oppsett → Datainnhenting.
          </div>
          <div id="ksVarianter" style="margin-top:14px"></div>
        </div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <div class="d-sok" style="flex:1;min-width:220px">
          <svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
          <input id="ksSok" type="search" class="d-input" placeholder="Søk kunde, produkt, org.nr…" oninput="ksOnSok(this.value)">
        </div>
        <select id="ksGrossist" class="d-select" style="width:auto" onchange="ksOnFilter()"></select>
        <select id="ksLeverandor" class="d-select" style="width:auto" onchange="ksOnFilter()"></select>
        <select id="ksVaregruppe" class="d-select" style="width:auto" onchange="ksOnFilter()"></select>
        <button class="d-knapp sekundar sm" onclick="ksEksporter()">⤓ Last ned Excel</button>
      </div>
      <div id="ksSammendrag" class="d-t-label" style="margin-bottom:10px"></div>

      <div class="table-wrap" style="border-radius:var(--d-radius-sm);border:1px solid var(--d-ramme)">
        <table class="d-tabell" style="min-width:1000px">
          <thead><tr>
            <th>Kunde</th><th>Grossist</th><th>Konkurrent</th><th>Varegruppe</th>
            <th>Produkt</th><th style="text-align:right">Antall</th>
            <th style="text-align:right">Omsetning</th>
          </tr></thead>
          <tbody id="ksBody"></tbody>
        </table>
      </div>
      <div id="ksPager" style="display:none;gap:14px;align-items:center;justify-content:center;margin-top:14px">
        <button class="d-knapp sekundar sm" onclick="ksGaaSide(-1)">‹ Forrige</button>
        <span id="ksPagerInfo" class="d-t-hint"></span>
        <button class="d-knapp sekundar sm" onclick="ksGaaSide(1)">Neste ›</button>
      </div>
    `;
  }
  document.getElementById('ksAdmin').style.display = kanAdmin ? '' : 'none';
  await ksLastFiltre();
  await ksLastOgVis();
}

// Filtervalgene bygges ETT sted og brukes av både tabellen og Excel-nedlastingen, så
// nedlastingen aldri kan vise et annet utvalg enn skjermen.
function ksFilterParams(){
  const p = new URLSearchParams();
  const v = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  if(v('ksGrossist')) p.set('grossist', v('ksGrossist'));
  if(v('ksLeverandor')) p.set('leverandor', v('ksLeverandor'));
  if(v('ksVaregruppe')) p.set('varegruppe', v('ksVaregruppe'));
  if(v('ksSok')) p.set('q', v('ksSok'));
  return p;
}

function ksOnFilter(){ KSALG_OFFSET = 0; ksLastOgVis(); }
function ksGaaSide(d){ KSALG_OFFSET = Math.max(0, KSALG_OFFSET + d*KSALG_LIMIT); ksLastOgVis(); }
function ksOnSok(){
  KSALG_OFFSET = 0;
  clearTimeout(window._ksSokT);
  window._ksSokT = setTimeout(ksLastOgVis, 300);
}

function ksEksporter(){
  eksporterFil('/api/konkurrent-salg/eksport.xlsx?' + ksFilterParams().toString(),
               'konkurrentsalg.xlsx');
}

async function ksLastFiltre(){
  try{
    const f = await api('/api/konkurrent-salg/filtre');
    const fyll = (id, verdier, alle) => {
      const el = document.getElementById(id);
      const valgt = el.value;
      el.innerHTML = `<option value="">${alle}</option>` +
        verdier.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      el.value = valgt;   // behold valget når lista lastes på nytt
    };
    fyll('ksGrossist', f.grossister || [], 'Alle grossister');
    fyll('ksLeverandor', f.leverandorer || [], 'Alle konkurrenter');
    fyll('ksVaregruppe', f.varegrupper || [], 'Alle varegrupper');
  }catch(e){ /* filtrene er en bekvemmelighet — lista virker uten dem */ }
}

async function ksLastOgVis(){
  const body = document.getElementById('ksBody');
  body.innerHTML = '<tr><td colspan="7" class="sub">Laster…</td></tr>';
  try{
    const qs = ksFilterParams();
    qs.set('limit', KSALG_LIMIT);
    qs.set('offset', KSALG_OFFSET);
    const res = await api('/api/konkurrent-salg/?' + qs.toString());
    if(!res.rader.length){
      body.innerHTML = '<tr><td colspan="7" class="sub">'
        + (KSALG_OFFSET ? 'Ingen flere rader.'
           : 'Ingen data ennå. Kjør «Finn skrivemåter», bekreft hvilke som hører til hver konkurrent, og trykk «Hent salg».')
        + '</td></tr>';
    }else{
      body.innerHTML = res.rader.map(r => `
        <tr>
          <td>${esc(r.kundenavn || '—')}${r.kunde_id ? '' : ' <span class="d-badge graa flat" title="Org.nr finnes ikke i kunderegisteret">ikke i CRM</span>'}
              <div class="d-t-hint">${esc(r.orgnr || '')}</div></td>
          <td>${esc(r.grossist || '—')}</td>
          <td>${esc(r.leverandor || '—')}<div class="d-t-hint">${esc(r.leverandor_variant || '')}</div></td>
          <td>${esc(r.varegruppe || '—')}</td>
          <td>${esc(r.produktnavn || '—')}<div class="d-t-hint">${esc(r.produktnr || '')}</div></td>
          <td style="text-align:right">${(r.antall ?? 0).toLocaleString('nb-NO', {maximumFractionDigits:1})}</td>
          <td style="text-align:right">${fmtKr(r.omsetning)}</td>
        </tr>`).join('');
    }
    document.getElementById('ksSammendrag').textContent =
      `${res.total.toLocaleString('nb-NO')} rader · ${fmtKr(res.omsetning)} i utvalget`;
    const pager = document.getElementById('ksPager');
    pager.style.display = res.total > KSALG_LIMIT ? 'flex' : 'none';
    document.getElementById('ksPagerInfo').textContent =
      `${KSALG_OFFSET+1}–${Math.min(KSALG_OFFSET+KSALG_LIMIT, res.total)} av ${res.total}`;
  }catch(e){
    body.innerHTML = '<tr><td colspan="7" class="sub" style="color:var(--d-roed)">Feil: '+esc(e.message)+'</td></tr>';
  }
}

// ---- Aliaslista ----

async function ksFinnVarianter(){
  const status = document.getElementById('ksStatus');
  const tokenEl = document.getElementById('pbToken');
  const token = tokenEl ? tokenEl.value.trim() : '';
  if(!token){
    status.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i <b>Oppsett → Datainnhenting</b> først.</span>';
    return;
  }
  status.textContent = 'Leser leverandørnavn fra Power BI …';
  try{
    KSALG_VARIANTER = await api('/api/konkurrent-salg/finn-varianter', {method:'POST', body:{token}});
    status.textContent = `Fant ${KSALG_VARIANTER.varianter.length} skrivemåter i ${KSALG_VARIANTER.ar}.`;
    ksTegnVarianter();
  }catch(e){ status.textContent = 'Feil: '+e.message; }
}

function ksTegnVarianter(){
  const el = document.getElementById('ksVarianter');
  if(!KSALG_VARIANTER){ el.innerHTML = ''; return; }
  const {leverandorer, varianter} = KSALG_VARIANTER;
  el.innerHTML = leverandorer.map(lev => {
    // Bare skrivemåter søkeordet peker på, pluss dem som allerede er bekreftet for denne
    // konkurrenten — ellers ville lista blitt uleselig.
    const aktuelle = varianter.filter(v =>
      (v.foreslatt_for || []).includes(lev.navn) || v.bekreftet_for === lev.navn);
    if(!aktuelle.length){
      return `<div style="margin-bottom:14px"><b>${esc(lev.navn)}</b>
        <span class="d-t-hint">— ingen treff på «${esc(lev.sokeord)}» i ${KSALG_VARIANTER.ar}</span></div>`;
    }
    return `<div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <b>${esc(lev.navn)}</b>
        <span class="d-t-hint">søkeord: ${esc(lev.sokeord)}</span>
        <button class="d-knapp subtil sm" onclick="ksLagreVarianter('${lev.id}')">Lagre</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;padding-left:4px">
        ${aktuelle.map(v => `
          <label style="display:flex;gap:8px;align-items:center;font-size:13px">
            <input type="checkbox" data-lev="${lev.id}" value="${esc(v.navn)}"
                   ${v.bekreftet_for === lev.navn ? 'checked' : ''}>
            <span>${esc(v.navn)}</span>
            <span class="d-t-hint">${v.rader.toLocaleString('nb-NO')} rader</span>
            ${v.bekreftet_for && v.bekreftet_for !== lev.navn
              ? `<span class="d-badge gul flat">tatt av ${esc(v.bekreftet_for)}</span>` : ''}
          </label>`).join('')}
      </div>
    </div>`;
  }).join('');
}

async function ksLagreVarianter(levId){
  const status = document.getElementById('ksStatus');
  const valgte = [...document.querySelectorAll(`input[data-lev="${levId}"]:checked`)]
    .map(i => i.value);
  try{
    await api(`/api/konkurrent-salg/leverandorer/${levId}/varianter`,
              {method:'PUT', body:{varianter: valgte}});
    status.textContent = `Lagret ${valgte.length} skrivemåter.`;
    // Hent på nytt så «tatt av»-merkingen stemmer for de andre konkurrentene.
    await ksFinnVarianterStille();
  }catch(e){ status.textContent = 'Feil ved lagring: '+e.message; }
}

async function ksFinnVarianterStille(){
  const bekreftet = await api('/api/konkurrent-salg/leverandorer');
  if(!KSALG_VARIANTER) return;
  const kart = {};
  bekreftet.forEach(l => (l.varianter || []).forEach(v => { kart[v] = l.navn; }));
  KSALG_VARIANTER.varianter.forEach(v => { v.bekreftet_for = kart[v.navn] || null; });
  ksTegnVarianter();
}

async function ksHent(){
  const status = document.getElementById('ksStatus');
  const tokenEl = document.getElementById('pbToken');
  const token = tokenEl ? tokenEl.value.trim() : '';
  if(!token){
    status.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i <b>Oppsett → Datainnhenting</b> først.</span>';
    return;
  }
  try{
    const res = await api('/api/konkurrent-salg/hent', {method:'POST', body:{token}});
    status.textContent = 'Henting startet — kan ta noen minutter …';
    ksPollJobb(res.jobb_id);
  }catch(e){ status.textContent = 'Feil: '+e.message; }
}

async function ksPollJobb(jobbId){
  const status = document.getElementById('ksStatus');
  try{
    const j = await api('/api/jobb/'+jobbId);
    if(j.status === 'kjorer'){
      status.textContent = j.fremdrift || 'kjører …';
      setTimeout(() => ksPollJobb(jobbId), 5000);
    }else if(j.status === 'ferdig'){
      const r = j.resultat || {};
      status.textContent = `Ferdig: ${(r.rader||0).toLocaleString('nb-NO')} rader for ${r.ar}, `
        + `${r.kunder_koblet||0} koblet til kundekort.`;
      ksLastFiltre();
      ksLastOgVis();
    }else{
      status.textContent = 'Feilet: ' + (j.feilmelding||'ukjent feil').slice(0,200);
    }
  }catch(e){ status.textContent = 'Feil ved statussjekk: '+e.message; }
}
