/* KonseptSuite — Steg 4 frontend-modul (vanilla JS, ingen rammeverk).
 * Kundekort: faner for Leveringssteder og Aktiviteter.
 * Dashboard: APP-tall og EXCEL-tall side om side, ALDRI summert.
 *
 * Bruk:
 *   Steg4.API = "https://app-konseptsuite-dlvry.azurewebsites.net"; // Azure App Service (satt via API_BASE i index.html)
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

  // ---------- GROSSISTER PER KUNDE ----------
  async function monterKundeGrossister(kundeId, el, brukerRolle) {
    el.innerHTML = '<p style="margin:0;font-size:12px;color:var(--d-tekst-3)">Laster grossister…</p>';
    let liste, allGrossister = [];
    try {
      liste = await api(`/api/kunder/${kundeId}/grossister`);
    } catch (e) {
      el.innerHTML = `<p style="margin:0;color:var(--d-roed);font-size:12px">Feil: ${esc(e.message)}</p>`;
      return;
    }
    const kanRedigere = brukerRolle === "leder" || brukerRolle === "admin" || brukerRolle === "superadmin";
    if (kanRedigere) {
      try { allGrossister = await api("/api/grossister"); } catch (_) {}
    }

    const koblet = new Set(liste.map((g) => g.grossist_id));
    const tags = liste
      .map(
        (g) =>
          `<span class="d-badge gronn flat" style="gap:6px">` +
          esc(g.grossist_navn) +
          (kanRedigere
            ? `<button data-slett-gr="${g.grossist_id}" title="Fjern" style="background:none;border:none;cursor:pointer;padding:0;margin-left:2px;font-size:14px;line-height:1;color:currentColor;opacity:.7">×</button>`
            : "") +
          `</span>`
      )
      .join("");

    let addCtrl = "";
    if (kanRedigere) {
      const ledige = allGrossister.filter((g) => !koblet.has(g.id));
      addCtrl = ledige.length
        ? `<select id="gr-velg" class="d-select" style="width:auto;min-width:180px">` +
          ledige.map((g) => `<option value="${esc(g.id)}">${esc(g.navn)}</option>`).join("") +
          `</select><button id="gr-legg" class="d-knapp sekundar sm">+ Legg til</button>`
        : `<span style="font-size:12px;color:var(--d-tekst-3)">Alle grossister koblet</span>`;
    }

    el.innerHTML = [
      `<div style="display:flex;flex-wrap:wrap;gap:var(--s2);align-items:center;margin-bottom:var(--s3)">`,
      tags || `<span style="font-size:12px;color:var(--d-tekst-3)">Ingen grossister koblet</span>`,
      `</div>`,
      kanRedigere
        ? `<div style="display:flex;gap:var(--s2);align-items:center;flex-wrap:wrap">${addCtrl}<span id="gr-status" style="font-size:12px;color:var(--d-tekst-3)"></span></div>`
        : "",
    ].join("");

    el.querySelectorAll("[data-slett-gr]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await api(`/api/kunder/${kundeId}/grossist/${b.dataset.slettGr}`, { method: "DELETE" });
          monterKundeGrossister(kundeId, el, brukerRolle);
        } catch (e) {
          alert("Feil: " + e.message);
        }
      })
    );
    const leggBtn = el.querySelector("#gr-legg");
    if (leggBtn)
      leggBtn.addEventListener("click", async () => {
        const st = el.querySelector("#gr-status");
        st.textContent = "Lagrer…";
        try {
          await api(`/api/kunder/${kundeId}/grossist`, {
            method: "POST",
            body: JSON.stringify({ grossist_id: el.querySelector("#gr-velg").value }),
          });
          monterKundeGrossister(kundeId, el, brukerRolle);
        } catch (e) {
          st.textContent = "Feil: " + e.message;
          st.style.color = "var(--d-roed)";
        }
      });
  }

  // ---------- SALGSHISTORIKK (FIKS-14: ukentlig omsetning pr. org.nr, ikke enkeltordre) ----------
  async function monterSalgshistorikk(kundeId, el) {
    el.innerHTML = '<p style="margin:0;font-size:12px;color:var(--d-tekst-3)">Laster salgshistorikk…</p>';
    let d;
    try {
      d = await api(`/api/kunder/${kundeId}/salgshistorikk`);
    } catch (e) {
      el.innerHTML = `<p style="margin:0;color:var(--d-roed);font-size:12px">Feil: ${esc(e.message)}</p>`;
      return;
    }

    if (!d.orgnr || !d.uker || !d.uker.length) {
      el.innerHTML = placeholderFane(
        "Salgshistorikk",
        d.orgnr
          ? "Ingen kjøp registrert på dette org.nr i salgsdataene (FIKS-14)."
          : "Kunden mangler org.nr — kan ikke kobles mot salgsdata (FIKS-14)."
      );
      return;
    }

    const t = d.totalt_per_ar || {};
    const oms2026 = t["2026"] || 0;
    const oms2025 = t["2025"] || 0;
    const deltaPct = oms2025 ? Math.round(((oms2026 - oms2025) / oms2025) * 1000) / 10 : null;

    const avvikHtml = d.grossist_avvik
      ? '<div style="background:var(--d-roed-bg);color:var(--d-roed);border:1px solid #E6B5AE;' +
        'border-radius:var(--d-radius-sm);padding:10px 14px;margin-bottom:var(--s3);font-size:13px">' +
        `⚠ Grossist i salgsdata (${esc((d.grossist_i_salgsdata || []).join(", ") || "ukjent")}) stemmer ikke med ` +
        `grossist registrert på kunden i appen (${esc(d.grossist_i_appen || "ingen satt")}).` +
        "</div>"
      : "";

    const orgDeltHtml =
      d.presisjon === "orgnr" && d.org_delt_med_andre_kunder
        ? '<div style="background:var(--d-gul-bg);color:var(--d-gul);border:1px solid #E9D9A8;' +
          'border-radius:var(--d-radius-sm);padding:10px 14px;margin-bottom:var(--s3);font-size:13px">' +
          "⚠ Org.nr deles av flere utleveringssteder/kundekontoer (typisk en kjede). Tallene under er " +
          "SUMMERT PÅ TVERS av alle stedene som deler dette org.nr-et, ikke bare denne ene kunden." +
          "</div>"
        : "";

    const siste = d.uker.slice(-12).reverse();
    const rader = siste
      .map(
        (u) =>
          `<tr><td>${esc(u.ar)}</td><td>Uke ${esc(u.uke)}</td><td>${esc(u.grossist || "—")}</td>` +
          `<td style="text-align:right">${kr(u.belop)}</td></tr>`
      )
      .join("");

    const presisjonTekst =
      d.presisjon === "kundekonto"
        ? "Viser tall for akkurat dette utleveringsstedet (matchet på kundekonto)."
        : "Viser tall summert på org.nr-nivå (kundekonto matchet ikke direkte).";

    el.innerHTML = [
      avvikHtml,
      orgDeltHtml,
      '<div style="display:flex;gap:var(--s3);margin-bottom:var(--s4);flex-wrap:wrap">',
      '<div class="kort" style="flex:1;min-width:150px">',
      '<div class="lbl">Omsetning 2026</div>',
      `<div class="verdi">${kr(oms2026)}</div>`,
      `<div class="sub">${deltaPct == null ? "—" : (deltaPct >= 0 ? "+" : "") + deltaPct + "% mot i fjor"}</div>`,
      "</div>",
      '<div class="kort" style="flex:1;min-width:150px">',
      '<div class="lbl">Omsetning 2025</div>',
      `<div class="verdi">${kr(oms2025)}</div>`,
      '<div class="sub">samme kildeperiode</div>',
      "</div>",
      "</div>",
      `<p style="font-size:12px;color:var(--d-tekst-3);margin:0 0 var(--s2)">Viser ukentlig omsetningssum fra grossist (FIKS-14) — ikke enkeltordre. ${esc(presisjonTekst)} Siste 12 uker med data:</p>`,
      '<table class="d-tabell"><thead><tr><th>År</th><th>Uke</th><th>Grossist</th><th style="text-align:right">Beløp</th></tr></thead>',
      `<tbody>${rader}</tbody></table>`,
    ].join("");
  }

  // ---------- KUNDEKORT (kundeinfo + faner) — Variant A "Oversikt" ----------
  function initialer(navn) {
    return (
      String(navn || "").trim().split(/\s+/).filter(Boolean).slice(0, 2)
        .map((w) => w[0].toUpperCase()).join("") || "?"
    );
  }

  /* Liten "data kommer"-merkelapp for placeholder-felt */
  const KOMMER =
    '<span class="d-kommer" title="Data kommer når ordre-/Excel-kobling er på plass">kommer</span>';

  function placeholderFane(tit, tekst) {
    return (
      '<div class="d-kk-tomstat">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span class="d-t-h2">' + esc(tit) + "</span>" + KOMMER + "</div>" +
      esc(tekst) + "</div>"
    );
  }

  async function monterKundekort(kundeId, el) {
    el.innerHTML =
      '<p style="color:var(--d-tekst-3);font-size:13px;padding:var(--s4) 0">Laster kundekort…</p>';

    let kunde = {};
    let salgshist = {};
    {
      const [kundeRes, salgshistRes] = await Promise.allSettled([
        api(`/api/kunder/${kundeId}`),
        api(`/api/kunder/${kundeId}/salgshistorikk`),
      ]);
      if (kundeRes.status === "fulfilled") kunde = kundeRes.value;
      else console.warn("Kunne ikke hente kundedata:", kundeRes.reason?.message);
      if (salgshistRes.status === "fulfilled") salgshist = salgshistRes.value;
      else console.warn("Kunne ikke hente salgshistorikk:", salgshistRes.reason?.message);
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

    const status = kunde.status || "Lead";
    const badgeFarge = statusFarge(status);
    const navn = kunde.navn || "Kunde";
    const erLead = status === "Lead";
    const selger = kunde.selger_navn || "";

    /* ── Meta-rad under navnet ── */
    const meta = [];
    if (kunde.orgnr) meta.push(`<span class="d-kk-mono">${esc(kunde.orgnr)}</span>`);
    if (segTekst) meta.push(`<span>${esc(segTekst)}</span>`);
    meta.push(`<span>Kunde siden ${KOMMER}</span>`);
    if (selger)
      meta.push(
        `<span class="d-kk-kam"><span class="pp">${esc(initialer(selger))}</span>${esc(selger)}</span>`
      );
    const metaHtml = meta.join('<span class="skille">·</span>');

    /* ── KPI-strip: "Omsetning i år" er ekte data når org.nr matcher salgsdata (FIKS-14),
       resten er placeholder til margin/kreditt/ordre-kilder finnes ── */
    const totPerAr = salgshist.totalt_per_ar || {};
    const oms2026 = totPerAr["2026"];
    const oms2025 = totPerAr["2025"];
    const harOmsData = oms2026 != null;
    const omsDeltaPct =
      harOmsData && oms2025 ? Math.round(((oms2026 - oms2025) / oms2025) * 1000) / 10 : null;

    const kpi = [
      {
        lbl: "Omsetning i år",
        sub:
          (omsDeltaPct == null ? "mot i fjor" : (omsDeltaPct >= 0 ? "+" : "") + omsDeltaPct + "% mot i fjor") +
          (salgshist.presisjon === "orgnr" && salgshist.org_delt_med_andre_kunder ? " · org.nr-nivå (kjede)" : ""),
        verdi: harOmsData ? kr(oms2026) : "—",
        kommer: !harOmsData,
      },
      { lbl: "Totalmargin", sub: "dekningsbidrag", verdi: "—", kommer: true },
      { lbl: "Utestående", sub: "av kredittgrense", verdi: "—", kommer: true },
      { lbl: "Snittordre", sub: "ordrefrekvens", verdi: "—", kommer: true },
    ]
      .map(
        (k) =>
          '<div class="kort">' +
          '<div class="lbl">' + esc(k.lbl) + (k.kommer ? KOMMER : "") + "</div>" +
          '<div class="verdi' + (k.kommer ? " d-ph" : "") + '">' + esc(k.verdi) + "</div>" +
          '<div class="sub">' + esc(k.sub) + "</div>" +
          "</div>"
      )
      .join("");

    el.innerHTML = [
      '<div class="d-kk">',

      /* ===== HEADER ===== */
      '<div class="d-kk-hode">',
      '<div style="display:flex;gap:var(--s4)">',
      `<div class="d-kk-avatar">${esc(initialer(navn))}</div>`,
      "<div>",
      '<div class="d-kk-navn">',
      `<span class="d-t-h1">${esc(navn)}</span>`,
      `<span class="d-badge ${badgeFarge}">${esc(status)}</span>`,
      (kunde.konkurs_flagg ? '<span class="d-badge roed" title="Konkurs registrert i BRREG">⚠ Konkurs</span>' : ''),
      (kunde.under_avvikling ? '<span class="d-badge roed" title="Under avvikling i BRREG">⚠ Under avvikling</span>' : ''),
      (kunde.under_tvangsavvikling ? '<span class="d-badge roed" title="Under tvangsavvikling i BRREG">⚠ Tvangsavvikling</span>' : ''),
      "</div>",
      `<div class="d-kk-meta">${metaHtml}</div>`,
      "</div>",
      "</div>",
      /* handlingsknapper */
      '<div class="d-kk-handling">',
      '<button id="kk-ny-kalkyle" class="d-knapp primar">+ Ny kalkyle</button>',
      '<button id="kk-ny-aktivitet" class="d-knapp sekundar">Aktivitet</button>',
      '<button id="kk-edit-toggle" class="d-kk-ikonknapp" title="Rediger kundeinfo">✎</button>',
      "</div>",
      "</div>",

      /* ===== KPI-STRIP ===== */
      `<div class="d-kk-kpi">${kpi}</div>`,

      /* ===== EDIT-PANEL (skjult til blyant trykkes) ===== */
      '<div id="ki-edit" style="display:none;border-top:1px solid var(--d-ramme);padding:var(--s5) var(--s6);background:var(--bg)">',

      /* BRREG-rad */
      '<div style="display:flex;align-items:flex-end;gap:var(--s3);flex-wrap:wrap;margin-bottom:var(--s4)">',
      '<div class="d-felt" style="flex:0 0 auto">',
      "<label>Org.nr</label>",
      `<input id="ki-orgnr" class="d-input" value="${esc(kunde.orgnr || "")}" placeholder="9 siffer" style="width:130px">`,
      "</div>",
      '<button id="ki-brreg-btn" class="d-knapp subtil">Hent fra BRREG</button>',
      '<span id="ki-brreg-status" style="font-size:12px;color:var(--d-tekst-3)"></span>',
      "</div>",

      /* Konkurs-varsel */
      '<div id="ki-konkurs-varsel" style="display:none;background:var(--d-roed-bg);color:var(--d-roed);border:1px solid #E6B5AE;border-radius:var(--d-radius-sm);padding:10px 14px;margin-bottom:var(--s3);font-weight:600;font-size:13px">',
      "⚠ Registrert konkurs i BRREG — vurder å sette status «Konkurs»",
      "</div>",

      /* Segment-hint */
      `<div id="ki-segment-hint" style="display:${segTekst ? "block" : "none"};font-size:12px;color:var(--d-tekst-3);margin-bottom:var(--s3);padding:8px 10px;background:var(--panel);border:1px solid var(--d-ramme);border-radius:var(--d-radius-sm)">`,
      `Næring: <span id="ki-segment-tekst">${esc(segTekst)}</span>`,
      "</div>",

      /* Status */
      '<div class="d-felt" style="max-width:280px;margin-bottom:var(--s3)">',
      "<label>Status</label>",
      `<select id="ki-status" class="d-select">${statusOpt}</select>`,
      "</div>",

      /* Forklaring (betinget) */
      `<div id="ki-forklaring-wrap" style="display:${erIkkeAktuell ? "block" : "none"};margin-bottom:var(--s3)">`,
      '<div class="d-felt">',
      "<label>Forklaring *</label>",
      `<input id="ki-forklaring" class="d-input" value="${esc(kunde.ikke_aktuell_forklaring || "")}" placeholder="Påkrevd forklaring">`,
      "</div>",
      "</div>",

      /* Gjenbesøk (betinget) */
      `<div id="ki-gjenbesok-wrap" style="display:${erSovende ? "block" : "none"};margin-bottom:var(--s3)">`,
      '<div class="d-felt" style="max-width:200px">',
      "<label>Gjenbesøk dato</label>",
      `<input id="ki-gjenbesok" type="date" class="d-input" value="${gjDato}">`,
      "</div>",
      "</div>",

      /* Adresser (redigerbare) */
      '<div class="d-grid d-g2" style="margin-bottom:var(--s3)">',
      '<div class="d-felt">',
      "<label>Leveringsadresse</label>",
      `<input id="ki-levadresse" class="d-input" value="${esc(kunde.leveringsadresse || "")}" placeholder="Adresse">`,
      "</div>",
      '<div class="d-felt">',
      "<label>Fakturaadresse</label>",
      `<input id="ki-faktadresse" class="d-input" value="${esc(kunde.fakturaadresse || "")}" placeholder="Adresse"${erSamme ? " disabled" : ""}>`,
      '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--d-tekst-3);cursor:pointer;margin-top:4px;font-weight:400">',
      `<input id="ki-samme" type="checkbox"${erSamme ? " checked" : ""}> Samme som levering`,
      "</label>",
      "</div>",
      "</div>",

      /* Lagre */
      '<div style="display:flex;align-items:center;gap:var(--s3)">',
      '<button id="ki-lagre-btn" class="d-knapp primar">Lagre kundeinfo</button>',
      '<span id="ki-lagre-status" style="font-size:12px;color:var(--d-tekst-3)"></span>',
      "</div>",
      "</div>",

      /* ===== BODY: to kolonner ===== */
      '<div class="d-kk-body">',

      /* --- VENSTRE: detaljer --- */
      '<div class="d-kk-venstre">',

      /* Konsepter */
      "<div>",
      '<div style="display:flex;align-items:center;justify-content:space-between">',
      '<span class="d-kk-sek-tit">Konsepter</span>',
      "</div>",
      '<div id="ks-konsepter" style="margin-top:var(--s3)"></div>',
      "</div>",

      '<div class="d-kk-skille"></div>',

      /* Grossister */
      "<div>",
      '<div style="display:flex;align-items:center;justify-content:space-between">',
      '<span class="d-kk-sek-tit">Grossister</span>',
      "</div>",
      '<div id="ks-grossister" style="margin-top:var(--s3)"></div>',
      "</div>",

      '<div class="d-kk-skille"></div>',

      /* Adresser (lese) */
      "<div>",
      '<span class="d-kk-sek-tit">Adresser</span>',
      '<div style="margin-top:var(--s3);display:flex;flex-direction:column;gap:13px">',
      '<div class="d-kk-adr"><div><div class="albl">Leveringsadresse</div>',
      `<div class="aval">${kunde.leveringsadresse ? esc(kunde.leveringsadresse) : '<span class="d-ph">Ikke registrert</span>'}</div></div></div>`,
      '<div class="d-kk-adr"><div><div class="albl">Fakturaadresse</div>',
      `<div class="aval">${kunde.fakturaadresse ? esc(kunde.fakturaadresse) : '<span class="d-ph">Ikke registrert</span>'}</div></div></div>`,
      (function() {
        var cu = window.CURRENT_USER;
        var erAdmin = cu && (cu.rolle === 'leder' || cu.rolle === 'admin' || cu.rolle === 'superadmin');
        var regionBadge = kunde.region
          ? ('<span class="d-badge flat bla">' + esc(kunde.region) + '</span>'
             + (kunde.region_delt ? ' <span class="d-badge flat gul" title="Postnr delt mellom to regioner">Delt</span>' : ''))
          : '<span class="d-ph">—</span>';
        if (!erAdmin) return '<div class="d-kk-rad" style="margin-top:8px"><span class="k">Region</span><span class="v">' + regionBadge + '</span></div>';
        var delt = kunde.region_delt ? '<div style="margin-bottom:4px"><span class="d-badge flat gul">Delt postnr — velg region</span></div>' : '';
        var opts = ['Øst','Vest','Nord','Sør'].map(function(r){
          return '<option value="'+r+'"'+(r===kunde.region?' selected':'')+'>'+r+'</option>';
        }).join('');
        return '<div class="d-kk-rad" style="margin-top:8px;flex-wrap:wrap;gap:6px"><span class="k">Region</span><span class="v" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
          + delt
          + '<select id="kkRegionSel" class="d-input" style="width:auto;padding:3px 8px;font-size:12px">'
          + '<option value="">— ingen —</option>' + opts
          + '</select>'
          + '<button class="d-knapp subtil sm" onclick="window.lagreRegion(\''+kunde.id+'\')">Lagre</button>'
          + '</span></div>';
      })(),
      "</div>",
      "</div>",

      '<div class="d-kk-skille"></div>',

      /* Leads-info (nye felt fra leads-import) */
      (function() {
        var har = kunde.telefon || kunde.epost || kunde.postnr || kunde.bransje || kunde.lead_score != null
          || kunde.naermeste_grossist || kunde.markedskjede || kunde.innkjopssamarbeid;
        if (!har) return '';
        var r = '<div><span class="d-kk-sek-tit">Leads-info</span>';
        r += '<div style="margin-top:var(--s3);display:flex;flex-direction:column;gap:9px">';
        if (kunde.telefon)
          r += '<div class="d-kk-rad"><span class="k">Telefon</span><span class="v"><a href="tel:'+esc(kunde.telefon)+'">'+esc(kunde.telefon)+'</a></span></div>';
        if (kunde.epost)
          r += '<div class="d-kk-rad"><span class="k">E-post</span><span class="v"><a href="mailto:'+esc(kunde.epost)+'">'+esc(kunde.epost)+'</a></span></div>';
        if (kunde.postnr || kunde.poststed)
          r += '<div class="d-kk-rad"><span class="k">Poststed</span><span class="v">'+esc((kunde.postnr||'')+' '+(kunde.poststed||'')).trim()+'</span></div>';
        if (kunde.kommune)
          r += '<div class="d-kk-rad"><span class="k">Kommune</span><span class="v">'+esc(kunde.kommune)+'</span></div>';
        if (kunde.fylke)
          r += '<div class="d-kk-rad"><span class="k">Fylke</span><span class="v">'+esc(kunde.fylke)+'</span></div>';
        if (kunde.bransje)
          r += '<div class="d-kk-rad"><span class="k">Bransje</span><span class="v">'+esc(kunde.bransje)+'</span></div>';
        if (kunde.bransjegruppe)
          r += '<div class="d-kk-rad"><span class="k">Bransjegruppe</span><span class="v"><span class="d-badge flat graa">'+esc(kunde.bransjegruppe)+'</span></span></div>';
        if (kunde.lead_score != null)
          r += '<div class="d-kk-rad"><span class="k">Lead Score</span><span class="v"><span class="d-badge flat '+(kunde.lead_score>=80?'bla':'graa')+'">'+kunde.lead_score+'</span></span></div>';
        if (kunde.naermeste_grossist)
          r += '<div class="d-kk-rad"><span class="k">Nærmeste grossist</span><span class="v">'+esc(kunde.naermeste_grossist)+'</span></div>';
        if (kunde.markedskjede)
          r += '<div class="d-kk-rad"><span class="k">Markedskjede</span><span class="v">'+esc(kunde.markedskjede)+'</span></div>';
        if (kunde.innkjopssamarbeid)
          r += '<div class="d-kk-rad"><span class="k">Innkjøpssamarbeid</span><span class="v">'+esc(kunde.innkjopssamarbeid)+'</span></div>';
        r += '</div></div><div class="d-kk-skille"></div>';
        return r;
      })(),

      /* Org-info (BRREG + kundekonto) */
      (function() {
        var har = kunde.kundekonto || kunde.kjede || kunde.brreg_navn || kunde.organisasjonsform
          || kunde.naeringskode_tekst || kunde.stiftelsesdato || kunde.mva_registrert != null
          || kunde.forretningsadresse;
        if (!har) return '';
        var r = '<div><span class="d-kk-sek-tit">Org-info</span>';
        r += '<div style="margin-top:var(--s3);display:flex;flex-direction:column;gap:9px">';
        if (kunde.kundekonto)
          r += '<div class="d-kk-rad"><span class="k">Kundekonto</span><span class="v d-kk-mono">'+esc(kunde.kundekonto)+'</span></div>';
        if (kunde.kjede)
          r += '<div class="d-kk-rad"><span class="k">Kjede</span><span class="v">'+esc(kunde.kjede)+(kunde.underkjede?' / '+esc(kunde.underkjede):'')+'</span></div>';
        if (kunde.brreg_navn && kunde.brreg_navn !== kunde.navn)
          r += '<div class="d-kk-rad"><span class="k">BRREG-navn</span><span class="v">'+esc(kunde.brreg_navn)+'</span></div>';
        if (kunde.organisasjonsform)
          r += '<div class="d-kk-rad"><span class="k">Org.form</span><span class="v"><span class="d-badge flat graa">'+esc(kunde.organisasjonsform)+'</span></span></div>';
        if (kunde.naeringskode_tekst)
          r += '<div class="d-kk-rad"><span class="k">Næringskode</span><span class="v">'+(kunde.naeringskode?esc(kunde.naeringskode)+' — ':'')+esc(kunde.naeringskode_tekst)+'</span></div>';
        if (kunde.forretningsadresse)
          r += '<div class="d-kk-rad"><span class="k">Forr.adresse</span><span class="v">'+esc(kunde.forretningsadresse)+'</span></div>';
        if (kunde.stiftelsesdato)
          r += '<div class="d-kk-rad"><span class="k">Stiftet</span><span class="v">'+esc(kunde.stiftelsesdato)+'</span></div>';
        if (kunde.mva_registrert != null)
          r += '<div class="d-kk-rad"><span class="k">MVA-registrert</span><span class="v">'+(kunde.mva_registrert?'Ja':'Nei')+'</span></div>';
        r += '</div></div><div class="d-kk-skille"></div>';
        return r;
      })(),

      /* Levering & logistikk (placeholder) */
      "<div>",
      `<span class="d-kk-sek-tit">Levering &amp; logistikk</span> ${KOMMER}`,
      '<div style="margin-top:var(--s3);display:flex;flex-direction:column;gap:11px">',
      '<div class="d-kk-rad"><span class="k">Leveringsdager</span><span class="v d-ph">—</span></div>',
      '<div class="d-kk-rad"><span class="k">Rute</span><span class="v d-ph">—</span></div>',
      '<div class="d-kk-rad"><span class="k">Leveringsvindu</span><span class="v d-ph">—</span></div>',
      "</div>",
      "</div>",

      '<div class="d-kk-skille"></div>',

      /* Produktkategorier (placeholder) */
      "<div>",
      `<span class="d-kk-sek-tit">Produktkategorier</span> ${KOMMER}`,
      '<div style="margin-top:var(--s3)" class="d-ph">Kjøpsmiks vises når ordre-/Excel-koblingen er på plass.</div>',
      "</div>",

      '<div class="d-kk-skille"></div>',

      /* Betingelser (placeholder) */
      "<div>",
      `<span class="d-kk-sek-tit">Betingelser</span> ${KOMMER}`,
      '<div style="margin-top:var(--s3);display:flex;flex-direction:column;gap:11px">',
      '<div class="d-kk-rad"><span class="k">Betaling</span><span class="v d-ph">—</span></div>',
      '<div class="d-kk-rad"><span class="k">Prisavtale</span><span class="v d-ph">—</span></div>',
      "</div>",
      "</div>",

      "</div>",

      /* --- HØYRE: engasjement --- */
      '<div class="d-kk-hoyre">',

      /* Neste oppgave (placeholder) */
      '<div class="d-kk-oppgave">',
      '<span class="ikon">⚑</span>',
      '<div style="flex:1;min-width:0">',
      `<div style="font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primaer)">Neste oppgave ${KOMMER}</div>`,
      '<div style="font-size:13px;color:var(--d-tekst-2);margin-top:4px">Oppgaver/påminnelser kobles på senere. Logg aktiviteter under.</div>',
      "</div>",
      "</div>",

      /* Faner */
      '<div class="d-faner">',
      '<button class="d-fane aktiv" data-fane="kon">Kontaktpersoner</button>',
      '<button class="d-fane" data-fane="akt">Aktiviteter</button>',
      '<button class="d-fane" data-fane="kalk">Kalkyler</button>',
      '<button class="d-fane" data-fane="ord">Salgshistorikk</button>',
      '<button class="d-fane" data-fane="lev">Leveringssteder</button>',
      "</div>",
      '<div id="ks-faneinnhold"></div>',

      "</div>",
      "</div>",
      "</div>",
    ].join("");

    /* Konsepter: vis kun for ekte kunder */
    const konseptEl = el.querySelector("#ks-konsepter");
    if (konseptEl) {
      if (status && status !== "Lead") monterKonsepter(kundeId, konseptEl);
      else
        konseptEl.innerHTML =
          '<span class="d-ph" style="font-size:12px">Tilgjengelig når kunden ikke lenger er Lead.</span>';
    }

    /* Grossister */
    const grossistEl = el.querySelector("#ks-grossister");
    if (grossistEl) {
      const rolle = (typeof window._brukerRolle !== "undefined") ? window._brukerRolle : "";
      monterKundeGrossister(kundeId, grossistEl, rolle).catch((e) =>
        console.warn("monterKundeGrossister feil:", e)
      );
    }

    /* Handlingsknapper i header */
    const nyKalkBtn = el.querySelector("#kk-ny-kalkyle");
    if (nyKalkBtn)
      nyKalkBtn.addEventListener("click", () => {
        if (typeof window.newCalc === "function") window.newCalc();
      });

    /* Blyant: vis/skjul edit-panel */
    const editPanel = el.querySelector("#ki-edit");
    const editToggle = el.querySelector("#kk-edit-toggle");
    if (editToggle && editPanel)
      editToggle.addEventListener("click", () => {
        const vis = editPanel.style.display === "none";
        editPanel.style.display = vis ? "block" : "none";
        editToggle.classList.toggle("aktiv", vis);
        if (vis) editPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

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
        st.textContent = "Lagret ✓ — oppdaterer…";
        st.style.color = "var(--d-gronn)";
        setTimeout(() => monterKundekort(kundeId, el), 600);
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "var(--d-roed)";
        btn.disabled = false;
      }
    });

    /* Faner */
    const innhold = el.querySelector("#ks-faneinnhold");
    const visFane = (f) => {
      if (f === "lev") monterLeveringssteder(kundeId, innhold);
      else if (f === "akt") monterAktiviteter(kundeId, innhold);
      else if (f === "kon") monterKontaktpersoner(kundeId, innhold);
      else if (f === "kalk")
        innhold.innerHTML = placeholderFane(
          "Kalkyler",
          "Kalkyler knyttet til kundekortet vises her når kalkyle-koblingen er ferdig. Du kan opprette kalkyler nå via «Ny kalkyle»."
        );
      else if (f === "ord") monterSalgshistorikk(kundeId, innhold);
    };
    el.querySelectorAll(".d-fane").forEach((b) =>
      b.addEventListener("click", () => {
        el.querySelectorAll(".d-fane").forEach((x) =>
          x.classList.toggle("aktiv", x === b)
        );
        visFane(b.dataset.fane);
      })
    );

    /* "Aktivitet"-knapp i header → hopp til Aktiviteter-fanen */
    const aktBtn = el.querySelector("#kk-ny-aktivitet");
    if (aktBtn)
      aktBtn.addEventListener("click", () => {
        const f = el.querySelector('.d-fane[data-fane="akt"]');
        if (f) f.click();
      });

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
    const totLead = app.totalt_leads || 0;
    const totVunnet = (app.per_status || []).reduce(function(s, r) { return r.status === "Vunnet" ? s + r.antall : s; }, 0);
    const konvRate = totLead > 0 ? Math.round(totVunnet / totLead * 1000) / 10 : null;
    const kpiKort = [
      { label: "Aktive kunder",           tall: app.totalt_kunder || 0,  vs: "Status: Kunde i CRM",                 nav: "setView('kunder');setKunderSub('kunder')", color:"#3b82f6", icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
      { label: "Leads",                   tall: totLead,                  vs: "Status: Lead i CRM",                  nav: "setView('kunder');setKunderSub('leads')",  color:"#8b5cf6", icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
      { label: "Kunder i risiko",         tall: app.totalt_risiko || 0,  vs: "Konkurs/avvikling i BRREG",           nav: "klRisikoFiltr=true;setView('kunder');setKunderSub('kunder');renderKlRisikoChip()", color:"#dc2626", icon:'<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
      { label: "Konverteringsrate",       tall: konvRate !== null ? konvRate.toLocaleString("nb-NO", {maximumFractionDigits:1}) + "%" : "—", vs: "Lead → Vunnet", nav: "", color:"#6366f1", icon:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
      { label: "Leads til oppf\xF8lging", tall: oppfolging.length,        vs: "Tilbud/gjenbes\xF8k krever handling", nav: "", color:"#f59e0b", icon:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
      { label: "\xC5pne tilbud",          tall: statusMap["Sendt"] ? statusMap["Sendt"].antall : 0, vs: "Status: Sendt", nav: "", color:"#ef4444", icon:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
      { label: "M\xF8ter denne uken",     tall: moter.length,             vs: "Man → s\xF8ndag",                nav: "", color:"#10b981", icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
    ];
    const kpiHtml = kpiKort.map(function(k) {
      var c = k.color, rr = parseInt(c.slice(1,3),16), gg = parseInt(c.slice(3,5),16), bb = parseInt(c.slice(5,7),16);
      var ibg = "rgba("+rr+","+gg+","+bb+",0.12)";
      return '<div class="d-kpi" style="position:relative' + (k.nav ? ';cursor:pointer' : '') + ';padding-top:18px!important;border-top:4px solid ' + c + '"' + (k.nav ? ' onclick="' + k.nav + '"' : '') + '>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
          '<p class="d-label" style="margin:0;line-height:1.4">' + esc(k.label) + '</p>' +
          '<div style="width:28px;height:28px;background:' + ibg + ';border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + c + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + k.icon + '</svg>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:26px;font-weight:800;color:var(--d-tekst,#111827);letter-spacing:-1px;line-height:1;margin:0">' + k.tall + '</p>' +
        '<p style="font-size:9px;color:' + c + ';margin-top:6px;font-weight:600;margin-bottom:0;text-transform:uppercase;letter-spacing:.4px">' + esc(k.vs) + '</p>' +
        "</div>";
    }).join("");

    // --- Pipeline-bånd (APP-tall, kundestatuser) ---
    const pipelineSteg = [
      { navn: "Lead",         farge: "#3b82f6", status: "Lead" },
      { navn: "Aktiv dialog", farge: "#14b8a6", status: "Aktiv dialog" },
      { navn: "Tilbud sendt", farge: "#f59e0b", status: "Sendt" },
      { navn: "Forhandling",  farge: "#8b5cf6", status: "Forhandling" },
      { navn: "Vunnet",       farge: "#10b981", status: "Vunnet" },
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
            '<td><button onclick="Steg4.slettMote(\'' + m.aktivitet_id + '\',this)" style="background:none;border:none;color:var(--d-tekst-3);cursor:pointer;font-size:14px;padding:2px 6px" title="Slett møte">✕</button></td>' +
            "</tr>";
        }).join("")
      : '<tr><td colspan="4" style="color:var(--d-tekst-3);font-style:italic;padding:var(--s4) var(--s3)">Ingen m\xF8ter denne uken.</td></tr>';

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

    // Per-selger-data sendes til visDashboardSelger via setView

    el.innerHTML =
      // KPI-rad (7 kort)
      '<div class="d-grid d-g7" style="margin-bottom:var(--s5)">' + kpiHtml + "</div>" +

      // Salgspipeline med footer
      '<div class="d-panel" style="margin-bottom:var(--s5)">' +
        '<div class="d-panel-hode">' +
          '<span class="d-t-h2">Salgspipeline</span>' +
          '<span class="d-t-hint">APP — potensiell omsetning fra kalkyler</span>' +
        "</div>" +
        '<div class="d-pipeline">' + pipelineHtml + "</div>" +
        '<div style="display:flex;gap:24px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)">' +
          '<span>Win rate: <strong style="color:var(--ink)">—</strong></span>' +
          '<span>Avg. deal size: <strong style="color:var(--ink)">—</strong></span>' +
          '<span>Salgssyklus: <strong style="color:var(--ink)">—</strong></span>' +
        "</div>" +
      "</div>" +

      // Møter + Oppfølging side om side
      '<div class="d-grid d-g2" style="margin-bottom:var(--s5)">' +
        '<div class="d-panel">' +
          '<div class="d-panel-hode"><span class="d-t-h2">Ukens m\xF8ter</span>' +
          '<button onclick="openNyttMote && openNyttMote()" style="font-size:11.5px;font-weight:600;color:#fff;background:var(--brand);border:none;padding:4px 10px;border-radius:5px;cursor:pointer;font-family:inherit">+ Nytt m\xF8te</button>' +
          "</div>" +
          '<table class="d-tabell"><thead><tr>' +
          '<th>Dato</th><th>Kunde</th><th>Notat</th><th></th>' +
          "</tr></thead><tbody>" + moterRader + "</tbody></table>" +
        "</div>" +
        '<div class="d-panel">' +
          '<div class="d-panel-hode"><span class="d-t-h2">Oppf\xF8lging</span>' +
          '<span style="font-size:11px;font-weight:600;color:var(--muted);background:var(--bg);padding:3px 10px;border-radius:10px;border:1px solid var(--line)">' + oppfolging.length + " aktive</span>" +
          "</div>" +
          '<table class="d-tabell"><thead><tr>' +
          "<th>Type</th><th>Kunde</th><th>Dato</th>" +
          "</tr></thead><tbody>" + oppfRader + "</tbody></table>" +
        "</div>" +
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

  // --- Pipeline Kanban-fane (datadrevet fra /api/pipeline) ---
  async function visDashboardPipeline(el) {
    if (!el) return;
    el.innerHTML = '<p style="color:var(--muted);font-size:13px">Laster pipeline…</p>';
    var pipelineData;
    try { pipelineData = await api("/api/pipeline"); }
    catch(e) { el.innerHTML = '<p style="color:var(--d-roed)">Feil: ' + esc(e.message) + "</p>"; return; }

    const stegKonfig = [
      { navn: "Lead",         farge: "#3b82f6", hdr: "rgba(59,130,246,0.08)" },
      { navn: "Aktiv dialog", farge: "#14b8a6", hdr: "rgba(20,184,166,0.08)" },
      { navn: "Tilbud sendt", farge: "#f59e0b", hdr: "rgba(245,158,11,0.08)" },
      { navn: "Forhandling",  farge: "#8b5cf6", hdr: "rgba(139,92,246,0.08)" },
      { navn: "Vunnet",       farge: "#10b981", hdr: "rgba(16,185,129,0.08)" },
    ];
    const stegMap = {};
    if (pipelineData && pipelineData.steg) {
      pipelineData.steg.forEach(function(s) { stegMap[s.steg] = s; });
    }
    const mnok = function(n) {
      return isFinite(n) && n
        ? (n / 1000000).toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " MNOK"
        : "0,0 MNOK";
    };
    const kolHtml = stegKonfig.map(function(steg) {
      const d = stegMap[steg.navn] || { antall: 0, sum_potensiell: 0 };
      return '<div style="flex:1;min-width:160px;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;display:flex;flex-direction:column">' +
        '<div style="padding:12px 14px;border-bottom:1px solid var(--line);background:' + steg.hdr + '">' +
          '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">' +
            '<div style="width:8px;height:8px;border-radius:50%;background:' + steg.farge + ';flex-shrink:0"></div>' +
            '<span style="font-size:12px;font-weight:700;color:var(--ink)">' + esc(steg.navn) + '</span>' +
            '<span style="margin-left:auto;background:' + steg.farge + ';color:#fff;font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px">' + d.antall + '</span>' +
          '</div>' +
          '<p style="font-size:10.5px;color:var(--muted);margin:0">' + mnok(d.sum_potensiell) + ' potensiell</p>' +
        '</div>' +
        '<div style="padding:12px;flex:1;min-height:80px"></div>' +
      '</div>';
    }).join("");
    const total = pipelineData ? pipelineData.totalt_deals : 0;
    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
        '<h2 style="font-size:15px;font-weight:700;color:var(--ink);margin:0">Pipeline</h2>' +
        '<span style="font-size:12px;color:var(--muted)">' + total + ' deals totalt · ' + mnok(pipelineData ? pipelineData.sum_potensiell_total : 0) + ' potensiell</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px;min-height:300px;flex-wrap:wrap">' + kolHtml + '</div>' +
      '<p style="font-size:11px;color:var(--muted);font-style:italic;margin-top:10px">APP-tall: potensiell omsetning fra kalkyler. «Forhandling» er ikke implementert i datamodellen ennå.</p>';
  }

  // --- Per selger-fane med Aktivitetsscore fra /api/scoreboard ---
  async function visDashboardSelger(el, appData) {
    if (!el) return;
    el.innerHTML = '<p style="color:var(--muted);font-size:13px">Laster selger-data…</p>';

    var scoreboard, dashApp;
    try {
      [scoreboard, dashApp] = await Promise.all([
        api("/api/scoreboard"),
        appData ? Promise.resolve(appData) : api("/api/dashboard"),
      ]);
    } catch(e) {
      el.innerHTML = '<p style="color:var(--d-roed)">Feil: ' + esc(e.message) + "</p>";
      return;
    }

    const kr = function(n) {
      return (n || 0).toLocaleString("nb-NO", { maximumFractionDigits: 0 }) + " kr";
    };

    // Bygg oppslagsmap: selger_id → dashboard-tall (pot. omsetning)
    var dashMap = {};
    (dashApp.per_selger || []).forEach(function(s) { dashMap[s.selger_id] = s; });

    var selgere = scoreboard.selgere || [];
    // Inkluder selgere i dashboard som ikke er i scoreboard
    (dashApp.per_selger || []).forEach(function(s) {
      if (s.selger_id && !selgere.find(function(x) { return x.selger_id === s.selger_id; })) {
        selgere.push({
          selger_id: s.selger_id, selger_navn: s.selger_navn,
          besok:0, sambesok:0, mote:0, kalkyle:0, telefon:0, epost:0,
          total:0, score:0, ukescore:0, siste_aktivitet_dager:null,
          antall_kunder: s.antall_kunder,
        });
      }
    });

    const scoreClr = function(pct) {
      if (pct >= 70) return "#10b981";
      if (pct >= 40) return "#f59e0b";
      return "var(--muted)";
    };

    const selgerRader = selgere.map(function(s) {
      const pct = s.score || 0;
      const clr = scoreClr(pct);
      const dash = dashMap[s.selger_id] || {};
      const pot = dash.sum_potensiell || 0;
      const sisteDager = s.siste_aktivitet_dager != null ? s.siste_aktivitet_dager + "d" : "—";
      return "<tr>" +
        '<td class="d-navn">' + esc(s.selger_navn || "—") + "</td>" +
        '<td style="text-align:right">' + (s.antall_kunder || 0) + "</td>" +
        '<td style="text-align:right">' + s.besok + "</td>" +
        '<td style="text-align:right">' + s.sambesok + "</td>" +
        '<td style="text-align:right">' + s.telefon + "</td>" +
        '<td style="text-align:right">' + s.kalkyle + "</td>" +
        '<td><div style="display:flex;align-items:center;gap:6px">' +
          '<div style="flex:1;height:5px;background:var(--line);border-radius:3px;overflow:hidden">' +
            '<div style="height:5px;background:' + clr + ';width:' + pct + '%;border-radius:3px"></div>' +
          '</div>' +
          '<span style="font-size:10.5px;font-weight:700;color:' + clr + ';flex-shrink:0;width:34px;text-align:right">' + pct + '%</span>' +
        '</div></td>' +
        '<td style="text-align:right;color:var(--muted)">' + sisteDager + "</td>" +
        '<td style="text-align:right;font-weight:600">' + kr(pot) + "</td>" +
        "</tr>";
    }).join("") || '<tr><td colspan="9" style="color:var(--muted)">Ingen data.</td></tr>';

    el.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
        '<h2 style="font-size:15px;font-weight:700;color:var(--ink);margin:0">Per selger · Activity Scoreboard</h2>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<span style="font-size:10px;color:var(--muted)">Periode: ' + esc(scoreboard.fra || "") + ' – ' + esc(scoreboard.til || "") + '</span>' +
          '<span style="font-size:10.5px;color:var(--muted);background:var(--bg);padding:3px 10px;border-radius:4px;border:1px solid var(--line)">Pot. oms. — ikke fakturert</span>' +
        '</div>' +
      '</div>' +
      '<div class="d-panel" style="overflow:auto;margin-bottom:var(--s4)">' +
        '<table class="d-tabell"><thead><tr>' +
        "<th>Selger</th>" +
        '<th style="text-align:right">Kunder</th>' +
        '<th style="text-align:right">Besøk</th>' +
        '<th style="text-align:right">Sambesøk</th>' +
        '<th style="text-align:right">Tlf</th>' +
        '<th style="text-align:right">Kalkyle</th>' +
        '<th>Aktivitetsscore</th>' +
        '<th style="text-align:right">Siste akt.</th>' +
        '<th style="text-align:right">Pot. omsetning</th>' +
        "</tr></thead><tbody>" + selgerRader + "</tbody></table>" +
      "</div>" +
      '<p style="font-size:12px;color:var(--d-roed);font-weight:600;background:var(--d-roed-bg);border:1px solid #E6B5AE;border-radius:var(--d-radius-sm);padding:var(--s3) var(--s4);margin:0">' +
      "⚠ APP-tall (potensiell omsetning fra kalkyler i Postgres) og EXCEL-tall (fakturert omsetning fra data.json) er bevisst adskilt og summeres aldri." +
      "</p>";
  }

  async function slettMote(aktivitetId, btn) {
    if (!confirm("Slett dette møtet?")) return;
    btn.disabled = true;
    try {
      await api("/api/moter/" + aktivitetId, { method: "DELETE" });
      const tr = btn.closest("tr");
      if (tr) tr.remove();
    } catch(e) {
      alert("Feil: " + e.message);
      btn.disabled = false;
    }
  }

  return {
    get API() { return API; }, set API(v) { API = v; },
    get token() { return token; }, set token(v) { token = v; },
    monterKundekort, visDashboard, visDashboardPipeline, visDashboardSelger, monterLeveringssteder, monterAktiviteter, monterKontaktpersoner, monterKonsepter, monterKundeGrossister, slettMote,
  };
})();
