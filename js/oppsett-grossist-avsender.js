// Innstillinger > Grossister — avsenderdata for tilbuds-PDF-en. Lagt til 2026-08-31.
//
// Hva panelet er til for: brevhodet på tilbudet kunden får er GROSSISTENS, ikke
// DLVRYs. Navn, adresse, org.nr. og logo må derfor stå et sted noen kan rette dem
// uten en ny utrulling. Org.nr. og logofil er seedet fra navn ved oppstart (se
// backend app/grossist_avsender.py); alt som ikke traff, fylles ut her.
//
// «Hent fra BRreg» henter juridisk navn + forretningsadresse på org.nr. Wulff har
// avdelinger — BRreg svarer på hovedenheten, som er det første versjon skal bruke.
//
// Logo lastes opp som data-URL. Nedskaleringen skjer HER, i nettleseren: originalene
// er opptil 800 kB, og en ubehandlet logo ville ligget i både databasen og hvert
// eneste tilbud. Backend har bevisst ingen bildeavhengighet.

let GA_RADER = [];

async function lastGrossistAvsendere(){
  const el = document.getElementById('gaInnhold');
  if(!el) return;
  el.innerHTML = '<p class="d-sub">Laster…</p>';
  try{ GA_RADER = await api('/api/grossister/avsendere-admin') || []; }
  catch(e){ el.innerHTML = '<p style="color:var(--d-roed)">Kunne ikke hente grossister: '+esc(e.message)+'</p>'; return; }
  tegnGrossistAvsendere();
}

function tegnGrossistAvsendere(){
  const el = document.getElementById('gaInnhold');
  if(!GA_RADER.length){ el.innerHTML = '<p class="d-sub">Ingen grossister registrert.</p>'; return; }
  const mangler = GA_RADER.filter(g => g.sender_tilbud && !g.komplett).length;
  el.innerHTML =
    (mangler ? '<div style="margin-bottom:10px;padding:8px 10px;border-radius:8px;background:var(--d-roed-bg);color:var(--d-roed);font-size:12px">'
             + mangler+' av grossistene som kan sende tilbud mangler adresse eller org.nr. '
             + 'Tilbud fra disse får et ufullstendig brevhode.</div>' : '')
    + '<table class="d-tabell" style="width:100%">'
    + '<thead><tr><th>Grossist</th><th>Org.nr.</th><th>Adresse</th><th>Logo</th><th>Sender tilbud</th><th></th></tr></thead><tbody>'
    + GA_RADER.map((g,i) =>
        '<tr>'
        + '<td style="vertical-align:top"><b>'+esc(g.navn)+'</b>'
          + (g.juridisk_navn && g.juridisk_navn !== g.navn ? '<div class="d-sub">'+esc(g.juridisk_navn)+'</div>' : '')
          + (g.region ? '<div class="d-sub">'+esc(g.region)+'</div>' : '') + '</td>'
        + '<td style="vertical-align:top">'+(g.orgnr ? esc(g.orgnr) : '<span style="color:var(--d-roed)">mangler</span>')+'</td>'
        + '<td style="vertical-align:top">'+(g.postadresse
            ? esc(g.postadresse)+'<div class="d-sub">'+esc(((g.postnr||'')+' '+(g.poststed||'')).trim())+'</div>'
            : '<span style="color:var(--d-roed)">mangler</span>')+'</td>'
        + '<td style="vertical-align:top">'+(g.logo_data ? 'opplastet' : (g.logo_fil ? esc(g.logo_fil) : '<span class="d-sub">ingen</span>'))+'</td>'
        + '<td style="vertical-align:top">'+(g.sender_tilbud ? 'Ja' : 'Nei')+'</td>'
        + '<td style="vertical-align:top"><button class="d-knapp sm" onclick="redigerGrossistAvsender('+i+')">Rediger</button></td>'
        + '</tr>').join('')
    + '</tbody></table>';
}

