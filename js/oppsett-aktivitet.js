// Innstillinger → Aktivitet: hvem logger inn, hvor ofte, og hva de jobber med.
// Backend: app/hendelseslogg.py (skriving) + app/routers/aktivitetslogg.py (lesing).
//
// Bakgrunn 2026-09-01: appen hadde ingen sporbarhet på bruk. Da Nicolai Stavnes ikke kom
// inn, var «har han i det hele tatt forsøkt?» umulig å svare på. Oversikten under er
// bygget rundt nettopp det spørsmålet: kolonnen «Aldri logget inn» er den viktigste, og
// feilede innloggingsforsøk vises eksplisitt — inkludert forsøk på e-postadresser som
// ikke finnes, som er den vanligste årsaken til at noen ikke kommer inn.
let AKT_DAGER = 30, AKT_VALGT_BRUKER = null, AKT_DATA = null;

function aktTid(t){
  if(!t) return '—';
  const d = new Date(t), naa = new Date();
  const timer = (naa - d) / 36e5;
  if(timer < 24) return d.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'}) + ' i dag';
  if(timer < 48) return 'i går ' + d.toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('nb-NO',{day:'2-digit',month:'short'}) +
         (timer > 24*300 ? ' ' + d.getFullYear() : '');
}

function aktSettDager(d){ AKT_DAGER = d; lastAktivitetslogg(); }

async function lastAktivitetslogg(){
  const el = document.getElementById('aktInnhold');
  if(!el) return;
  el.innerHTML = '<span class="sub">Laster…</span>';
  try{
    AKT_DATA = await api('/api/aktivitetslogg/brukere?dager=' + AKT_DAGER);
    tegnAktivitetslogg();
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Kunne ikke hente aktivitetsloggen: ' + esc(e.message) + '</span>';
  }
}

function tegnAktivitetslogg(){
  const el = document.getElementById('aktInnhold');
  const d = AKT_DATA;
  if(!d){ el.innerHTML = ''; return; }

  const brukere = d.brukere.filter(b => b.aktiv);
  const aldri = brukere.filter(b => !b.siste_innlogging);
  const perioden = document.getElementById('aktPeriode');
  if(perioden) perioden.textContent = 'Siste ' + d.dager + ' dager';
  document.querySelectorAll('[data-aktdager]').forEach(b =>
    b.classList.toggle('aktiv', Number(b.dataset.aktdager) === AKT_DAGER));

  let h = '';

  // Sammendrag øverst: det man vil se uten å lese en tabell.
  h += '<div style="display:flex;gap:26px;flex-wrap:wrap;margin-bottom:16px">'
    + aktNokkeltall(brukere.filter(b => b.siste_innlogging).length + ' av ' + brukere.length, 'har logget inn i perioden')
    + aktNokkeltall(aldri.length, 'har ALDRI logget inn', aldri.length ? 'var(--d-roed)' : null)
    + aktNokkeltall(brukere.reduce((s,b) => s + Number(b.handlinger||0), 0), 'registrerte handlinger')
    + '</div>';

  if(aldri.length){
    h += '<div style="margin-bottom:16px;padding:10px 12px;border-radius:8px;font-size:13px;color:var(--d-gul);background:var(--d-gul-bg)">'
      + '<b>Har aldri logget inn:</b> ' + aldri.map(b => esc(b.navn)).join(', ')
      + '. Disse har fått bruker, men aldri tatt appen i bruk.</div>';
  }

  if(d.ukjente_epostforsok.length){
    h += '<div style="margin-bottom:16px;padding:10px 12px;border-radius:8px;font-size:13px;color:var(--d-gul);background:var(--d-gul-bg)"><b>Innloggingsforsøk på ukjente e-poster</b>'
      + ' — noen taster trolig feil adresse:<br>'
      + d.ukjente_epostforsok.map(u =>
          esc(u.epost || '(tom)') + ' — ' + u.forsok + ' forsøk, sist ' + esc(aktTid(u.siste))
        ).join('<br>') + '</div>';
  }

  h += '<table class="d-tabell"><thead><tr>'
    + '<th>Bruker</th><th>Rolle</th><th>Siste innlogging</th><th style="text-align:right">Innlogginger</th>'
    + '<th style="text-align:right">Dager brukt</th><th style="text-align:right">Handlinger</th>'
    + '<th>Jobbet sist med</th><th style="text-align:right">Feilede forsøk</th>'
    + '</tr></thead><tbody>';
  for(const b of brukere){
    const stille = !b.siste_innlogging;
    h += '<tr style="cursor:pointer' + (stille ? ';opacity:.65' : '') + '" onclick="aktVisBruker(\'' + b.id + '\')">'
      + '<td class="d-navn">' + esc(b.navn) + '<div class="d-sub">' + esc(b.epost) + '</div></td>'
      + '<td>' + esc(b.rolle) + '</td>'
      + '<td' + (stille ? ' style="color:var(--d-roed)"' : '') + '>'
        + (stille ? 'aldri' : esc(aktTid(b.siste_innlogging))) + '</td>'
      + '<td style="text-align:right">' + b.innlogginger + '</td>'
      + '<td style="text-align:right">' + b.aktive_dager + '</td>'
      + '<td style="text-align:right">' + b.handlinger + '</td>'
      + '<td class="d-sub">' + esc(b.siste_handling_tekst || '—') + '</td>'
      + '<td style="text-align:right' + (b.feilede_innlogginger ? ';color:var(--d-roed)' : '') + '">'
        + b.feilede_innlogginger + '</td>'
      + '</tr>';
  }
  h += '</tbody></table>';
  h += '<p class="sub" style="margin-top:10px">Klikk en rad for å se hva personen faktisk har gjort. '
    + '«Dager brukt» = antall ulike dager med innlogging — et bedre mål på reell bruk enn antall innlogginger. '
    + 'Loggen startet 01.09.2026; alt før det finnes ikke.</p>';
  h += '<div id="aktDetalj" style="margin-top:18px"></div>';
  el.innerHTML = h;
  if(AKT_VALGT_BRUKER) aktVisBruker(AKT_VALGT_BRUKER);
}

