/* KonseptSuite — Steg 4 frontend-modul (vanilla JS, ingen rammeverk).
 * Kundekort: faner for Leveringssteder og Aktiviteter.
 * Dashboard: APP-tall og EXCEL-tall side om side, ALDRI summert.
 *
 * Bruk:
 *   Steg4.API = "https://konseptsuite-backend.onrender.com";
 *   Steg4.token = <JWT fra innlogging>;            // samme token resten av appen bruker
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

  // ---------- LEVERINGSSTEDER ----------
  async function monterLeveringssteder(kundeId, el) {
    el.innerHTML = "<p>Laster leveringssteder…</p>";
    const [grossister, steder] = await Promise.all([
      api("/api/grossister"),
      api(`/api/kunder/${kundeId}/leveringssteder`),
    ]);
    const gOpt = (valgt) =>
      '<option value="">— velg grossist —</option>' +
      grossister
        .map(
          (g) =>
            `<option value="${g.id}" ${g.id === valgt ? "selected" : ""}>${esc(
              g.navn
            )} (${esc(g.region || "")})</option>`
        )
        .join("");

    const rader = steder
      .map(
        (s) => `
      <tr>
        <td>${esc(s.navn || "—")}</td>
        <td>${esc(s.adresse || "—")}</td>
        <td>${esc(grossister.find((g) => g.id === s.grossist_id)?.navn || "—")}</td>
        <td style="text-align:right">${
          s.avstand_km != null ? s.avstand_km.toFixed(1) + " km" : "—"
        }</td>
        <td><button data-slett="${s.id}">Slett</button></td>
      </tr>`
      )
      .join("");

    el.innerHTML = `
      <h4>Leveringssteder</h4>
      <table class="ks-tabell">
        <thead><tr><th>Navn</th><th>Adresse</th><th>Grossist</th>
          <th style="text-align:right">Avstand</th><th></th></tr></thead>
        <tbody>${rader || '<tr><td colspan="5">Ingen ennå.</td></tr>'}</tbody>
      </table>
      <div class="ks-nytt">
        <input id="ls-navn" placeholder="Navn (f.eks. Hovedkjøkken)">
        <input id="ls-adr" placeholder="Adresse (geokodes automatisk)">
        <select id="ls-gross">${gOpt("")}</select>
        <button id="ls-legg">Legg til</button>
        <span id="ls-status"></span>
      </div>`;

    el.querySelectorAll("[data-slett]").forEach((b) =>
      b.addEventListener("click", async () => {
        await api(`/api/leveringssteder/${b.dataset.slett}`, { method: "DELETE" });
        monterLeveringssteder(kundeId, el);
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
      }
    });
  }

  // ---------- AKTIVITETER (CRM-logg) ----------
  const TYPER = ["Møte", "Telefon", "E-post", "Besøk", "Notat", "Oppgave"];
  async function monterAktiviteter(kundeId, el) {
    el.innerHTML = "<p>Laster aktiviteter…</p>";
    const akt = await api(`/api/kunder/${kundeId}/aktiviteter`);
    const linjer = akt
      .map(
        (a) => `
      <li class="ks-akt">
        <span class="ks-akt-type">${esc(a.type)}</span>
        <span class="ks-akt-dato">${new Date(a.dato).toLocaleDateString(
          "nb-NO"
        )}</span>
        <span class="ks-akt-bruker">${esc(a.bruker_navn || "")}</span>
        <button data-slett="${a.id}" title="Slett">×</button>
        <div class="ks-akt-notat">${esc(a.notat || "")}</div>
      </li>`
      )
      .join("");
    el.innerHTML = `
      <h4>Aktiviteter</h4>
      <div class="ks-nytt">
        <select id="ak-type">${TYPER.map(
          (t) => `<option>${t}</option>`
        ).join("")}</select>
        <input id="ak-dato" type="date">
        <input id="ak-notat" placeholder="Notat…" style="flex:1">
        <button id="ak-legg">Logg</button>
        <span id="ak-status"></span>
      </div>
      <ul class="ks-tidslinje">${
        linjer || "<li>Ingen aktivitet logget ennå.</li>"
      }</ul>`;

    el.querySelectorAll("[data-slett]").forEach((b) =>
      b.addEventListener("click", async () => {
        await api(`/api/aktiviteter/${b.dataset.slett}`, { method: "DELETE" });
        monterAktiviteter(kundeId, el);
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
      }
    });
  }

  // ---------- KUNDEKORT (faner) ----------
  function monterKundekort(kundeId, el) {
    el.innerHTML = `
      <div class="ks-faner">
        <button class="ks-fane aktiv" data-fane="lev">Leveringssteder</button>
        <button class="ks-fane" data-fane="akt">Aktiviteter</button>
      </div>
      <div id="ks-faneinnhold"></div>`;
    const innhold = el.querySelector("#ks-faneinnhold");
    const vis = (f) =>
      f === "lev"
        ? monterLeveringssteder(kundeId, innhold)
        : monterAktiviteter(kundeId, innhold);
    el.querySelectorAll(".ks-fane").forEach((b) =>
      b.addEventListener("click", () => {
        el.querySelectorAll(".ks-fane").forEach((x) =>
          x.classList.toggle("aktiv", x === b)
        );
        vis(b.dataset.fane);
      })
    );
    vis("lev");
  }

  // ---------- DASHBOARD: APP vs EXCEL side om side ----------
  // excelData: objektet appen allerede har fra data.json (konsepter[], total, ...).
  async function visDashboard(el, excelData) {
    el.innerHTML = "<p>Laster app-tall…</p>";
    const app = await api("/api/dashboard");

    const appStatus = app.per_status
      .map(
        (s) =>
          `<tr><td>${esc(s.status)}</td><td style="text-align:right">${
            s.antall
          }</td><td style="text-align:right">${kr(s.sum_potensiell)}</td></tr>`
      )
      .join("");
    const appSelger = app.per_selger
      .map(
        (s) =>
          `<tr><td>${esc(s.selger_navn || "—")}</td><td style="text-align:right">${
            s.antall_kunder
          }</td><td style="text-align:right">${
            s.antall_kalkyler
          }</td><td style="text-align:right">${kr(s.sum_potensiell)}</td></tr>`
      )
      .join("");

    const excelKonsept = (excelData?.konsepter || [])
      .map(
        (k) =>
          `<tr><td>${esc(k.navn || k.konsept)}</td><td style="text-align:right">${
            (k.y2026 ?? k.oms2026 ?? k.verdi ?? k.sum ?? 0).toLocaleString('nb-NO')
          } MNOK</td></tr>`
      )
      .join("");

    el.innerHTML = `
      <div class="ks-dash-grid">
        <section class="ks-dash-app">
          <h3>APP — potensiell omsetning</h3>
          <p class="ks-merk">Kalkyler/tilbud i KonseptSuite. <strong>Ikke fakturert.</strong></p>
          <div class="ks-kpi">
            <div><b>${kr(app.sum_potensiell_total)}</b><span>potensiell sum</span></div>
            <div><b>${app.totalt_kalkyler}</b><span>kalkyler</span></div>
            <div><b>${app.totalt_kunder}</b><span>kunder</span></div>
          </div>
          <h4>Per status</h4>
          <table class="ks-tabell"><thead><tr><th>Status</th>
            <th style="text-align:right">Antall</th>
            <th style="text-align:right">Potensiell</th></tr></thead>
            <tbody>${appStatus || '<tr><td colspan="3">Ingen.</td></tr>'}</tbody></table>
          <h4>Per selger</h4>
          <table class="ks-tabell"><thead><tr><th>Selger</th>
            <th style="text-align:right">Kunder</th>
            <th style="text-align:right">Kalkyler</th>
            <th style="text-align:right">Potensiell</th></tr></thead>
            <tbody>${appSelger || '<tr><td colspan="4">Ingen.</td></tr>'}</tbody></table>
        </section>

        <section class="ks-dash-excel">
          <h3>EXCEL — fakturert omsetning</h3>
          <p class="ks-merk">Fra KONSEPT_DASHBOARD_MASTER (YTD). <strong>Faktiske tall.</strong></p>
          <table class="ks-tabell"><thead><tr><th>Konsept</th>
            <th style="text-align:right">Omsetning</th></tr></thead>
            <tbody>${
              excelKonsept || '<tr><td colspan="2">Last data.json.</td></tr>'
            }</tbody></table>
        </section>
      </div>
      <p class="ks-advarsel">⚠️ App-tall (potensiell) og Excel-tall (fakturert) er
      bevisst adskilt og summeres aldri sammen.</p>`;
  }

  return {
    get API() { return API; }, set API(v) { API = v; },
    get token() { return token; }, set token(v) { token = v; },
    monterKundekort, visDashboard, monterLeveringssteder, monterAktiviteter,
  };
})();
