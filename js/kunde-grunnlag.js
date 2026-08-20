// Kundens eget kjøpsbilde i tilbudsverktøyet — «hva kjøper de i dag, og hva betaler de?»
//
// Bestilt av Manuele 2026-08-20: når en kalkyle tilknyttes en kunde, skal kundens data
// lastes opp — hvilke produkter kunden allerede kjøper, og prisene den betaler i dag
// (fra siste fakturaer). Data kommer fra ETT endepunkt,
// GET /api/kalkyler/kundegrunnlag/{kunde_id} (konseptsuite-backend/app/routers/
// kundegrunnlag.py), som slår sammen tre kilder: realisert produktsalg fra Consolidated
// Model, fakturapriser lagret på kunden, og prisene vi selv ga i tidligere tilbud.
//
// TO BEVISSTE VALG:
//
// 1. Linjer legges IKKE inn i kalkylen automatisk. En kalkyle er et pristilbud, ikke en
//    rapport — 40 varelinjer med antall 1 dumpet inn i en åpen kalkyle ville vært et
//    dokument selgeren måtte rydde i, ikke et forsprang. Grunnlaget vises ved siden av, med
//    ett klikk per vare og en «legg til alle»-knapp.
//
// 2. Antall settes til 1, ikke til kundens volum — også nå som volumet er EKTE.
//    2026-08-20 fikk modellen «# Antall Solgte Enheter», så backend leverer nå både faktisk
//    antall solgte enheter siste 12 mnd (v.antall) og kundens realiserte snittpris
//    (v.snittpris). «Legg til med årsvolum»-knappen bruker det ekte tallet der det finnes,
//    og faller tilbake på det gamle estimatet (omsetning delt på vår egen tilbudspris) der
//    kvantum mangler. Standarden er fortsatt 1: grunnen til det valget var aldri at tallet
//    var et estimat, men at et helt års volum lagt inn ubedt blåser opp både omsetning og
//    margin i et dokument som skal ut til kunde. Selgeren skal be om det.

const KUNDEGRUNNLAG = {
  data: null,        // svaret fra backend
  kundeId: null,     // kunden dataene gjelder
  kalkyleId: null,   // kalkylen de ble hentet for (holdes utenfor «dagens pris»)
  priser: {},        // varenummer (normalisert) → {pris,kilde,dato,detalj} for kurvcellene
  henter: false,
  apen: true,
  feil: null,
};

const _kgNok = (v) => String(v == null ? '' : v).trim().toUpperCase();

// ---------- Henting ----------

async function lastKundegrunnlag(tving) {
  const kundeId = state.custId;
  const panel = document.getElementById('kundegrunnlagPanel');
  if (!panel) return;
  if (!kundeId) { nullstillKundegrunnlag(); return; }
  // Samme kunde + samme kalkyle → allerede lastet. Uten dette ville render() kunne
  // trigge en ny henting for hver tastetrykk i tabellen.
  if (!tving && KUNDEGRUNNLAG.kundeId === kundeId && KUNDEGRUNNLAG.kalkyleId === state.calcId) return;
  if (KUNDEGRUNNLAG.henter) return;

  KUNDEGRUNNLAG.henter = true;
  KUNDEGRUNNLAG.feil = null;
  KUNDEGRUNNLAG.kundeId = kundeId;
  KUNDEGRUNNLAG.kalkyleId = state.calcId;
  panel.style.display = '';
  document.getElementById('kundegrunnlagInnhold').innerHTML =
    '<p class="d-sub" style="margin:0;padding:8px 0">Henter kundens kjøpshistorikk og priser…</p>';
  document.getElementById('kgHandlinger').innerHTML = '';
  try {
    const qs = state.calcId ? ('?utelat_kalkyle_id=' + encodeURIComponent(state.calcId)) : '';
    KUNDEGRUNNLAG.data = await api('/api/kalkyler/kundegrunnlag/' + kundeId + qs);
    KUNDEGRUNNLAG.priser = {};
    (KUNDEGRUNNLAG.data.varer || []).forEach((v) => {
      if (v.dagens_pris && v.varenummer) KUNDEGRUNNLAG.priser[_kgNok(v.varenummer)] = v.dagens_pris;
    });
    // Full kalkyle er allerede i gang → grunnlaget er referanse, ikke startpunkt.
    KUNDEGRUNNLAG.apen = !(state.cart && state.cart.length);
  } catch (e) {
    KUNDEGRUNNLAG.data = null;
    KUNDEGRUNNLAG.priser = {};
    KUNDEGRUNNLAG.feil = e.message || String(e);
  } finally {
    KUNDEGRUNNLAG.henter = false;
    tegnKundegrunnlag();
    render();   // kurvcellene viser «i dag»-prisen, og må tegnes på nytt med nye data
  }
}