function aktNokkeltall(verdi, tekst, farge){
  return '<div><div style="font-size:26px;font-weight:600'
    + (farge ? ';color:' + farge : '') + '">' + esc(verdi) + '</div>'
    + '<div class="sub">' + esc(tekst) + '</div></div>';
}

async function aktVisBruker(brukerId){
  AKT_VALGT_BRUKER = brukerId;
  const el = document.getElementById('aktDetalj');
  if(!el) return;
  const bruker = (AKT_DATA?.brukere || []).find(b => b.id === brukerId);
  el.innerHTML = '<span class="sub">Laster hendelser…</span>';
  try{
    const rader = await api('/api/aktivitetslogg/hendelser?dager=' + AKT_DAGER
      + '&bruker_id=' + encodeURIComponent(brukerId) + '&grense=300');
    let h = '<div class="d-panel-hode midtstilt" style="margin-bottom:8px">'
      + '<h3 style="margin:0">' + esc(bruker ? bruker.navn : 'Bruker') + ' — hendelser</h3>'
      + '<button class="d-knapp subtil sm" onclick="aktLukkDetalj()">Lukk</button></div>';
    if(!rader.length){
      h += '<span class="sub">Ingen registrert aktivitet i perioden.</span>';
    }else{
      h += '<table class="d-tabell"><thead><tr><th>Tid</th><th>Handling</th><th>Gjelder</th>'
        + '<th style="text-align:right">Ganger</th></tr></thead><tbody>';
      for(const r of rader){
        const feilet = r.type === 'innlogging_feilet';
        h += '<tr><td>' + esc(aktTid(r.siste_tid)) + '</td>'
          + '<td' + (feilet ? ' style="color:var(--d-roed)"' : '') + '>' + esc(r.handling || '') + '</td>'
          // ressurs_navn er kundenavnet (også for kalkyler, via kalkyle.kunde_id).
          // Mangler det, viser vi ressurstypen — aldri en rå UUID, som ingen kan lese.
          + '<td class="d-sub">' + esc(r.ressurs_navn || r.ressurs_type || '') + '</td>'
          + '<td style="text-align:right">' + (r.antall > 1 ? r.antall : '') + '</td></tr>';
      }
      h += '</tbody></table>';
    }
    el.innerHTML = h;
    el.scrollIntoView({behavior:'smooth', block:'nearest'});
  }catch(e){
    el.innerHTML = '<span style="color:var(--d-roed)">Kunne ikke hente hendelser: ' + esc(e.message) + '</span>';
  }
}

function aktLukkDetalj(){
  AKT_VALGT_BRUKER = null;
  const el = document.getElementById('aktDetalj');
  if(el) el.innerHTML = '';
}
