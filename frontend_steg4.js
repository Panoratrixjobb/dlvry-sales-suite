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

  // ---------- KONTAKTPERSONER ----------
  async function monterKontaktpersoner(kundeId, el) {
    el.innerHTML = "<p>Laster kontaktpersoner…</p>";
    let kontakter;
    try {
      kontakter = await api(`/api/kunder/${kundeId}/kontaktpersoner`);
    } catch (e) {
      el.innerHTML = `<p style="color:#dc2626">Feil: ${esc(e.message)}</p>`;
      return;
    }
    kontakter.sort((a, b) => (b.er_primaer ? 1 : 0) - (a.er_primaer ? 1 : 0));

    const inp = (id, ph, extra = "") =>
      `<input id="${id}" placeholder="${ph}" ${extra} style="border:1px solid #e7ebf3;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit">`;

    const rader = kontakter
      .map(
        (k) => `
      <tr style="${k.er_primaer ? "font-weight:600;background:#f0f4ff" : ""}">
        <td>${esc(k.navn)}${k.er_primaer ? " ★" : ""}</td>
        <td>${esc(k.rolle || "—")}</td>
        <td>${esc(k.telefon || "—")}</td>
        <td>${esc(k.epost || "—")}</td>
        <td style="white-space:nowrap">
          ${
            !k.er_primaer
              ? `<button data-primaer="${k.id}" style="background:#eef1fb;color:#3b4cca;border:none;border-radius:6px;padding:4px 8px;font-size:11.5px;cursor:pointer;font-family:inherit">Sett primær</button>`
              : ""
          }
          <button data-slett-kon="${k.id}" style="background:#fbe9e9;color:#dc2626;border:none;border-radius:6px;padding:4px 8px;font-size:11.5px;cursor:pointer;margin-left:4px;font-family:inherit">Slett</button>
        </td>
      </tr>`
      )
      .join("");

    el.innerHTML = `
      <h4>Kontaktpersoner</h4>
      <table class="ks-tabell">
        <thead><tr><th>Navn</th><th>Rolle</th><th>Telefon</th><th>E-post</th><th></th></tr></thead>
        <tbody>${rader || '<tr><td colspan="5">Ingen kontaktpersoner ennå.</td></tr>'}</tbody>
      </table>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
        ${inp("kp-navn", "Navn *", 'style="border:1px solid #e7ebf3;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit;flex:1;min-width:120px"')}
        ${inp("kp-rolle", "Rolle")}
        ${inp("kp-tlf", "Telefon")}
        ${inp("kp-epost", "E-post")}
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#7a8499;cursor:pointer;white-space:nowrap">
          <input id="kp-primaer" type="checkbox"> Primær
        </label>
        <button id="kp-legg" style="background:#3b4cca;color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">Legg til</button>
        <span id="kp-status" style="font-size:12px;color:#7a8499"></span>
      </div>`;

    // Fix the epost input (placeholder hack above won't work cleanly, do it in JS)
    const epostEl = el.querySelector("#kp-epost");
    epostEl.type = "email";
    epostEl.placeholder = "E-post";

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
        st.style.color = "#dc2626";
        return;
      }
      st.textContent = "Lagrer…";
      st.style.color = "#7a8499";
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
        st.style.color = "#dc2626";
      }
    });
  }

  // ---------- KONSEPTER (kun ekte kunder, ikke leads) ----------
  const KONSEPTER = ["La Salumeria", "East Essence", "Godt Lokalt", "Sabor"];
  async function monterKonsepter(kundeId, el) {
    el.innerHTML = '<p style="margin:0;font-size:12px;color:#7a8499">Laster konsepter…</p>';
    let liste;
    try {
      liste = await api(`/api/kunder/${kundeId}/konsepter`);
    } catch (e) {
      el.innerHTML = '<p style="margin:0;color:#dc2626;font-size:12px">Feil: ' + esc(e.message) + "</p>";
      return;
    }
    const valgte = new Set(liste.map((k) => k.konsept));
    const tags = liste
      .map(
        (k) =>
          '<span style="display:inline-flex;align-items:center;gap:6px;background:#eef1fb;color:#3b4cca;border-radius:999px;padding:4px 6px 4px 12px;font-size:12px;font-weight:600">' +
          esc(k.konsept) +
          '<button data-slett-kon="' + k.id + '" title="Fjern" style="background:#dde3fb;color:#3b4cca;border:none;border-radius:999px;width:18px;height:18px;line-height:1;cursor:pointer;font-family:inherit;font-size:13px">×</button>' +
          "</span>"
      )
      .join("");
    const ledige = KONSEPTER.filter((k) => !valgte.has(k));
    const addCtrl = ledige.length
      ? '<select id="kon-velg" style="border:1px solid #e7ebf3;border-radius:8px;padding:6px 10px;font-size:12.5px;font-family:inherit">' +
        ledige.map((k) => "<option>" + esc(k) + "</option>").join("") +
        '</select><button id="kon-legg" style="background:#3b4cca;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">+ Legg til</button>'
      : '<span style="font-size:12px;color:#7a8499">Alle konsepter er lagt til</span>';

    el.innerHTML = [
      '<div style="background:#fff;border:1px solid #e7ebf3;border-radius:10px;padding:16px;margin-bottom:16px">',
      '<h4 style="margin:0 0 12px;font-size:14px;font-weight:700">Konsepter</h4>',
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px">',
      tags || '<span style="font-size:12px;color:#7a8499">Ingen konsepter ennå</span>',
      "</div>",
      '<div style="display:flex;gap:8px;align-items:center">',
      addCtrl,
      '<span id="kon-status" style="font-size:12px;color:#7a8499"></span>',
      "</div>",
      "</div>",
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
          st.style.color = "#dc2626";
        }
      });
  }

  // ---------- KUNDEKORT (kundeinfo + faner) ----------
  async function monterKundekort(kundeId, el) {
    el.innerHTML = "<p>Laster kundekort…</p>";

    let kunde = {};
    try {
      kunde = await api(`/api/kunder/${kundeId}`);
    } catch (e) {
      // Fallback: render med tomme felter slik at kortet alltid vises
      console.warn("Kunne ikke hente kundedata:", e.message);
    }

    const STATUSER = ["Lead", "Aktiv dialog", "Kunde", "Sovende", "Konkurs", "Ikke aktuell"];
    const statusOpt = STATUSER.map(
      (s) => `<option ${kunde.status === s ? "selected" : ""}>${esc(s)}</option>`
    ).join("");

    const fs = "border:1px solid #e7ebf3;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit";
    const rs = "align-items:center;gap:8px;margin-bottom:12px"; // uten display — settes per rad
    const ls = "color:#7a8499;font-size:12.5px;white-space:nowrap;min-width:130px";

    const erSamme = !!kunde.faktura_samme_som_levering;
    const erIkkeAktuell = kunde.status === "Ikke aktuell";
    const erSovende = kunde.status === "Sovende";
    const gjDato = kunde.gjenbesok_dato ? kunde.gjenbesok_dato.slice(0, 10) : "";
    const segTekst = kunde.naeringsbeskrivelse
      ? (kunde.naeringskode ? kunde.naeringskode + " — " : "") + kunde.naeringsbeskrivelse
      : "";

    el.innerHTML = [
      '<div style="background:#fff;border:1px solid #e7ebf3;border-radius:10px;padding:16px;margin-bottom:16px">',
      '<h4 style="margin:0 0 14px;font-size:14px;font-weight:700">Kundeinfo</h4>',

      '<div style="display:flex;' + rs + '">',
      '<label style="' + ls + '">Org.nr</label>',
      '<input id="ki-orgnr" value="' + esc(kunde.orgnr || "") + '" placeholder="9 siffer" style="' + fs + ';width:120px">',
      '<button id="ki-brreg-btn" style="background:#eef1fb;color:#3b4cca;border:none;border-radius:8px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">Hent fra BRREG</button>',
      '<span id="ki-brreg-status" style="font-size:12px;color:#7a8499"></span>',
      '</div>',

      '<div id="ki-konkurs-varsel" style="display:none;background:#fbe9e9;color:#dc2626;border:1px solid #f7d7d7;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-weight:600;font-size:13px">',
      '⚠ Registrert konkurs i BRREG — vurder å sette status «Konkurs»',
      '</div>',

      '<div id="ki-segment-hint" style="display:' + (segTekst ? "block" : "none") + ';font-size:12px;color:#7a8499;margin-bottom:12px;padding:8px 10px;background:#fafbfe;border:1px solid #e7ebf3;border-radius:8px">',
      'Næring: <span id="ki-segment-tekst">' + esc(segTekst) + '</span>',
      '</div>',

      '<div style="display:flex;' + rs + '">',
      '<label style="' + ls + '">Status</label>',
      '<select id="ki-status" style="' + fs + ';min-width:170px">' + statusOpt + '</select>',
      '</div>',

      '<div id="ki-forklaring-wrap" style="display:' + (erIkkeAktuell ? "flex" : "none") + ';' + rs + '">',
      '<label style="' + ls + '">Forklaring *</label>',
      '<input id="ki-forklaring" value="' + esc(kunde.ikke_aktuell_forklaring || "") + '" placeholder="Påkrevd forklaring" style="' + fs + ';flex:1">',
      '</div>',

      '<div id="ki-gjenbesok-wrap" style="display:' + (erSovende ? "flex" : "none") + ';' + rs + '">',
      '<label style="' + ls + '">Gjenbesøk dato</label>',
      '<input id="ki-gjenbesok" type="date" value="' + gjDato + '" style="' + fs + '">',
      '</div>',

      '<div style="display:flex;' + rs + '">',
      '<label style="' + ls + '">Leveringsadresse</label>',
      '<input id="ki-levadresse" value="' + esc(kunde.leveringsadresse || "") + '" placeholder="Adresse" style="' + fs + ';flex:1">',
      '</div>',

      '<div style="display:flex;' + rs + '">',
      '<label style="' + ls + '">Fakturaadresse</label>',
      '<input id="ki-faktadresse" value="' + esc(kunde.fakturaadresse || "") + '" placeholder="Adresse" style="' + fs + ';flex:1' + (erSamme ? ";background:#fafbff;color:#7a8499" : "") + '">',
      '<label style="display:flex;align-items:center;gap:5px;font-size:12px;color:#7a8499;cursor:pointer;white-space:nowrap">',
      '<input id="ki-samme" type="checkbox"' + (erSamme ? " checked" : "") + '> Samme som levering',
      '</label>',
      '</div>',

      '<div style="display:flex;align-items:center;gap:10px;margin-top:4px">',
      '<button id="ki-lagre-btn" style="background:#3b4cca;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit">Lagre kundeinfo</button>',
      '<span id="ki-lagre-status" style="font-size:12px;color:#7a8499"></span>',
      '</div>',
      '</div>',

      // Konsept-seksjon — kun for ekte kunder (skjules for leads)
      '<div id="ks-konsepter"></div>',

      '<div class="ks-faner">',
      '<button class="ks-fane aktiv" data-fane="lev">Leveringssteder</button>',
      '<button class="ks-fane" data-fane="akt">Aktiviteter</button>',
      '<button class="ks-fane" data-fane="kon">Kontaktpersoner</button>',
      '</div>',
      '<div id="ks-faneinnhold"></div>',
    ].join("");

    // Disable fakturaadresse on init if same-as-delivery
    if (erSamme) el.querySelector("#ki-faktadresse").disabled = true;

    // Konsepter: vis kun for ekte kunder (leads har ingen konsepter ennå)
    const konseptEl = el.querySelector("#ks-konsepter");
    if (konseptEl) {
      if (kunde.status && kunde.status !== "Lead") monterKonsepter(kundeId, konseptEl);
      else konseptEl.style.display = "none";
    }

    // BRREG-oppslag
    el.querySelector("#ki-brreg-btn").addEventListener("click", async () => {
      const orgnr = el.querySelector("#ki-orgnr").value.trim();
      const st = el.querySelector("#ki-brreg-status");
      const btn = el.querySelector("#ki-brreg-btn");
      btn.disabled = true;
      btn.textContent = "Henter…";
      st.style.color = "#7a8499";
      st.textContent = "";
      el.querySelector("#ki-konkurs-varsel").style.display = "none";
      try {
        const d = await api(`/api/brreg/${encodeURIComponent(orgnr)}`);
        // d.forretningsadresse er en ferdig formatert streng fra backend
        if (d.forretningsadresse) {
          el.querySelector("#ki-levadresse").value = d.forretningsadresse;
          if (el.querySelector("#ki-samme").checked)
            el.querySelector("#ki-faktadresse").value = d.forretningsadresse;
        }
        // d.naeringskode + d.naeringsbeskrivelse er flate felt fra backend
        if (d.naeringsbeskrivelse) {
          const hint = (d.naeringskode ? d.naeringskode + " — " : "") + d.naeringsbeskrivelse;
          el.querySelector("#ki-segment-tekst").textContent = hint;
          el.querySelector("#ki-segment-hint").style.display = "block";
        }
        if (d.konkurs) {
          el.querySelector("#ki-konkurs-varsel").style.display = "block";
        }
        st.textContent = d.navn ? "Hentet: " + d.navn : "Hentet fra BRREG";
        st.style.color = "#16a34a";
      } catch (e) {
        const kod = e.message.match(/^(\d+)/)?.[1];
        if (kod === "400") st.textContent = "Org.nr må være 9 siffer";
        else if (kod === "404") st.textContent = "Fant ikke org.nr i BRREG";
        else if (kod === "502") st.textContent = "BRREG utilgjengelig, prøv igjen";
        else st.textContent = "Feil: " + e.message;
        st.style.color = "#dc2626";
      } finally {
        btn.disabled = false;
        btn.textContent = "Hent fra BRREG";
      }
    });

    // Status → vis/skjul betingede felt
    el.querySelector("#ki-status").addEventListener("change", () => {
      const s = el.querySelector("#ki-status").value;
      el.querySelector("#ki-forklaring-wrap").style.display =
        s === "Ikke aktuell" ? "flex" : "none";
      el.querySelector("#ki-gjenbesok-wrap").style.display =
        s === "Sovende" ? "flex" : "none";
    });

    // Fakturaadresse = leveringsadresse
    const sammeEl = el.querySelector("#ki-samme");
    const faktEl = el.querySelector("#ki-faktadresse");
    const levEl = el.querySelector("#ki-levadresse");

    const oppdaterFakt = () => {
      if (sammeEl.checked) {
        faktEl.value = levEl.value;
        faktEl.disabled = true;
        faktEl.style.background = "#fafbff";
        faktEl.style.color = "#7a8499";
      } else {
        faktEl.disabled = false;
        faktEl.style.background = "";
        faktEl.style.color = "";
      }
    };

    sammeEl.addEventListener("change", oppdaterFakt);
    levEl.addEventListener("input", () => {
      if (sammeEl.checked) faktEl.value = levEl.value;
    });

    // Lagre kundeinfo
    el.querySelector("#ki-lagre-btn").addEventListener("click", async () => {
      const st = el.querySelector("#ki-lagre-status");
      const btn = el.querySelector("#ki-lagre-btn");
      const statusVal = el.querySelector("#ki-status").value;
      const forklaring = el.querySelector("#ki-forklaring").value.trim();

      if (statusVal === "Ikke aktuell" && !forklaring) {
        st.textContent = "Forklaring er påkrevd for «Ikke aktuell»";
        st.style.color = "#dc2626";
        el.querySelector("#ki-forklaring").focus();
        return;
      }

      btn.disabled = true;
      st.textContent = "Lagrer…";
      st.style.color = "#7a8499";

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
        st.textContent = "Lagret";
        st.style.color = "#16a34a";
      } catch (e) {
        st.textContent = "Feil: " + e.message;
        st.style.color = "#dc2626";
      } finally {
        btn.disabled = false;
      }
    });

    // Faner
    const innhold = el.querySelector("#ks-faneinnhold");
    const vis = (f) => {
      if (f === "lev") monterLeveringssteder(kundeId, innhold);
      else if (f === "akt") monterAktiviteter(kundeId, innhold);
      else if (f === "kon") monterKontaktpersoner(kundeId, innhold);
    };
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

  function norskDato(isoStr) {
    if (!isoStr) return "—";
    const d = new Date(isoStr + (isoStr.length === 10 ? "T00:00:00" : ""));
    return d.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" });
  }

  async function visDashboard(el, excelData) {
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;color:var(--muted);padding:20px 0">' +
      '<span style="display:inline-block;width:18px;height:18px;border:3px solid var(--brand);border-top-color:transparent;border-radius:50%;animation:spin 0.7s linear infinite"></span>' +
      "Laster dashboard…</div>" +
      "<style>@keyframes spin{to{transform:rotate(360deg)}}</style>";

    const [app, moter, oppfolging] = await Promise.all([
      api("/api/dashboard"),
      api("/api/moter").catch(() => []),
      api("/api/oppfolging").catch(() => []),
    ]);

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

    const iDagStr = new Date().toISOString().slice(0, 10);

    const moterRader = moter.length
      ? moter
          .map((m) => {
            const erIdag = (m.dato || "").slice(0, 10) === iDagStr;
            return (
              `<tr style="${erIdag ? "font-weight:700;background:#eef1fb" : ""}">` +
              `<td style="white-space:nowrap">${norskDato(m.dato)}</td>` +
              `<td><a href="#" data-kunde-id="${esc(m.kunde_id)}" style="color:var(--brand);text-decoration:none">${esc(m.kunde_navn)}</a></td>` +
              `<td style="color:var(--muted)">${esc(m.notat || "—")}</td></tr>`
            );
          })
          .join("")
      : '<tr><td colspan="3" style="color:var(--muted);font-style:italic">Ingen møter denne uken.</td></tr>';

    const oppfRader = oppfolging.length
      ? oppfolging
          .map((o) => {
            const forfalt = o.dato && (o.dato || "").slice(0, 10) < iDagStr;
            const typeLabel = o.type === "tilbud" ? "Tilbud" : "Gjenbesøk";
            return (
              `<tr>` +
              `<td style="white-space:nowrap"><span style="font-size:11px;padding:2px 7px;border-radius:4px;background:${o.type === "tilbud" ? "#eef1fb" : "#e7f6ed"};color:${o.type === "tilbud" ? "var(--brand)" : "var(--green)"};font-weight:600">${typeLabel}</span></td>` +
              `<td>${esc(o.kunde_navn)}</td>` +
              `<td style="white-space:nowrap;${forfalt ? "color:var(--red);font-weight:700" : "color:var(--muted)"}">${norskDato(o.dato)}</td></tr>`
            );
          })
          .join("")
      : '<tr><td colspan="3" style="color:var(--muted);font-style:italic">Ingen oppfølginger akkurat nå.</td></tr>';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <section class="panel" style="padding:16px">
          <h3 style="margin:0 0 4px;font-size:14px">Ukens møter</h3>
          <p style="margin:0 0 12px;font-size:12px;color:var(--muted)">I dag til og med søndag.</p>
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Dato</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Kunde</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Notat</th>
            </tr></thead>
            <tbody>${moterRader}</tbody>
          </table>
        </section>
        <section class="panel" style="padding:16px">
          <h3 style="margin:0 0 4px;font-size:14px">Oppfølging</h3>
          <p style="margin:0 0 12px;font-size:12px;color:var(--muted)">Tilbud med passert/nær frist og sovende kunder.</p>
          <table style="width:100%;border-collapse:collapse;font-size:12.5px">
            <thead><tr>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Type</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Kunde</th>
              <th style="text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);color:var(--muted);font-size:11.5px">Dato</th>
            </tr></thead>
            <tbody>${oppfRader}</tbody>
          </table>
        </section>
      </div>
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

    // Klikk på kunde-navn i møte-listen navigerer til kunden
    el.querySelectorAll("a[data-kunde-id]").forEach((a) => {
      a.addEventListener("click", (e) => {
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