function nullstillKundegrunnlag() {
  KUNDEGRUNNLAG.data = null;
  KUNDEGRUNNLAG.kundeId = null;
  KUNDEGRUNNLAG.kalkyleId = null;
  KUNDEGRUNNLAG.priser = {};
  KUNDEGRUNNLAG.feil = null;
  const panel = document.getElementById('kundegrunnlagPanel');
  if (panel) panel.style.display = 'none';
}

function kgVisSkjul() {
  KUNDEGRUNNLAG.apen = !KUNDEGRUNNLAG.apen;
  tegnKundegrunnlag();
}

// ---------- Visning ----------

function _kgKilde(p) {
  if (!p) return '';
  // Snittprisen har måned, ikke dag — å kjøre den gjennom toLocaleDateString ville gitt
  // «01.08.2026» og latt et 12-måneders snitt se ut som én bestemt handel.
  if (p.kilde === 'salgsdata') {
    return '<span title="Kundens egen omsetning delt på antall solgte enheter siste 12 mnd. '
      + 'Et snitt over perioden, ikke prisen på én bestemt handel.">'
      + esc(p.detalj || 'Snittpris siste 12 mnd') + '</span>';
  }
  const dato = p.dato ? new Date(p.dato).toLocaleDateString('nb-NO') : '';
  return esc(p.detalj || (p.kilde === 'faktura' ? 'Faktura' : 'Vårt tilbud')) + (dato ? ' · ' + dato : '');
}

/* Kundens årsvolum på varen. To kilder, i denne rekkefølgen:

   1. v.antall — EKTE antall solgte enheter siste 12 mnd, rett fra modellen (2026-08-20).
      Ikke et estimat i det hele tatt, og finnes på ~99 % av omsetningen når hentingen er
      kjørt på nytt.
   2. Det gamle estimatet: omsetningen delt på enhetsprisen. Bare meningsfullt når prisen
      er VÅR EGEN (fra et tidligere tilbud) — en konkurrents fakturapris delt på vår
      omsetning er to ulike verdikjeder og gir et tall som ser presist ut uten å være det.

   Returnerer null når ingen av delene finnes. _kgEktAntall() sier hvilken av de to det ble,
   så knappen kan si «årsvolum» når tallet er målt og «est. årsvolum» når det er utledet. */
