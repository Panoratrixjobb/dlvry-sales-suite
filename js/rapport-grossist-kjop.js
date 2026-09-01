// Rapportfanen «Grossistkjøp» — hva hver grossist har kjøpt av konseptproduktene i en
// fritt valgt periode. Backend: app/routers/grossist_kjop.py.
//
// Periodevelgeren er DATO utad og UKE innad: produkt_salg_uke er lagret per (år, uke), så
// datoene mappes til ISO-uker her og den faktiske uke-perioden skrives synlig i rapporten.
// Å skjule den avrundingen ville gitt et tall som ser dato-nøyaktig ut uten å være det.
//
// Ikke å forveksle med «Totalrapport (grossist — FIKS)», som viser grossistenes FULLE
// omsetning fra alle leverandører. Denne gjelder kun DLVRYs egne konseptprodukter.

const GK = {
  fra: null, til: null,           // Date-objekter; settes fra /filtre ved første last
  konsept: [],                    // tomt = alle
  grossist: '', sok: '',
  niva: 'grossist', sorter: 'belop', grense: 500,
  filtre: null, data: null, laster: false, feil: null,
};

// ---- Uke ↔ dato (ISO-8601, samme regel som backend bruker) ----
function gkIsoUke(d){
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Torsdagen i samme uke avgjør både år og ukenummer — det er hele poenget med ISO-uker,
  // og det som gjør at 31. desember kan tilhøre uke 1 året etter.
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const nyttar = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return {ar: t.getUTCFullYear(),
          uke: Math.ceil(((t - nyttar) / 86400000 + 1) / 7)};
}
function gkUkeTilDato(ar, uke){
  // Mandagen i den uka — bare til å forhåndsutfylle datofeltene fra /filtre.
  const d = new Date(Date.UTC(ar, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1) + (uke - 1) * 7);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
function gkIso(d){
  return d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
}

const GK_KONSEPT = [['la_salumeria','La Salumeria'],['east_essence','East Essence'],
  ['godt_lokalt','Godt Lokalt'],['wulff_co','Wulff & Co'],['fast_food','Fast Food'],
  ['sabor','Sabor']];

function gkSett(felt, verdi){
  GK[felt] = felt === 'grense' ? parseInt(verdi, 10) : verdi;
  lastRapGrossistKjop();
}
function gkSettDato(felt, verdi){
  if(!verdi) return;
  GK[felt] = new Date(verdi + 'T00:00:00');
  lastRapGrossistKjop();
}
function gkVelgKonsept(nokkel){
  if(!nokkel){ GK.konsept = []; }
  else {
    // Flervalg: konseptene er ikke gjensidig utelukkende, og «hva kjøper D06 av Sabor OG
    // Fast Food» er et like reelt spørsmål som ett konsept om gangen.
    const i = GK.konsept.indexOf(nokkel);
    if(i >= 0) GK.konsept.splice(i, 1); else GK.konsept.push(nokkel);
  }
  lastRapGrossistKjop();
}
function gkSok(verdi){
  GK.sok = verdi;
  clearTimeout(window._gkSokT);
  window._gkSokT = setTimeout(lastRapGrossistKjop, 350);
}

function gkParams(){
  const f = gkIsoUke(GK.fra), t = gkIsoUke(GK.til);
  const p = new URLSearchParams({fra_ar: f.ar, fra_uke: f.uke, til_ar: t.ar, til_uke: t.uke,
                                 niva: GK.niva, sorter: GK.sorter, grense: GK.grense});
  GK.konsept.forEach(k => p.append('konsept', k));
  if(GK.grossist) p.set('grossist', GK.grossist);
  if(GK.sok) p.set('sok', GK.sok);
  return p;
}

function gkEksporter(){
  const p = gkParams();
  p.delete('grense'); p.delete('sorter');
  eksporterFil('/api/rapport/grossist-kjop/eksport.xlsx?' + p.toString(),
               'grossistkjop.xlsx');
}

async function lastRapGrossistKjop(){
  const vert = document.getElementById('rapInnhold');
  if(!vert) return;
  if(!GK.filtre){
    vert.innerHTML = '<div class="rap-card"><p class="sub">Henter…</p></div>';
    try{ GK.filtre = await api('/api/rapport/grossist-kjop/filtre'); }
    catch(e){
      vert.innerHTML = '<div class="rap-card"><h3>Kunne ikke hente rapporten</h3>'
        + '<p class="sub">' + esc(e.message) + '</p></div>';
      return;
    }
    if(!GK.filtre.har_data){
      GK.filtre = null;
      vert.innerHTML = '<div class="rap-card"><h3>Ingen produktdata ennå</h3>'
        + '<p class="sub">Rapporten leser produktsalget per grossist og uke. Kjør '
        + '«Produkt og margin» i Innstillinger → Datainnhenting først.</p></div>';
      return;
    }
    // Standardperiode: hele det som finnes, men aldri lengre bak enn inneværende år —
    // ellers åpner rapporten på tre år og ser ut som om alt er ett stort tall.
    if(!GK.til) GK.til = gkUkeTilDato(GK.filtre.til.ar, GK.filtre.til.uke);
    if(!GK.fra) GK.fra = gkUkeTilDato(Math.max(GK.filtre.fra.ar, GK.filtre.til.ar), 1);
  }
  vert.innerHTML = gkSkall();
  const el = document.getElementById('gkInnhold');
  el.innerHTML = '<span class="d-sub">Henter…</span>';
  try{
    GK.data = await api('/api/rapport/grossist-kjop?' + gkParams().toString());
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Feil: ' + esc(e.message) + '</span>';
    return;
  }
  el.innerHTML = GK.niva === 'grossist' ? gkTabellGrossist(GK.data) : gkTabellProdukt(GK.data);
}

function gkSkall(){
  const f = gkIsoUke(GK.fra), t = gkIsoUke(GK.til);
  const gross = (GK.filtre.grossister || []).map(g =>
    `<option value="${esc(g)}" ${g === GK.grossist ? 'selected' : ''}>${esc(g)}</option>`).join('');
  const piller = [['', 'Alle konsepter']].concat(GK_KONSEPT).map(([k, navn]) => {
    const aktiv = k ? GK.konsept.includes(k) : GK.konsept.length === 0;
    return `<button class="rap-pill small ${aktiv ? 'aktiv' : ''}" onclick="gkVelgKonsept('${k}')">${navn}</button>`;
  }).join('');
  const sist = GK.filtre.sist_oppdatert
    ? ' · sist oppdatert ' + esc(String(GK.filtre.sist_oppdatert).slice(0, 10)) : '';
  return `<div class="d-panel">
    <div class="d-panel-hode">
      <h3>Grossistkjøp</h3>
      <span class="d-sub">Uke ${f.uke} ${f.ar} – uke ${t.uke} ${t.ar}${sist}</span>
    </div>
    <p class="d-sub" style="margin:0 0 12px">Hva hver grossist har kjøpt av <b>DLVRYs konseptprodukter</b> i perioden, med omsetning, varekost og dekningsbidrag. Grossistenes <i>fulle</i> omsetning (alle leverandører, fullsortiment) ligger i <b>Totalrapport (grossist — FIKS)</b>.</p>
    <div class="rap-subrow rap-noprint" style="margin:0 0 10px">${piller}</div>
    <div class="d-verktoy rap-noprint">
      <label class="d-sub">Fra <input type="date" class="d-input" style="width:150px;margin-left:4px"
             value="${gkIso(GK.fra)}" onchange="gkSettDato('fra',this.value)"></label>
      <label class="d-sub">Til <input type="date" class="d-input" style="width:150px;margin-left:4px"
             value="${gkIso(GK.til)}" onchange="gkSettDato('til',this.value)"></label>
      <select class="d-input" style="width:230px" onchange="gkSett('grossist',this.value)">
        <option value="">Alle grossister</option>${gross}</select>
      <select class="d-input" style="width:190px" onchange="gkSett('niva',this.value)">
        <option value="grossist" ${GK.niva === 'grossist' ? 'selected' : ''}>Per grossist</option>
        <option value="produkt" ${GK.niva === 'produkt' ? 'selected' : ''}>Per grossist og produkt</option>
      </select>
      <select class="d-input" style="width:200px" onchange="gkSett('sorter',this.value)">
        <option value="belop" ${GK.sorter === 'belop' ? 'selected' : ''}>Størst omsetning</option>
        <option value="db" ${GK.sorter === 'db' ? 'selected' : ''}>Størst dekningsbidrag</option>
        <option value="antall" ${GK.sorter === 'antall' ? 'selected' : ''}>Flest enheter</option>
        <option value="dg_lav" ${GK.sorter === 'dg_lav' ? 'selected' : ''}>Lavest dekningsgrad</option>
        <option value="dg_hoy" ${GK.sorter === 'dg_hoy' ? 'selected' : ''}>Høyest dekningsgrad</option>
      </select>
      <input class="d-input" style="width:210px" placeholder="produkt, varenr eller DLVRY-nr"
             value="${esc(GK.sok)}" oninput="gkSok(this.value)">
      <button class="d-knapp sekundar sm" onclick="gkEksporter()">Excel</button>
    </div>
    <p class="d-sub" style="margin:8px 0 12px">Perioden regnes i <b>hele uker</b> — datoene over rundes til uke ${f.uke} ${f.ar} til og med uke ${t.uke} ${t.ar}.</p>
    <div id="gkInnhold" style="font-size:13px"></div>
  </div>`;
}

// ---- Formatering ----
const gkKr = v => v == null ? '–' : (v / 1e6).toLocaleString('nb-NO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const gkPct = v => v == null ? '<span class="d-sub">–</span>'
  : v.toLocaleString('nb-NO', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' %';
const gkAnt = v => v == null ? '<span class="d-sub" title="Kvantum ble lagt til i hentingen 2026-08-20 — eldre perioder har det ikke">–</span>'
  : v.toLocaleString('nb-NO', {maximumFractionDigits: 0});
const GK_USIKKER = ' <span class="d-merke advarsel" title="Denne grossisten rapporterer ikke varekost — varekost og DB er ikke til å stole på, og dekningsgraden er kunstig høy">⚠</span>';

function gkTomt(){
  return '<div class="d-tom"><div class="d-tom-tit">Ingen kjøp i perioden</div>'
    + '<div class="d-tom-hjelp">Utvid perioden, eller fjern konsept-/grossistfilteret.</div></div>';
}

function gkSumLinje(d){
  const t = d.total;
  return `<p class="d-sub" style="margin:8px 0 0">Sum hele utvalget: <b>${gkKr(t.belop)} MNOK</b> omsetning, `
    + `<b>${gkKr(t.db)} MNOK</b> DB (${gkPct(t.dg_pct)}), fordelt på ${t.grossister} grossister og ${t.produkter} varer. `
    + `Beløp i MNOK.${d.avkortet ? ' <b>Lista er avkortet</b> — bruk Excel for hele utvalget.' : ''}</p>`;
}

function gkTabellGrossist(d){
  if(!d.rader.length) return gkTomt();
  return '<div class="table-wrap"><table class="d-tabell" style="min-width:820px"><thead><tr>'
    + '<th>Grossist</th><th>Konseptmiks</th><th class="tall">Varer</th><th class="tall">Enheter</th>'
    + '<th class="tall">Omsetning</th><th class="tall">Varekost</th><th class="tall">DB</th>'
    + '<th class="tall">DG</th><th class="tall">Andel</th></tr></thead><tbody>'
    + d.rader.map(r => `<tr>
        <td style="font-weight:600">${esc(r.grossist)}${r.margin_usikker ? GK_USIKKER : ''}</td>
        <td class="d-sub">${r.fordeling.slice(0, 3).map(k =>
            esc(k.navn) + ' ' + (r.belop ? Math.round(100 * k.belop / r.belop) : 0) + ' %').join(' · ')
          + (r.fordeling.length > 3 ? ' +' + (r.fordeling.length - 3) : '')}</td>
        <td class="tall">${r.produkter}</td>
        <td class="tall">${gkAnt(r.antall)}</td>
        <td class="tall" style="font-weight:600">${gkKr(r.belop)}</td>
        <td class="tall d-sub">${gkKr(r.kost)}</td>
        <td class="tall">${gkKr(r.db)}</td>
        <td class="tall" style="font-weight:600">${gkPct(r.dg_pct)}</td>
        <td class="tall d-sub">${gkPct(r.andel_pct)}</td></tr>`).join('')
    + '</tbody></table></div>' + gkSumLinje(d);
}

function gkTabellProdukt(d){
  if(!d.rader.length) return gkTomt();
  const kr2 = v => v == null ? '<span class="d-sub">–</span>'
    : v.toLocaleString('nb-NO', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  return '<div class="table-wrap"><table class="d-tabell" style="min-width:980px"><thead><tr>'
    + '<th>Grossist</th><th>Konsept</th><th>Varenr</th><th>Produkt</th><th>Kategori</th>'
    + '<th class="tall">Enheter</th><th class="tall">Snittpris</th><th class="tall">Omsetning</th>'
    + '<th class="tall">DB</th><th class="tall">DG</th></tr></thead><tbody>'
    + d.rader.map(r => `<tr>
        <td>${esc(r.grossist)}${r.margin_usikker ? GK_USIKKER : ''}</td>
        <td class="d-sub">${esc(r.konsept_navn || '–')}</td>
        <td>${esc(r.varenummer || '–')}</td>
        <td>${esc(r.navn || '(uten navn)')}</td>
        <td class="d-sub">${esc(r.kategori || '–')}</td>
        <td class="tall">${gkAnt(r.antall)}</td>
        <td class="tall">${kr2(r.snittpris)}</td>
        <td class="tall" style="font-weight:600">${gkKr(r.belop)}</td>
        <td class="tall">${gkKr(r.db)}</td>
        <td class="tall" style="font-weight:600">${gkPct(r.dg_pct)}</td></tr>`).join('')
    + '</tbody></table></div>' + gkSumLinje(d)
    + '<p class="d-sub" style="margin:4px 0 0">Snittpris er omsetning delt på antall enheter i perioden — den er tom der kvantum mangler, ikke null.</p>';
}
