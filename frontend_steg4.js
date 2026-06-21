/* KonseptSuite — Steg 4 frontend-modul (vanilla JS, ingen rammeverk).
 * Kundekort: faner for Leveringssteder og Aktiviteter.
 * Dashboard: APP-tall og EXCEL-tall side om side, ALDRI summert.
 *
 * Bruk:
 *   Steg4.API = "https://konseptsuite-backend.onrender.com";
 *   Steg4.token = <JWT fra innlogging>;
 *   Steg4.monterKundekort(kundeId, document.getElementById("kundekort-steg4"));
 *   Steg4.visDashboard(document.getElementById("dashboard-app"), excelData);
 */
const Steg4 = (() => {
  let API = "";
  let token = "";

  async function api(sti, opt = {}) {
    const r = await fetch(API + sti, {
      ...opt,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        ...(opt.headers || {}),
      },
    });
    if (!r.ok) throw new Error(`${r.status} ${sti}`);
    return r.status === 204 ? null : r.json();
  }

  const kr = (n) =>
    (n || 0).toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " kr";
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );

  /* Status → badge-fargeklasse */
  function statusFarge(s) {
    return (
      { "Lead": "bla", "Aktiv dialog": "gul", "Kunde": "gronn",
        "Sovende": "graa", "Konkurs": "roed", "Ikke aktuell": "graa" }[s] || "graa"
    );
  }

  /* Konsept → badge-fargeklasse */
  function konseptFarge(k) {
    return (
      { "La Salumeria": "roed", "East Essence": "bla",
        "Godt Lokalt": "gronn", "Sabor": "gul" }[k] || "graa"
    );
  }

  /* Type-ikon for aktivitet */
  function aktIkon(type) {
    return (
      { "Møte": "📅", "Telefon": "📞", "E-post": "✉", "Besøk": "🚗",
        "Notat": "📝", "Oppgave": "✓" }[type] || "●"
    );
  }

  // ---------- LEVERINGSSTEDER ----------
  async function monterLeveringssteder(kundeId, el) {
    el.innerHTML = '<p style="color:var(--d-tekst-3);font-size:13px">Laster leveringssteder…</p>';
    let grossister, steder;
    try {
      [grossister, steder] = await Promise.all([
        api("/api/grossister"),
        api(`/api/kunder/${kundeId}/leveringssteder`),
      ]);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--d-roed)">Feil: ${esc(e.message)}</p>`;
      return;
    }

    const gOpt = (valgt) =>
      '<option value="">— velg grossist —</option>' +
      grossister
        .map(
          (g) =>
            `<option value="${g.id}" ${g.id === valgt ? "selected" : ""}>${esc(g.navn)} (${esc(g.region || "")})</option>`
        )
        .join("");

    const rader = steder
      .map(
        (s) => `
      <tr>
        <td class="d-navn">${esc(s.navn || "—")}</td>
        <td>${esc(s.adresse || "—")}</td>
        <td>${esc(grossister.find((g) => g.id === s.grossist_id)?.navn || "—")}</td>
        <td style="text-align:right">${s.avstand_km != null ? s.avstand_km.toFixed(1) + " km" : "—"}</td>
        <td style="text-align:right">
          <button class="d-knapp fare sm" data-slett="${s.id}">Slett</button>
        </td>
      </tr>`
      )
      .join("");

    el.innerHTML = `
      <table class="d-tabell">
        <thead><tr>
          <th>Navn</th><th>Adresse</th><th>Grossist</th>
          <th style="text-align:right">Avstand</th><th></th>
        </tr></thead>
        <tbody>${rader || '<tr><td colspan="5" style="color:var(--d-tekst-3)">Ingen leveringssteder ennå.</td></tr>'}</tbody>
      </table>
      <div class="d-legg-til" style="margin-top:var(--s4)">
        <div class="d-felt" style="flex:1;min-width:140px">
          <label>Navn</label>
          <input id="ls-navn" class="d-input" placeholder="f.eks. Hovedkjøkken">
        </div>
        <div class="d-felt" style="flex:2;min-width:200px">
          <label>Adresse (geokodes)</label>
          <input id="ls-adr" class="d-input" placeholder="Gateadresse">
        </div>
        <div class="d-felt" style="min-width:160px">
          <label>Grossist</label>
          <select id="ls-gross" class="d-select">${gOpt("")}</select>
        </div>
        <div class="d-felt" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <button id="ls-legg" class="d-knapp primar">Legg til</button>
        </div>
        <span id="ls-status" style="font-size:12px;color:var(--d-tekst-3);align-self:flex-end"></span>
      </div>`;

    el.querySelectorAll("[data-slett]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Slette leveringssted?")) return;
        try {
          await api(`/api/leveringssteder/${b.dataset.slett}`, { method: "DELETE" });
          monterLeveringssteder(kundeId, el);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );
    el.querySelector("#ls-legg").addEventListener("click", async () => {
      const st = el.querySelector("#ls-status");
      st.textContent = "Lagrer + geokoder…";
      try {
        await api(`/api/kunder/${kundeId}/leveringssteder`, {
          method: "POST",
          body: JSON.stringify({
            navn: el.querySelector("#ls-navn").value || null,
            adresse: el.querySelector("#ls-adr").value || null,
            grossist_id: el.querySelector("#ls-gross").value || null,
          }),
        });
        monterLeveringssteder(kundeId, el);
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
      }
    });
  }

  // ---------- AKTIVITETER (CRM-logg) ----------
  const TYPER = ["Møte", "Telefon", "E-post", "Besøk", "Notat", "Oppgave"];

  async function monterAktiviteter(kundeId, el) {
    el.innerHTML = '<p style="color:var(--d-tekst-3);font-size:13px">Laster aktiviteter…</p>';
    let akt;
    try {
      akt = await api(`/api/kunder/${kundeId}/aktiviteter`);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--d-roed)">Feil: ${esc(e.message)}</p>`;
      return;
    }

    const hendinger = akt
      .map(
        (a) => `
      <li class="d-hending">
        <div class="d-punkt">${aktIkon(a.type)}</div>
        <div class="d-innh">
          <div class="d-tit">${esc(a.type)}</div>
          <div class="d-meta">${new Date(a.dato).toLocaleDateString("nb-NO")}${a.bruker_navn ? " · " + esc(a.bruker_navn) : ""}
            <button class="d-knapp fare sm" data-slett="${a.id}" style="margin-left:var(--s2)">Slett</button>
          </div>
          ${a.notat ? `<div class="d-notat">${esc(a.notat)}</div>` : ""}
        </div>
      </li>`
      )
      .join("");

    el.innerHTML = `
      <div class="d-legg-til" style="margin-bottom:var(--s4)">
        <div class="d-felt">
          <label>Type</label>
          <select id="ak-type" class="d-select" style="width:auto">${TYPER.map((t) => `<option>${t}</option>`).join("")}</select>
        </div>
        <div class="d-felt">
          <label>Dato</label>
          <input id="ak-dato" type="date" class="d-input" style="width:auto">
        </div>
        <div class="d-felt" style="flex:1;min-width:180px">
          <label>Notat</label>
          <input id="ak-notat" class="d-input" placeholder="Valgfritt notat…">
        </div>
        <div class="d-felt" style="justify-content:flex-end">
          <label>&nbsp;</label>
          <button id="ak-legg" class="d-knapp primar">Logg</button>
        </div>
        <span id="ak-status" style="font-size:12px;color:var(--d-tekst-3);align-self:flex-end"></span>
      </div>
      <ul class="d-tidslinje">${hendinger || '<li style="color:var(--d-tekst-3);font-size:13px">Ingen aktivitet logget ennå.</li>'}</ul>`;

    el.querySelectorAll("[data-slett]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/aktiviteter/${b.dataset.slett}`, { method: "DELETE" });
          monterAktiviteter(kundeId, el);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );
    el.querySelector("#ak-legg").addEventListener("click", async () => {
      const st = el.querySelector("#ak-status");
      const d = el.querySelector("#ak-dato").value;
      st.textContent = "Lagrer…";
      try {
        await api(`/api/kunder/${kundeId}/aktiviteter`, {
          method: "POST",
          body: JSON.stringify({
            type: el.querySelector("#ak-type").value,
            notat: el.querySelector("#ak-notat").value || null,
            dato: d ? new Date(d).toISOString() : null,
          }),
        });
        monterAktiviteter(kundeId, el);
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
      }
    });
  }

  // ---------- KONTAKTPERSONER ----------
  async function monterKontaktpersoner(kundeId, el) {
    el.innerHTML = '<p style="color:var(--d-tekst-3);font-size:13px">Laster kontaktpersoner…</p>';
    let kontakter;
    try {
      kontakter = await api(`/api/kunder/${kundeId}/kontaktpersoner`);
    } catch (e) {
      el.innerHTML = `<p style="color:var(--d-roed)">Feil: ${esc(e.message)}</p>`;
      return;
    }
    kontakter.sort((a, b) => (b.er_primaer ? 1 : 0) - (a.er_primaer ? 1 : 0));

    const rader = kontakter
      .map(
        (k) => `
      <tr>
        <td class="d-navn">${esc(k.navn)} ${k.er_primaer ? '<span class="d-badge gronn flat" style="margin-left:4px">Primær</span>' : ""}</td>
        <td>${esc(k.rolle || "—")}</td>
        <td>${esc(k.telefon || "—")}</td>
        <td>${esc(k.epost || "—")}</td>
        <td style="white-space:nowrap;text-align:right">
          ${!k.er_primaer ? `<button class="d-knapp sekundar sm" data-primaer="${k.id}">Sett primær</button>` : ""}
          <button class="d-knapp fare sm" data-slett-kon="${k.id}" style="margin-left:4px">Slett</button>
        </td>
      </tr>`
      )
      .join("");

    el.innerHTML = `
      <table class="d-tabell">
        <thead><tr><th>Navn</th><th>Rolle</th><th>Telefon</th><th>E-post</th><th></th></tr></thead>
        <tbody>${rader || '<tr><td colspan="5" style="color:var(--d-tekst-3)">Ingen kontaktpersoner ennå.</td></tr>'}</tbody>
      </table>
      <div class="d-legg-til" style="margin-top:var(--s4)">
        <div class="d-felt" style="flex:1.5;min-width:130px">
          <label>Navn *</label>
          <input id="kp-navn" class="d-input" placeholder="Navn">
        </div>
        <div class="d-felt" style="flex:1;min-width:100px">
          <label>Rolle</label>
          <input id="kp-rolle" class="d-input" placeholder="Innkjøper">
        </div>
        <div class="d-felt" style="flex:1;min-width:110px">
          <label>Telefon</label>
          <input id="kp-tlf" class="d-input" placeholder="+47…">
        </div>
        <div class="d-felt" style="flex:1.5;min-width:140px">
          <label>E-post</label>
          <input id="kp-epost" type="email" class="d-input" placeholder="e@post.no">
        </div>
        <div class="d-felt" style="justify-content:flex-end;min-width:80px">
          <label style="display:flex;align-items:center;gap:5px;cursor:pointer">
            <input id="kp-primaer" type="checkbox"> Primær
          </label>
          <button id="kp-legg" class="d-knapp primar">Legg til</button>
        </div>
        <span id="kp-status" style="font-size:12px;color:var(--d-tekst-3);align-self:flex-end"></span>
      </div>`;

    el.querySelectorAll("[data-slett-kon]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("Slette kontaktperson?")) return;
        try {
          await api(`/api/kontaktpersoner/${b.dataset.slettKon}`, { method: "DELETE" });
          monterKontaktpersoner(kundeId, el);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );

    el.querySelectorAll("[data-primaer]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/kontaktpersoner/${b.dataset.primaer}`, {
            method: "PATCH",
            body: JSON.stringify({ er_primaer: true }),
          });
          monterKontaktpersoner(kundeId, el);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );

    el.querySelector("#kp-legg").addEventListener("click", async () => {
      const st = el.querySelector("#kp-status");
      const navn = el.querySelector("#kp-navn").value.trim();
      if (!navn) {
        st.textContent = "Navn er påkrevd";
        st.style.color = "var(--d-roed)";
        return;
      }
      st.textContent = "Lagrer…";
      st.style.color = "var(--d-tekst-3)";
      try {
        await api(`/api/kunder/${kundeId}/kontaktpersoner`, {
          method: "POST",
          body: JSON.stringify({
            navn,
            rolle: el.querySelector("#kp-rolle").value.trim() || null,
            telefon: el.querySelector("#kp-tlf").value.trim() || null,
            epost: el.querySelector("#kp-epost").value.trim() || null,
            er_primaer: el.querySelector("#kp-primaer").checked,
          }),
        });
        monterKontaktpersoner(kundeId, el);
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
      }
    });
  }

  // ---------- KONSEPTER ----------
  const KONSEPTER = ["La Salumeria", "East Essence", "Godt Lokalt", "Sabor"];

  async function monterKonsepter(kundeId, el) {
    el.innerHTML = '<p style="margin:0;font-size:12px;color:var(--d-tekst-3)">Laster konsepter…</p>';
    let liste;
    try {
      liste = await api(`/api/kunder/${kundeId}/konsepter`);
    } catch (e) {
      el.innerHTML = `<p style="margin:0;color:var(--d-roed);font-size:12px">Feil: ${esc(e.message)}</p>`;
      return;
    }

    const valgte = new Set(liste.map((k) => k.konsept));
    const tags = liste
      .map(
        (k) =>
          `<span class="d-badge ${konseptFarge(k.konsept)} flat" style="gap:6px">` +
          esc(k.konsept) +
          `<button data-slett-kon="${k.id}" title="Fjern" style="background:none;border:none;cursor:pointer;padding:0;margin-left:2px;font-size:14px;line-height:1;color:currentColor;opacity:.7">×</button>` +
          `</span>`
      )
      .join("");
    const ledige = KONSEPTER.filter((k) => !valgte.has(k));
    const addCtrl = ledige.length
      ? `<select id="kon-velg" class="d-select" style="width:auto;min-width:160px">` +
        ledige.map((k) => `<option>${esc(k)}</option>`).join("") +
        `</select><button id="kon-legg" class="d-knapp sekundar sm">+ Legg til</button>`
      : `<span style="font-size:12px;color:var(--d-tekst-3)">Alle konsepter lagt til</span>`;

    el.innerHTML = [
      `<div style="display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center;margin-bottom:var(--s3)">`,
      tags || `<span style="font-size:12px;color:var(--d-tekst-3)">Ingen konsepter ennå</span>`,
      `</div>`,
      `<div style="display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap">`,
      addCtrl,
      `<span id="kon-status" style="font-size:12px;color:var(--d-tekst-3)"></span>`,
      `</div>`,
    ].join("");

    el.querySelectorAll("[data-slett-kon]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/konsepter/${b.dataset.slettKon}`, { method: "DELETE" });
          monterKonsepter(kundeId, el);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );
    const leggBtn = el.querySelector("#kon-legg");
    if (leggBtn)
      leggBtn.addEventListener("click", async () => {
        const st = el.querySelector("#kon-status");
        st.textContent = "Lagrer…";
        try {
          await api(`/api/kunder/${kundeId}/konsepter`, {
            method: "POST",
            body: JSON.stringify({ konsept: el.querySelector("#kon-velg").value }),
          });
          monterKonsepter(kundeId, el);
        } catch (e) {
          st.textContent = "Feil: " + e.message;
          st.style.color = "var(--d-roed)";
        }
      });
  }

  // ---------- KUNDEKORT (kundeinfo + faner) ----------
  async function monterKundekort(kundeId, el) {
    el.innerHTML = '<p style="color:var(--d-tekst-3);font-size:13px;padding:var(--s4) 0">Laster kundekort…</p>';

    let kunde = {};
    try {
      kunde = await api(`/api/kunder/${kundeId}`);
    } catch (e) {
      console.warn("Kunne ikke hente kundedata:", e.message);
    }

    const STATUSER = ["Lead", "Aktiv dialog", "Kunde", "Sovende", "Konkurs", "Ikke aktuell"];
    const statusOpt = STATUSER.map(
      (s) => `<option ${kunde.status === s ? "selected" : ""}>${esc(s)}</option>`
    ).join("");

    const erSamme = !!kunde.faktura_samme_som_levering;
    const erIkkeAktuell = kunde.status === "Ikke aktuell";
    const erSovende = kunde.status === "Sovende";
    const gjDato = kunde.gjenbesok_dato ? kunde.gjenbesok_dato.slice(0, 10) : "";
    const segTekst = kunde.naeringsbeskrivelse
      ? (kunde.naeringskode ? kunde.naeringskode + " — " : "") + kunde.naeringsbeskrivelse
      : "";

    const badgeFarge = statusFarge(kunde.status || "Lead");

    el.innerHTML = [
      /* ── Topp-panel: kundenavn + status ── */
      `<div class="d-panel" style="margin-bottom:var(--s4)">`,
      `<div class="d-panel-hode">`,
      `<div>`,
      `<div class="d-t-h1">${esc(kunde.navn || "Kunde")}</div>`,
      `<div class="d-t-label" style="margin-top:4px">`,
      kunde.orgnr ? `Org.nr: ${esc(kunde.orgnr)}` : "",
      `</div>`,
      `</div>`,
      `<span class="d-badge ${badgeFarge}">${esc(kunde.status || "Lead")}</span>`,
      `</div>`,

      /* Konsept-tagger */
      `<div id="ks-konsepter" style="margin-bottom:var(--s4)"></div>`,

      /* BRREG-rad */
      `<div style="display:flex;align-items:flex-end;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s4)">`,
      `<div class="d-felt" style="flex:0 0 auto">`,
      `<label>Org.nr</label>`,
      `<input id="ki-orgnr" class="d-input" value="${esc(kunde.orgnr || "")}" placeholder="9 siffer" style="width:130px">`,
      `</div>`,
      `<button id="ki-brreg-btn" class="d-knapp subtil">Hent fra BRREG</button>`,
      `<span id="ki-brreg-status" style="font-size:12px;color:var(--d-tekst-3)"></span>`,
      `</div>`,

      /* Konkurs-varsel */
      `<div id="ki-konkurs-varsel" style="display:none;background:var(--d-roed-bg);color:var(--d-roed);border:1px solid #E6B5AE;border-radius:var(--d-radius-sm);padding:10px 14px;margin-bottom:var(--s3);font-weight:600;font-size:13px">`,
      `⚠ Registrert konkurs i BRREG — vurder å sette status «Konkurs»`,
      `</div>`,

      /* Segment-hint */
      `<div id="ki-segment-hint" style="display:${segTekst ? "block" : "none"};font-size:12px;color:var(--d-tekst-3);margin-bottom:var(--s3);padding:8px 10px;background:var(--bg);border:1px solid var(--d-ramme);border-radius:var(--d-radius-sm)">`,
      `Næring: <span id="ki-segment-tekst">${esc(segTekst)}</span>`,
      `</div>`,

      /* Status */
      `<div class="d-felt" style="max-width:280px;margin-bottom:var(--s3)">`,
      `<label>Status</label>`,
      `<select id="ki-status" class="d-select">${statusOpt}</select>`,
      `</div>`,

      /* Forklaring (betinget) */
      `<div id="ki-forklaring-wrap" style="display:${erIkkeAktuell ? "block" : "none"};margin-bottom:var(--s3)">`,
      `<div class="d-felt">`,
      `<label>Forklaring *</label>`,
      `<input id="ki-forklaring" class="d-input" value="${esc(kunde.ikke_aktuell_forklaring || "")}" placeholder="Påkrevd forklaring">`,
      `</div>`,
      `</div>`,

      /* Gjenbesøk (betinget) */
      `<div id="ki-gjenbesok-wrap" style="display:${erSovende ? "block" : "none"};margin-bottom:var(--s3)">`,
      `<div class="d-felt" style="max-width:200px">`,
      `<label>Gjenbesøk dato</label>`,
      `<input id="ki-gjenbesok" type="date" class="d-input" value="${gjDato}">`,
      `</div>`,
      `</div>`,

      /* Adresser */
      `<div class="d-grid d-g2" style="margin-bottom:var(--s3)">`,
      `<div class="d-felt">`,
      `<label>Leveringsadresse</label>`,
      `<input id="ki-levadresse" class="d-input" value="${esc(kunde.leveringsadresse || "")}" placeholder="Adresse">`,
      `</div>`,
      `<div class="d-felt">`,
      `<label>Fakturaadresse</label>`,
      `<input id="ki-faktadresse" class="d-input" value="${esc(kunde.fakturaadresse || "")}" placeholder="Adresse"${erSamme ? " disabled" : ""}>`,
      `<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--d-tekst-3);cursor:pointer;margin-top:4px;font-weight:400">`,
      `<input id="ki-samme" type="checkbox"${erSamme ? " checked" : ""}> Samme som levering`,
      `</label>`,
      `</div>`,
      `</div>`,

      /* Lagre */
      `<div style="display:flex;align-items:center;gap:var(--s3)">`,
      `<button id="ki-lagre-btn" class="d-knapp primar">Lagre kundeinfo</button>`,
      `<span id="ki-lagre-status" style="font-size:12px;color:var(--d-tekst-3)"></span>`,
      `</div>`,
      `</div>`,

      /* ── Faner ── */
      `<div class="d-faner">`,
      `<button class="d-fane aktiv" data-fane="kon">Kontaktpersoner</button>`,
      `<button class="d-fane" data-fane="lev">Leveringssteder</button>`,
      `<button class="d-fane" data-fane="akt">Aktiviteter</button>`,
      `</div>`,
      `<div id="ks-faneinnhold"></div>`,
    ].join("");

    /* Konsepter: vis kun for ekte kunder */
    const konseptEl = el.querySelector("#ks-konsepter");
    if (konseptEl) {
      if (kunde.status && kunde.status !== "Lead") monterKonsepter(kundeId, konseptEl);
      else konseptEl.style.display = "none";
    }

    /* BRREG-oppslag — uendret logikk */
    el.querySelector("#ki-brreg-btn").addEventListener("click", async () => {
      const orgnr = el.querySelector("#ki-orgnr").value.trim();
      const st = el.querySelector("#ki-brreg-status");
      const btn = el.querySelector("#ki-brreg-btn");
      btn.disabled = true;
      btn.textContent = "Henter…";
      st.style.color = "var(--d-tekst-3)";
      st.textContent = "";
      el.querySelector("#ki-konkurs-varsel").style.display = "none";
      try {
        const d = await api(`/api/brreg/${encodeURIComponent(orgnr)}`);
        if (d.forretningsadresse) {
          el.querySelector("#ki-levadresse").value = d.forretningsadresse;
          if (el.querySelector("#ki-samme").checked)
            el.querySelector("#ki-faktadresse").value = d.forretningsadresse;
        }
        if (d.naeringsbeskrivelse) {
          const hint = (d.naeringskode ? d.naeringskode + " — " : "") + d.naeringsbeskrivelse;
          el.querySelector("#ki-segment-tekst").textContent = hint;
          el.querySelector("#ki-segment-hint").style.display = "block";
        }
        if (d.konkurs) {
          el.querySelector("#ki-konkurs-varsel").style.display = "block";
        }
        st.textContent = d.navn ? "Hentet: " + d.navn : "Hentet fra BRREG";
        st.style.color = "var(--d-gronn)";
      } catch (e) {
        const kod = e.message.match(/^(\d+)/)?.[1];
        if (kod === "400") st.textContent = "Org.nr må være 9 siffer";
        else if (kod === "404") st.textContent = "Fant ikke org.nr i BRREG";
        else if (kod === "502") st.textContent = "BRREG utilgjengelig, prøv igjen";
        else st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
      } finally {
        btn.disabled = false;
        btn.textContent = "Hent fra BRREG";
      }
    });

    /* Status → vis/skjul betingede felt */
    el.querySelector("#ki-status").addEventListener("change", () => {
      const s = el.querySelector("#ki-status").value;
      el.querySelector("#ki-forklaring-wrap").style.display =
        s === "Ikke aktuell" ? "block" : "none";
      el.querySelector("#ki-gjenbesok-wrap").style.display =
        s === "Sovende" ? "block" : "none";
    });

    /* Fakturaadresse = leveringsadresse */
    const sammeEl = el.querySelector("#ki-samme");
    const faktEl = el.querySelector("#ki-faktadresse");
    const levEl = el.querySelector("#ki-levadresse");

    const oppdaterFakt = () => {
      if (sammeEl.checked) {
        faktEl.value = levEl.value;
        faktEl.disabled = true;
      } else {
        faktEl.disabled = false;
      }
    };
    sammeEl.addEventListener("change", oppdaterFakt);
    levEl.addEventListener("input", () => {
      if (sammeEl.checked) faktEl.value = levEl.value;
    });

    /* Lagre kundeinfo */
    el.querySelector("#ki-lagre-btn").addEventListener("click", async () => {
      const st = el.querySelector("#ki-lagre-status");
      const btn = el.querySelector("#ki-lagre-btn");
      const statusVal = el.querySelector("#ki-status").value;
      const forklaring = el.querySelector("#ki-forklaring").value.trim();

      if (statusVal === "Ikke aktuell" && !forklaring) {
        st.textContent = "Forklaring er påkrevd for «Ikke aktuell»";
        st.style.color = "var(--d-roed)";
        el.querySelector("#ki-forklaring").focus();
        return;
      }

      btn.disabled = true;
      st.textContent = "Lagrer…";
      st.style.color = "var(--d-tekst-3)";

      try {
        const payload = {
          status: statusVal,
          orgnr: el.querySelector("#ki-orgnr").value.trim() || null,
          leveringsadresse: levEl.value.trim() || null,
          fakturaadresse: faktEl.value.trim() || null,
          faktura_samme_som_levering: sammeEl.checked,
        };
        if (statusVal === "Ikke aktuell") payload.ikke_aktuell_forklaring = forklaring;
        if (statusVal === "Sovende") {
          payload.gjenbesok_dato = el.querySelector("#ki-gjenbesok").value || null;
        }
        await api(`/api/kunder/${kundeId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        st.textContent = "Lagret ✓";
        st.style.color = "var(--d-gronn)";
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
      } finally {
        btn.disabled = false;
      }
    });

    /* Faner */
    const innhold = el.querySelector("#ks-faneinnhold");
    const visFane = (f) => {
      if (f === "lev") monterLeveringssteder(kundeId, innhold);
      else if (f === "akt") monterAktiviteter(kundeId, innhold);
      else if (f === "kon") monterKontaktpersoner(kundeId, innhold);
    };
    el.querySelectorAll(".d-fane").forEach((b) =>
      b.addEventListener("click", () => {
        el.querySelectorAll(".d-fane").forEach((x) =>
          x.classList.toggle("aktiv", x === b)
        );
        visFane(b.dataset.fane);
      })
    );
    visFane("kon");
  }

  // ---------- DASHBOARD: APP vs EXCEL side om side ----------
  function norskDato(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr + (isoStr.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  }

  async function visDashboard(el, excelData) {
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;color:var(--d-tekst-3);padding:var(--s6) 0">' +
      '<span style="display:inline-block;width:16px;height:16px;border:2px solid var(--primaer);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></span>' +
      "Laster CRM-data…</div>" +
      "<style>@keyframes spin{to{transform:rotate(360deg)}}</style>";

    let app = { per_status: [], per_selger: [], sum_potensiell_total: 0, totalt_kalkyler: 0, totalt_kunder: 0 };
    let moter = [], oppfolging = [];
    try {
      [app, moter, oppfolging] = await Promise.all([
        api("/api/dashboard"),
        api("/api/moter").catch(() => []),
        api("/api/oppfolging").catch(() => []),
      ]);
    } catch (e) {
      el.innerHTML = '<p style="color:var(--d-roed);padding:var(--s4)">Feil ved lasting av dashboard: ' + esc(e.message) + "</p>";
      return;
    }

    // Status-map for pipeline-oppslag
    const statusMap = {};
    (app.per_status || []).forEach(function(s) { statusMap[s.status] = s; });

    const mnok = function(n) {
      return isFinite(n) && n
        ? (n / 1000000).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MNOK"
        : "0,0 MNOK";
    };

    const iDagStr = new Date().toISOString().slice(0, 10);

    // --- KPI-rad (APP-tall) ---
    const kpiKort = [
      { label: "Aktive kunder",        tall: statusMap["Kunde"] ? statusMap["Kunde"].antall : (app.totalt_kunder || 0), vs: "Registrert som Kunde i CRM" },
      { label: "Leads til oppf\xF8lging", tall: oppfolging.length,                                                         vs: "Tilbud/gjenbes\xF8k krever handling" },
      { label: "\xC5pne tilbud",         tall: statusMap["Sendt"] ? statusMap["Sendt"].antall : 0,                          vs: "Status: Sendt" },
      { label: "M\xF8ter denne uken",    tall: moter.length,                                                                vs: "I dag → s\xF8ndag" },
    ];
    const kpiHtml = kpiKort.map(function(k) {
      return '<div class="d-kpi">' +
        '<div class="d-label">' + esc(k.label) + "</div>" +
        '<div class="d-rad"><span class="d-tall">' + k.tall + "</span></div>" +
        '<div class="d-vs">' + esc(k.vs) + "</div>" +
        "</div>";
    }).join("");

    // --- Pipeline-bånd (APP-tall, kundestatuser) ---
    const pipelineSteg = [
      { navn: "Lead",         farge: "var(--d-bla)",   status: "Lead" },
      { navn: "Aktiv dialog", farge: "var(--teal)",    status: "Aktiv dialog" },
      { navn: "Tilbud sendt", farge: "var(--d-gul)",  status: "Sendt" },
      { navn: "Forhandling",  farge: "var(--d-lilla)",status: "Forhandling" },
      { navn: "Vunnet",       farge: "var(--d-gronn)",status: "Vunnet" },
    ];
    const pipelineHtml = pipelineSteg.map(function(steg) {
      const d = statusMap[steg.status] || { antall: 0, sum_potensiell: 0 };
      return '<div class="d-steg">' +
        '<div class="d-topp" style="background:' + steg.farge + '"></div>' +
        '<div class="d-navn">' + esc(steg.navn) + "</div>" +
        '<div class="d-ant">' + d.antall + "</div>" +
        '<div class="d-verdi">' + mnok(d.sum_potensiell) + "</div>" +
        "</div>";
    }).join("");

    // --- Møte-rader ---
    const moterRader = moter.length
      ? moter.map(function(m) {
          const erIdag = (m.dato || "").slice(0, 10) === iDagStr;
          return "<tr" + (erIdag ? ' style="font-weight:700;background:var(--primaer-svak)"' : "") + ">" +
            '<td style="white-space:nowrap">' + norskDato(m.dato) + "</td>" +
            '<td><a href="#" data-kunde-id="' + esc(m.kunde_id) + '" style="color:var(--primaer);text-decoration:none;font-weight:600">' + esc(m.kunde_navn) + "</a></td>" +
            '<td style="color:var(--d-tekst-3)">' + esc(m.notat || "—") + "</td>" +
            "</tr>";
        }).join("")
      : '<tr><td colspan="3" style="color:var(--d-tekst-3);font-style:italic;padding:var(--s4) var(--s3)">Ingen m\xF8ter denne uken.</td></tr>';

    // --- Oppfølging-rader ---
    const oppfRader = oppfolging.length
      ? oppfolging.map(function(o) {
          const forfalt = o.dato && (o.dato || "").slice(0, 10) < iDagStr;
          const typeLabel = o.type === "tilbud" ? "Tilbud" : "Gjenbes\xF8k";
          const typeFarge = o.type === "tilbud" ? "bla" : "gronn";
          return "<tr>" +
            '<td><span class="d-badge ' + typeFarge + ' flat">' + typeLabel + "</span></td>" +
            '<td style="font-weight:600">' + esc(o.kunde_navn) + "</td>" +
            '<td style="white-space:nowrap;' + (forfalt ? "color:var(--d-roed);font-weight:700" : "color:var(--d-tekst-3)") + '">' + norskDato(o.dato) + "</td>" +
            "</tr>";
        }).join("")
      : '<tr><td colspan="3" style="color:var(--d-tekst-3);font-style:italic;padding:var(--s4) var(--s3)">Ingen oppf\xF8lginger n\xE5.</td></tr>';

    // --- Per-selger-rader ---
    const selgerRader = (app.per_selger || []).map(function(s) {
      return "<tr>" +
        '<td class="d-navn">' + esc(s.selger_navn || "—") + "</td>" +
        '<td style="text-align:right">' + s.antall_kunder + "</td>" +
        '<td style="text-align:right">' + s.antall_kalkyler + "</td>" +
        '<td style="text-align:right;font-weight:600">' + kr(s.sum_potensiell) + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="4" style="color:var(--d-tekst-3)">Ingen data.</td></tr>';

    el.innerHTML =
      // KPI-rad
      '<div class="d-grid d-g4" style="margin-bottom:var(--s5)">' + kpiHtml + "</div>" +

      // Salgspipeline
      '<div class="d-panel" style="margin-bottom:var(--s5)">' +
        '<div class="d-panel-hode">' +
          '<span class="d-t-h2">Salgspipeline</span>' +
          '<span class="d-t-hint">APP — potensiell omsetning fra kalkyler</span>' +
        "</div>" +
        '<div class="d-pipeline">' + pipelineHtml + "</div>" +
      "</div>" +

      // Møter + Oppfølging side om side
      '<div class="d-grid d-g2" style="margin-bottom:var(--s5)">' +
        '<div class="d-panel">' +
          '<div class="d-panel-hode"><span class="d-t-h2">Ukens m\xF8ter</span></div>' +
          '<table class="d-tabell"><thead><tr>' +
          '<th>Dato</th><th>Kunde</th><th>Notat</th>' +
          "</tr></thead><tbody>" + moterRader + "</tbody></table>" +
        "</div>" +
        '<div class="d-panel">' +
          '<div class="d-panel-hode"><span class="d-t-h2">Oppf\xF8lging</span></div>' +
          '<table class="d-tabell"><thead><tr>' +
          "<th>Type</th><th>Kunde</th><th>Dato</th>" +
          "</tr></thead><tbody>" + oppfRader + "</tbody></table>" +
        "</div>" +
      "</div>" +

      // Per selger
      '<div class="d-panel" style="margin-bottom:var(--s4)">' +
        '<div class="d-panel-hode">' +
          '<span class="d-t-h2">Per selger</span>' +
          '<span class="d-t-hint">Potensiell omsetning · ikke fakturert</span>' +
        "</div>" +
        '<table class="d-tabell"><thead><tr>' +
        "<th>Selger</th>" +
        '<th style="text-align:right">Kunder</th>' +
        '<th style="text-align:right">Kalkyler</th>' +
        '<th style="text-align:right">Potensiell omsetning</th>' +
        "</tr></thead><tbody>" + selgerRader + "</tbody></table>" +
      "</div>" +

      // Advarselslinje
      '<p style="font-size:12px;color:var(--d-roed);font-weight:600;background:var(--d-roed-bg);border:1px solid #E6B5AE;border-radius:var(--d-radius-sm);padding:var(--s3) var(--s4);margin:0">' +
      "⚠ APP-tall (potensiell omsetning fra kalkyler i Postgres) og EXCEL-tall (fakturert omsetning fra data.json) er bevisst adskilt og summeres aldri." +
      "</p>";

    el.querySelectorAll("a[data-kunde-id]").forEach(function(a) {
      a.addEventListener("click", function(e) {
        e.preventDefault();
        const id = a.dataset.kundeId;
        if (id && window.velgKunde) window.velgKunde(id);
      });
    });
  }

  return {
    get API() { return API; }, set API(v) { API = v; },
    get token() { return token; }, set token(v) { token = v; },
    monterKundekort, visDashboard, monterLeveringssteder, monterAktiviteter, monterKontaktpersoner, monterKonsepter,
  };
})();