function _kgEktAntall(v) {
  const n = Number(v.antall);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function _kgEstAntall(v) {
  const ekte = _kgEktAntall(v);
  if (ekte) return ekte;
  if (!v.dagens_pris || v.dagens_pris.kilde !== 'tilbud') return null;
  if (!v.belop || !(v.dagens_pris.pris > 0)) return null;
  const n = Math.round(v.belop / v.dagens_pris.pris);
  return n > 0 ? n : null;
}

function tegnKundegrunnlag() {
  const panel = document.getElementById('kundegrunnlagPanel');
  if (!panel) return;
  if (!state.custId) { panel.style.display = 'none'; return; }
  panel.style.display = '';

  const under = document.getElementById('kgUnder');
  const handlinger = document.getElementById('kgHandlinger');
  const presEl = document.getElementById('kgPresisjon');
  const el = document.getElementById('kundegrunnlagInnhold');

  if (KUNDEGRUNNLAG.feil) {
    presEl.textContent = '';
    under.textContent = '';
    handlinger.innerHTML = '<button class="d-knapp subtil" onclick="lastKundegrunnlag(true)">Prøv igjen</button>';
    el.innerHTML = '<p class="d-sub" style="color:var(--feil);margin:0;padding:8px 0">Kunne ikke hente kundegrunnlaget: '
      + esc(KUNDEGRUNNLAG.feil) + '</p>';
    return;
  }
  const d = KUNDEGRUNNLAG.data;
  if (!d) { el.innerHTML = ''; return; }

  const varer = d.varer || [];
  const kjopte = varer.filter((v) => v.fra_salgsdata);

  presEl.innerHTML = d.presisjon === 'orgnr'
    ? '<span class="d-merke advarsel" title="Kunden har ikke et entydig kundenummer i salgsdataene — tallene er summert på org.nr og kan dekke flere utleveringssteder">org.nr-nivå</span>'
    : '';

  const periode = d.periode && d.periode.fra
    ? ('siste 12 mnd (' + esc(d.periode.fra) + ' – ' + esc(d.periode.til) + ')')
    : 'siste 12 mnd';
  under.innerHTML = !d.produktdata_hentet
    ? 'Produktsalg per kunde er ikke hentet ennå (Oppsett → Alle kunder: produktmiks). Viser bare priser vi kjenner fra faktura og tidligere tilbud.'
    : (kjopte.length
        ? (esc(String(d.antall_varer)) + ' varer · ' + fmtKr(d.omsetning) + ' omsetning ' + periode
           + (d.dg_pct == null ? '' : ' · DG ' + d.dg_pct.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %')
           + ' · pris kjent på ' + d.antall_med_pris + ' av ' + varer.length + ' linjer under'
           // Splitt bare når det FINNES snittpriser å skille ut — ellers er den gamle,
           // korte setningen riktigere enn «… (0 fra snittpris)».
           + (d.antall_med_snittpris
               ? ' (' + d.antall_med_punktpris + ' fra faktura/tilbud, '
                 + d.antall_med_snittpris + ' fra snittpris)'
               : ''))
        : 'Ingen produktrader på denne kunden i ' + periode + '.');

  const kanLegges = varer.filter((v) => v.varenummer && findProd(v.varenummer));
  const medEst = kanLegges.filter((v) => _kgEstAntall(v));
  // Er volumet MÅLT for de fleste, skal knappen ikke si «est.» — det ville undersolgt et
  // tall som nå kommer rett fra modellen. Er det blandet, vinner det svakeste ordet.
  const altEkte = medEst.length > 0 && medEst.every((v) => _kgEktAntall(v));
  handlinger.innerHTML =
    (kanLegges.length
      ? '<button class="d-knapp primar" onclick="kgLeggTilAlle(false)">Legg til alle ' + kanLegges.length + ' varer</button>'
        + (medEst.length
            ? '<button class="d-knapp sekundar" onclick="kgLeggTilAlle(true)" title="'
              + (altEkte
                  ? 'Antall = kundens faktiske antall solgte enheter siste 12 mnd, fra Consolidated Model.'
                  : 'Antall = kundens faktiske volum der modellen har det, ellers omsetning siste 12 mnd delt på prisen vi sist ga. Kontroller det.')
              + '">Legg til med ' + (altEkte ? 'årsvolum' : 'est. årsvolum') + '</button>'
            : '')
      : '')
    + (d.forrige_kalkyle
        ? '<button class="d-knapp subtil" onclick="kgBrukForrigeRabatt()" title="Generell rabatt '
          + d.forrige_kalkyle.genrabatt + ' % og kjedebonus ' + d.forrige_kalkyle.kjedebonus + ' % fra «'
          + esc(d.forrige_kalkyle.navn) + '»">Bruk forrige rabattstruktur</button>'
        : '')
    + '<button class="d-knapp subtil" onclick="kgVisSkjul()">' + (KUNDEGRUNNLAG.apen ? 'Skjul' : 'Vis') + '</button>';

  if (!KUNDEGRUNNLAG.apen) { el.innerHTML = ''; return; }

  if (!varer.length) {
    el.innerHTML = '<p class="d-sub" style="margin:0;padding:8px 0">'
      + (d.produktdata_hentet
          ? 'Vi har verken kjøpshistorikk eller registrerte priser på denne kunden ennå. Last opp en faktura under «Verktøy → Importer fra faktura» for å registrere prisene kunden betaler i dag.'
          : 'Ingen priser registrert på kunden ennå.')
      + '</p>';
    return;
  }

  const forrigeLinje = d.forrige_kalkyle
    ? '<p class="d-sub" style="margin:10px 0 0;font-size:11px">Forrige kalkyle: <b>' + esc(d.forrige_kalkyle.navn)
      + '</b> (' + esc(d.forrige_kalkyle.dato || '') + ', ' + esc(d.forrige_kalkyle.status || '')
      + ') · ' + fmtKr(d.forrige_kalkyle.snap_oms) + ' · rabatt ' + d.forrige_kalkyle.genrabatt
      + ' % / bonus ' + d.forrige_kalkyle.kjedebonus + ' %'
      + (d.antall_kalkyler > 1 ? ' · ' + d.antall_kalkyler + ' kalkyler totalt på kunden' : '') + '</p>'
    : '';

  el.innerHTML =
    '<div class="table-wrap" style="max-height:340px;overflow:auto">'
    + '<table class="d-tabell" style="font-size:12.5px"><thead><tr>'
    + '<th>Art.nr</th><th>Produkt</th><th>Konsept</th>'
    + '<th style="text-align:right">Omsetning 12 mnd</th><th style="text-align:right">Andel</th>'
    + '<th style="text-align:right">DG</th>'
    + '<th style="text-align:right">Betaler i dag</th><th>Kilde</th>'
    + '<th style="text-align:right">Vår listepris</th><th style="text-align:right">Diff</th><th></th>'
    + '</tr></thead><tbody>'
    + varer.map(_kgRad).join('')
    + '</tbody></table></div>'
    + forrigeLinje
    + '<p class="d-sub" style="margin:8px 0 0;font-size:11px">Omsetning og DG er realiserte tall fra Consolidated Model (samme kilde som kundekortet). '
    + '«Betaler i dag» er enhetspris fra siste opplastede faktura på kunden, ellers prisen vi selv ga i forrige tilbud, '
    + 'ellers kundens egen snittpris siste 12 mnd (omsetning delt på antall solgte enheter). '
    + 'Snittprisen er nettopp et snitt over perioden og kan dekke flere prisnivåer — en fersk faktura går alltid foran. '
    + 'Enheten er den varen selges i, som ikke alltid er den vår prisliste bruker; kontroller store avvik mot listepris. '
    + 'Varer legges inn med antall 1.</p>';
}

function _kgRad(v, i) {
  const prod = v.varenummer ? findProd(v.varenummer) : null;
  const p = v.dagens_pris;
  const iKurv = !!(prod && state.cart.some((l) => _kgNok(l.art) === _kgNok(v.varenummer)));
  // Diff = vår listepris mot prisen kunden betaler i dag. Positiv = vi ligger høyere og
  // må ned med rabatt for å møte dem; negativ = vi ligger allerede under.
  let diff = '';
  if (prod && p && prod.listepris > 0) {
    const d = (prod.listepris - p.pris) / p.pris;
    diff = '<span style="color:' + (d > 0 ? 'var(--advarsel)' : 'var(--ok)') + '">'
      + (d > 0 ? '+' : '') + (d * 100).toLocaleString('nb-NO', { maximumFractionDigits: 1 }) + ' %</span>';
  }
  const knapp = !v.varenummer
    ? '<span class="d-sub" style="font-size:11px">—</span>'
    : (!prod
        ? '<span class="d-sub" style="font-size:11px" title="Varenummeret finnes ikke i produkter.json — søk opp varen manuelt nedenfor">ikke i katalogen</span>'
        : (iKurv
            ? '<span class="d-sub" style="font-size:11px;color:var(--ok)">i kalkylen ✓</span>'
            : '<button class="d-knapp subtil sm" onclick="kgLeggTil(' + i + ')">Legg til</button>'));

  return '<tr' + (v.fra_salgsdata ? '' : ' title="Vi kjenner en pris på denne varen, men den ligger ikke i kundens salgshistorikk hos oss"') + '>'
    + '<td>' + esc(v.varenummer || '—') + '</td>'
    + '<td>' + esc(v.navn || '—') + (v.fra_salgsdata ? '' : ' <span class="d-merke noytral" style="font-size:10px">kun pris</span>') + '</td>'
    + '<td class="d-sub">' + esc(v.konsept_navn || '—') + '</td>'
    + '<td style="text-align:right">' + (v.belop == null ? '—' : fmtKr(v.belop)) + '</td>'
    + '<td style="text-align:right">' + (v.andel_pct == null ? '—' : v.andel_pct.toLocaleString('nb-NO', { maximumFractionDigits: 1 }) + ' %') + '</td>'
    + '<td style="text-align:right">' + (v.dg_pct == null ? '—' : v.dg_pct.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %') + '</td>'
    + '<td style="text-align:right"><b>' + (p ? fmtKr2(p.pris) : '—') + '</b></td>'
    + '<td class="d-sub" style="font-size:11px">' + _kgKilde(p) + '</td>'
    + '<td style="text-align:right">' + (prod ? fmtKr2(prod.listepris) : '—') + '</td>'
    + '<td style="text-align:right">' + (diff || '—') + '</td>'
    + '<td style="text-align:right">' + knapp + '</td>'
    + '</tr>';
}

// ---------- Handlinger ----------

function _kgLeggTilVare(v, brukEstimat) {
  const prod = v.varenummer ? findProd(v.varenummer) : null;
  if (!prod) return false;
  if (state.cart.some((l) => _kgNok(l.art) === _kgNok(v.varenummer))) return false;
  const antall = (brukEstimat && _kgEstAntall(v)) || 1;
  const linje = lineFromProd(prod, antall);
  // Prisen kunden betaler i dag er referansen selgeren priser mot. Den legges inn som
  // konkurrentpris KUN når den faktisk kommer fra en faktura — vår egen forrige tilbudspris
  // er ikke en konkurrentpris, og skal ikke farge konkurranse-kolonnen. Den vises i stedet
  // under endelig salgspris via kundeprisCelle().
  if (v.dagens_pris && v.dagens_pris.kilde === 'faktura') {
    linje.konkurrentpris = v.dagens_pris.pris;
  }
  state.cart.push(linje);
  return true;
}

function kgLeggTil(i) {
  const v = (KUNDEGRUNNLAG.data && KUNDEGRUNNLAG.data.varer || [])[i];
  if (!v) return;
  if (!_kgLeggTilVare(v, false)) { toast('Varen ligger allerede i kalkylen'); return; }
  markDirty(); render(); tegnKundegrunnlag();
  toast((v.navn || v.varenummer) + ' lagt til');   // toast setter textContent — ikke esc her
}

function kgLeggTilAlle(brukEstimat) {
  const varer = (KUNDEGRUNNLAG.data && KUNDEGRUNNLAG.data.varer) || [];
  let n = 0;
  varer.forEach((v) => { if (_kgLeggTilVare(v, brukEstimat)) n++; });
  if (!n) { toast('Ingen nye varer å legge til'); return; }
  markDirty(); render(); tegnKundegrunnlag();
  toast(n + (brukEstimat ? ' varer lagt til med estimert årsvolum — kontroller antallene' : ' varer lagt til'));
}

function kgBrukForrigeRabatt() {
  const f = KUNDEGRUNNLAG.data && KUNDEGRUNNLAG.data.forrige_kalkyle;
  if (!f) return;
  document.getElementById('genrabatt').value = f.genrabatt;
  document.getElementById('kjedebonus').value = f.kjedebonus;
  markDirty(); render();
  toast('Rabatt ' + f.genrabatt + ' % og kjedebonus ' + f.kjedebonus + ' % hentet fra «' + f.navn + '»');
}

// ---------- Kurvcelle ----------

/* Vises under endelig salgspris i kalkyletabellen: hva kunden betaler for VAREN i dag, og
   hvor vi ligger mot den. Samme idé som markedCelle() i kalkyle-margin.js — tallet selgeren
   trenger skal stå der prisen settes, ikke i en rapport ved siden av. */
function kundeprisCelle(x) {
  const p = KUNDEGRUNNLAG.priser[_kgNok(x.l.art)];
  if (!p || !(p.pris > 0)) return '';
  const diff = x.endelig - p.pris;
  const farge = Math.abs(diff) < 0.005 ? 'var(--muted)' : (diff <= 0 ? 'var(--ok)' : 'var(--advarsel)');
  const pil = Math.abs(diff) < 0.005 ? '=' : (diff < 0 ? '▼' : '▲');
  const tittel = 'Kunden betaler ' + fmtKr2(p.pris) + ' i dag — ' + (p.detalj || '')
    + (p.dato ? ' (' + new Date(p.dato).toLocaleDateString('nb-NO') + ')' : '');
  return '<div style="font-size:10px;font-weight:500;color:' + farge + '" title="' + esc(tittel) + '">'
    + 'i dag ' + fmtKr2(p.pris) + ' ' + pil + '</div>';
}