function redigerGrossistAvsender(i){
  const g = GA_RADER[i];
  if(!g) return;
  const felt = (id,merke,verdi,type) =>
    '<div class="d-felt" style="margin-bottom:8px"><label>'+merke+'</label>'
    + '<input id="'+id+'" class="d-input" type="'+(type||'text')+'" value="'+esc(verdi||'')+'"></div>';
  const p = document.createElement('div');
  p.id = 'gaPopup';
  p.className = 'modal-bg open';
  p.innerHTML =
    '<div class="modal" style="max-width:520px;max-height:88vh;overflow:auto">'
    + '<h3>'+esc(g.navn)+'</h3>'
    + '<div class="d-sub" style="margin-bottom:12px">Dette blir brevhodet på tilbudet kunden mottar.</div>'
    + felt('gaOrgnr','Organisasjonsnummer (9 siffer)', g.orgnr)
    + '<button class="d-knapp sm" style="margin-bottom:10px" onclick="hentGrossistFraBrreg(\''+g.id+'\')">Hent navn og adresse fra BRreg</button>'
    + felt('gaJuridisk','Juridisk navn (vises på tilbudet)', g.juridisk_navn || g.navn)
    + felt('gaAdresse','Gateadresse', g.postadresse)
    + '<div style="display:flex;gap:8px">'
      + '<div style="width:110px">'+felt('gaPostnr','Postnr.', g.postnr)+'</div>'
      + '<div style="flex:1">'+felt('gaPoststed','Poststed', g.poststed)+'</div>'
    + '</div>'
    + felt('gaTelefon','Telefon', g.telefon)
    + felt('gaEpost','E-post', g.epost)
    + '<div class="d-felt" style="margin-bottom:8px"><label>Logo</label>'
      + '<div id="gaLogoVis" style="margin-bottom:6px">'+gaLogoForhandsvisning(g)+'</div>'
      + '<input id="gaLogoFil" type="file" accept="image/png,image/jpeg" onchange="gaLesLogo(this)">'
      + '<div class="d-sub">Erstatter standardlogoen. Skaleres ned automatisk.</div></div>'
    + '<label style="display:flex;gap:8px;align-items:center;margin:10px 0">'
      + '<input id="gaSender" type="checkbox"'+(g.sender_tilbud ? ' checked' : '')+'> Kan velges som avsender på tilbud</label>'
    + '<div id="gaFeil" style="color:var(--d-roed);min-height:18px;font-size:12px"></div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">'
      + '<button class="d-knapp sm" onclick="document.getElementById(\'gaPopup\').remove()">Avbryt</button>'
      + '<button class="d-knapp primar sm" onclick="lagreGrossistAvsender(\''+g.id+'\')">Lagre</button>'
    + '</div></div>';
  document.body.appendChild(p);
  // Ny logo holdes utenfor DOM-en til den lagres — ellers ville en avbrutt
  // redigering latt en halvferdig data-URL ligge igjen i skjemaet.
  p.dataset.nyLogo = '';
}

function gaLogoForhandsvisning(g){
  const kilde = g.logo_data || (g.logo_fil ? 'logoer/'+g.logo_fil : '');
  return kilde
    ? '<img src="'+esc(kilde)+'" alt="" style="max-height:60px;max-width:180px;background:#fff;padding:4px;border:1px solid var(--d-ramme)">'
    : '<span class="d-sub">Ingen logo — tilbudet viser grossistens navn i tekst.</span>';
}

function gaLesLogo(input){
  const fil = input.files && input.files[0];
  if(!fil) return;
  const leser = new FileReader();
  leser.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maks = 600, k = Math.min(1, maks/Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width*k));
      c.height = Math.max(1, Math.round(img.height*k));
      // Hvit bunn: PNG-logoene er gjennomsiktige, og JPEG har ingen alfakanal —
      // uten dette blir de svarte både i forhåndsvisningen og i PDF-en.
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      const data = c.toDataURL('image/jpeg', 0.9);
      const popup = document.getElementById('gaPopup');
      if(!popup) return;
      popup.dataset.nyLogo = data;
      document.getElementById('gaLogoVis').innerHTML =
        '<img src="'+data+'" alt="" style="max-height:60px;max-width:180px;border:1px solid var(--d-ramme)">';
    };
    img.onerror = () => { document.getElementById('gaFeil').textContent = 'Kunne ikke lese bildefila.'; };
    img.src = leser.result;
  };
  leser.readAsDataURL(fil);
}

async function hentGrossistFraBrreg(id){
  const feil = document.getElementById('gaFeil');
  feil.textContent = '';
  const orgnr = (document.getElementById('gaOrgnr').value || '').replace(/\s/g,'');
  if(!/^\d{9}$/.test(orgnr)){ feil.textContent = 'Fyll inn et gyldig org.nr. (9 siffer) først.'; return; }
  try{
    // Org.nr. må være lagret før BRreg-oppslaget — backend slår opp på det som
    // står i basen, ikke på det som ligger i skjemaet.
    await api('/api/grossister/'+id+'/avsender', {method:'PUT', body:{orgnr}});
    const g = await api('/api/grossister/'+id+'/avsender/brreg', {method:'POST'});
    document.getElementById('gaJuridisk').value = g.juridisk_navn || '';
    document.getElementById('gaAdresse').value  = g.postadresse || '';
    document.getElementById('gaPostnr').value   = g.postnr || '';
    document.getElementById('gaPoststed').value = g.poststed || '';
  }catch(e){ feil.textContent = 'BRreg: '+e.message; }
}

async function lagreGrossistAvsender(id){
  const feil = document.getElementById('gaFeil');
  feil.textContent = '';
  const v = x => (document.getElementById(x).value || '').trim() || null;
  const body = {
    orgnr: (document.getElementById('gaOrgnr').value || '').replace(/\s/g,'') || null,
    juridisk_navn: v('gaJuridisk'),
    postadresse: v('gaAdresse'),
    postnr: v('gaPostnr'),
    poststed: v('gaPoststed'),
    telefon: v('gaTelefon'),
    epost: v('gaEpost'),
    sender_tilbud: document.getElementById('gaSender').checked,
  };
  const nyLogo = document.getElementById('gaPopup').dataset.nyLogo;
  if(nyLogo) body.logo_data = nyLogo;
  try{ await api('/api/grossister/'+id+'/avsender', {method:'PUT', body}); }
  catch(e){ feil.textContent = 'Feil: '+e.message; return; }
  document.getElementById('gaPopup').remove();
  toast('Grossist lagret');
  // Nedtrekket i kalkylen og logo-mellomlageret er nå utdatert.
  if(typeof lastAvsendere === 'function') lastAvsendere();
  if(typeof _avsenderFull === 'object') delete _avsenderFull[id];
  lastGrossistAvsendere();
}
