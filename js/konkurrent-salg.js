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
let KSALG_LEV = null;         // hele leverandørlista fra Power BI, null før den er hentet
let KSALG_VALG = {};          // {leverandørnavn: gruppenavn} — lever i minnet til du lagrer

async function mountKonkurrentSalg(){
  const el = document.getElementById('sub-konkSalg');
  const kanAdmin = CURRENT_USER && ['leder','admin','superadmin'].includes(CURRENT_USER.rolle);
  if(!KSALG_MOUNTED){
    KSALG_MOUNTED = true;
    el.innerHTML = `
      <div id="ksAdmin" style="display:none;margin-bottom:16px">
        <div class="d-panel" style="padding:14px">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <select id="ksLevGrossist" class="d-select" style="width:auto"></select>
            <button class="d-knapp subtil sm" onclick="ksHentLeverandorer()">📋 Hent leverandører</button>
            <button class="d-knapp subtil sm" onclick="ksHent()">⟳ Hent salg</button>
            <span id="ksStatus" class="d-t-hint"></span>
          </div>
          <div class="d-t-hint" style="margin-top:8px">
            Hent hele leverandørlista — eventuelt for én grossist — og kryss av hvem det skal
            hentes salg for. Flere skrivemåter av samme firma kan grupperes under ett navn.
            <b>Selve salget hentes automatisk av agenten</b> (08:00, 13:00 og 15:00), så
            «Hent salg» trengs bare når du vil ha tallene med én gang — og da må du lime inn
            et token i Oppsett → Datainnhenting. Leverandørlista er derimot alltid et
            manuelt valg: den skal et menneske krysse av.
          </div>

          <div id="ksLevPanel" style="display:none;margin-top:14px">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
              <div class="d-sok" style="flex:1;min-width:200px">
                <svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/></svg>
                <input id="ksLevSok" type="search" class="d-input" placeholder="Søk leverandør…" oninput="ksTegnLeverandorer()">
              </div>
              <select id="ksLevVis" class="d-select" style="width:auto" onchange="ksTegnLeverandorer()">
                <option value="alle">Alle leverandører</option>
                <option value="kjente">Kjente konkurrenter</option>
                <option value="valgt">Bare valgte</option>
              </select>
              <button class="d-knapp subtil sm" onclick="ksVelgAlleSynlige(true)">Velg synlige</button>
              <button class="d-knapp subtil sm" onclick="ksVelgAlleSynlige(false)">Fjern synlige</button>
              <button class="d-knapp primar sm" onclick="ksLagreValg()">Lagre valg</button>
            </div>
            <div id="ksLevTeller" class="d-t-label" style="margin-bottom:6px"></div>
            <div id="ksLevListe" style="max-height:340px;overflow:auto;border:1px solid var(--d-ramme);border-radius:var(--d-radius-sm)"></div>
          </div>
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
    // Samme grossistliste i adminpanelet. Den kommer fra ALLEREDE hentede data, så før
    // første henting er den tom — da henter «Hent leverandører» for alle grossister.
    if(document.getElementById('ksLevGrossist'))
      fyll('ksLevGrossist', f.grossister || [], 'Alle grossister');
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

// ---- Velg leverandører ----
//
// ENDRET 2026-08-31: panelet viste før bare skrivemåter som liknet fem forhåndsdefinerte
// konkurrenter. Det gjorde ukjente konkurrenter usynlige — Manuele: «SGV selger tomat
// polpa fra en konkurrent som ikke er på lista». Nå hentes HELE leverandørlista for året,
// og man krysser av selv. Søkeordene til de kjente konkurrentene er beholdt som en
// snarvei («Kjente konkurrenter»-filteret), ikke som en grense.

async function ksHentLeverandorer(){
  const status = document.getElementById('ksStatus');
  const tokenEl = document.getElementById('pbToken');
  const token = tokenEl ? tokenEl.value.trim() : '';
  if(!token){
    status.innerHTML = '<span style="color:var(--d-roed)">Lim inn et token i <b>Oppsett → Datainnhenting</b> først.</span>';
    return;
  }
  const grossist = document.getElementById('ksLevGrossist').value;
  status.textContent = 'Leser leverandørlista fra Power BI …';
  try{
    const sti = '/api/konkurrent-salg/alle-leverandorer'
      + (grossist ? '?grossist=' + encodeURIComponent(grossist) : '');
    KSALG_LEV = await api(sti, {method:'POST', body:{token}});
    status.textContent = `${KSALG_LEV.antall_leverandorer.toLocaleString('nb-NO')} leverandører i ${KSALG_LEV.ar}`
      + (grossist ? ` hos ${grossist}` : '')
      + `. ${KSALG_LEV.antall_valgt} er valgt fra før.`;
    // Valgene lever i minnet mens du jobber, og skrives først når du trykker Lagre.
    KSALG_VALG = {};
    KSALG_LEV.leverandorer.forEach(l => {
      if(l.valgt_som) KSALG_VALG[l.navn] = l.valgt_som;
    });
    document.getElementById('ksLevPanel').style.display = '';
    ksTegnLeverandorer();
  }catch(e){ status.textContent = 'Feil: '+e.message; }
}

function ksLevFiltrert(){
  if(!KSALG_LEV) return [];
  const sok = (document.getElementById('ksLevSok').value || '').trim().toLowerCase();
  const vis = document.getElementById('ksLevVis').value;
  return KSALG_LEV.leverandorer.filter(l => {
    if(sok && !l.navn.toLowerCase().includes(sok)) return false;
    if(vis === 'valgt') return !!KSALG_VALG[l.navn];
    if(vis === 'kjente') return (l.foreslatt_for || []).length > 0;
    return true;
  });
}

// Lista kan være flere tusen navn. Vi tegner et tak av gangen — søkefeltet er måten å
// komme til resten, og antallet som ikke vises sies eksplisitt fra om, slik at en kuttet
// liste aldri ser komplett ut.
const KSALG_VIS_MAKS = 300;

function ksTegnLeverandorer(){
  const el = document.getElementById('ksLevListe');
  const alle = ksLevFiltrert();
  const vises = alle.slice(0, KSALG_VIS_MAKS);
  const antallValgt = Object.keys(KSALG_VALG).length;
  document.getElementById('ksLevTeller').textContent =
    `${antallValgt} valgt · viser ${vises.length} av ${alle.length}`
    + (alle.length > vises.length ? ' — søk for å finne resten' : '');

  if(!vises.length){
    el.innerHTML = '<div class="d-t-hint" style="padding:8px">Ingen leverandører i dette utvalget.</div>';
    return;
  }
  el.innerHTML = vises.map(l => {
    const valgt = !!KSALG_VALG[l.navn];
    const gruppe = KSALG_VALG[l.navn] || '';
    const forslag = (l.foreslatt_for || [])[0];
    return `
      <div style="display:flex;gap:10px;align-items:center;padding:5px 4px;border-bottom:1px solid var(--d-ramme)">
        <input type="checkbox" ${valgt ? 'checked' : ''}
               onchange="ksToggleLev(this, '${escJsAttr(l.navn)}', '${escJsAttr(forslag || l.navn)}')">
        <span style="flex:1;min-width:0;font-size:13px">${esc(l.navn)}</span>
        ${forslag ? `<span class="d-badge graa flat" title="Ligner en forhåndsdefinert konkurrent">${esc(forslag)}</span>` : ''}
        <span class="d-t-hint" style="white-space:nowrap">${l.rader.toLocaleString('nb-NO')} rader</span>
        <input class="d-input sm" style="width:180px" placeholder="grupper som…"
               value="${esc(gruppe)}" ${valgt ? '' : 'disabled'}
               onchange="ksSettGruppe('${escJsAttr(l.navn)}', this.value)"
               title="Flere skrivemåter av samme firma får samme navn her og blir én linje i rapporten">
      </div>`;
  }).join('');
}

function ksToggleLev(input, navn, standardGruppe){
  if(input.checked) KSALG_VALG[navn] = KSALG_VALG[navn] || standardGruppe || navn;
  else delete KSALG_VALG[navn];
  ksTegnLeverandorer();
}

function ksSettGruppe(navn, verdi){
  // Tom gruppe = leverandøren er sin egen gruppe. Det er det man vil ha for et navn
  // plukket ad hoc, og backend gjør det samme hvis feltet står tomt.
  KSALG_VALG[navn] = (verdi || '').trim() || navn;
}

function ksVelgAlleSynlige(pa){
  ksLevFiltrert().slice(0, KSALG_VIS_MAKS).forEach(l => {
    if(pa) KSALG_VALG[l.navn] = KSALG_VALG[l.navn] || (l.foreslatt_for || [])[0] || l.navn;
    else delete KSALG_VALG[l.navn];
  });
  ksTegnLeverandorer();
}

async function ksLagreValg(){
  const status = document.getElementById('ksStatus');
  const valg = Object.entries(KSALG_VALG).map(([variant, konkurrent]) => ({variant, konkurrent}));
  try{
    const r = await api('/api/konkurrent-salg/valg', {method:'PUT', body:{valg}});
    status.textContent = `Lagret ${r.antall_valgt} leverandører i ${r.konkurrenter.length} grupper. `
      + 'Trykk «Hent salg» for å hente tallene.';
  }catch(e){ status.textContent = 'Feil ved lagring: '+e.message; }
}

async function ksHent(){
  const status = document.getElementById('ksStatus');
  const tokenEl = document.getElementById('pbToken');
  const token = tokenEl ? tokenEl.value.trim() : '';
  if(!token){
    // Agenten henter dette av seg selv tre ganger om dagen (2026-09-03), så et manglende
    // token er sjelden et problem man må løse — bare en grunn til å vente. Meldingen sier
    // derfor når det kommer, i stedet for bare å be om et token.
    status.innerHTML = '<span style="color:var(--advarsel)">Agenten henter konkurrentsalget '
      + 'automatisk 08:00, 13:00 og 15:00. Vil du ha det <b>nå</b>, lim inn et token i '
      + '<b>Oppsett → Datainnhenting</b> først.</span>';
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
