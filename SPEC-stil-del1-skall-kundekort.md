# KonseptSuite — Stil-utrulling DEL 1 (stilfil + skall + kundekort)
**Til: Claude Code, repo `dlvry-sales-suite`. Kjør lokalt → push til GitHub → Azure Static Web Apps auto-deploy.**

DLVRY-designsystemet er godkjent (farger fra DLVRYs presentasjonsmal). Vi ruller ut INKREMENTELT — denne del 1 dekker: (a) legg inn stilfila, (b) skall/sidemeny i DLVRY-stil, (c) kundekortet. IKKE rør resten av fanene ennå — de tas i senere deler etter live-verifisering.

## Forutsetning: arbeid varsomt
Appen har levd gjennom template-parser-feller (`${cond?a:b}` i innerHTML → bruk join("")) og display-konflikter (radStil display:flex kolliderte med betinget display). Behold de lærdommene. Verifiser på SKJERM (DOM/klikk via Claude i Chrome), ikke ved å lese kildekode gjennom sikkerhetsfilteret.

## (a) Legg inn stilfila
1. Kopier `dlvry-stil.css` (vedlagt) til repo-roten ved siden av `index.html`.
2. I `<head>` i `index.html`, FØR eventuell eksisterende `<style>`:
   ```html
   <link rel="stylesheet" href="dlvry-stil.css">
   ```
3. **Ikke slett eksisterende inline-CSS ennå** — den nye fila innfører nye klasser (`.panel`, `.kpi`, `.badge`, `.knapp` osv.), den overstyrer ikke gammelt med mindre klassenavn kolliderer. Sjekk for klassenavnkollisjon: søk i index.html etter eksisterende `.panel`/`.kort`/`.badge`/`.knapp`/`.btn`. Hvis kollisjon → rapporter FØR du fortsetter (vi må omdøpe, ikke overskrive blindt).

## (b) Skall + sidemeny i DLVRY-stil
Mål: venstre sidemeny (varm mørk brun `--sidemeny`) med DLVRY-logomerke + fanene, aktiv fane i korall.

**Fanenavn (GODKJENT — bruk nøyaktig disse, i denne rekkefølgen):**
Dashboard · Konsepter · Prising & Totalmargin · Kundeanalyse · CRM · Rapporter · Innstillinger

1. Wrap eksisterende app-innhold i `<div class="skall">` med `<aside class="sidemeny">` + `<main class="innhold">`.
2. Sidemeny-markup (kopier fra stilguidens `.sidemeny`-blokk — logo med `.mark` korall-form + `.meny a` lenker med ikon). Aktiv fane får `class="aktiv"`.
3. Koble hver fane-lenke til eksisterende visningslogikk (det som i dag bytter fane/seksjon). IKKE bygg ny ruting — bruk det som finnes, bare ny styling + nye navn.
4. Hvis appen i dag har topp-nav/horisontale faner: erstatt med sidemeny, behold samme klikk-handlere.

## (c) Kundekort i DLVRY-stil (FØRSTE side — Manuele valgte kundekort først)
Kundekortet finnes alt (steg 3a/4/5): kundeinfo øverst, BRREG-knapp, status-dropdown, faner Kontaktpersoner/Leveringssteder/Aktiviteter, adressefelter.

Omform til komponentene i stilfila — IKKE endre funksjonalitet, kun styling/markup-klasser:
1. **Topp-panel:** `.panel` med kundenavn i `.t-h1`, org.nr/etablert i `.sub`, status som `.badge` (map status→farge: Lead→bla, Aktiv dialog→gul, Kunde→gronn, Sovende→graa, Konkurs→roed, Ikke aktuell→graa).
2. **Segment/konsept-tagger:** `.badge.flat` (La Salumeria→roed, East Essence→bla [lilla kommer senere], Godt Lokalt→gronn, Sabor→gul). Kjøkkensegment/region som `.badge.flat.graa`.
3. **Knapper:** «Opprett tilbud» = `.knapp.primar`, «Registrer møte»/«Åpne kundekort» = `.knapp.sekundar`, «Hent fra BRREG» = `.knapp.subtil`, «Slett» = `.knapp.fare`.
4. **Kontaktpersoner-fane:** `.tabell` (eller kort-liste), primær markert med `.badge.gronn` «Primær».
5. **Aktivitetslogg:** `.tidslinje`/`.hending` (punkt-ikon + tittel + meta).
6. **Felt/dropdowns:** `.felt` + `.input`/`.select`. Status-dropdown og adressefelter beholder logikk (inkl. «samme som levering»-hake).
7. **BRREG-autofyll:** uendret oppførsel (confirm-before-set), kun styling.

## Verifisering (live, på skjerm)
Via Claude i Chrome mot Azure Static Web Apps-URL-en (se `konseptsuite-backend/infra/main.bicep` for gjeldende hostname):
1. Sidemeny vises i varm brun, DLVRY-logomerke, fanene med godkjente navn, aktiv fane i korall.
2. Åpne et kundekort → topp-panel, status-badge riktig farge, knapper i korall, faner virker, BRREG-knapp fungerer som før, aktivitetstidslinje vises.
3. Ingen funksjonsregresjon: opprett/slett kontaktperson, statusbytte, BRREG-oppslag — alt virker som før omstylingen.
4. Sjekk konsoll for feil (template-literal/parser-feller).

## Etter verifisering
Rapporter tilbake hva som funker + skjermbilder. DA tar vi DEL 2 (CRM-dashboard + KPI-kort + pipeline) og DEL 3 (Leads-tabell/kundeliste). Ikke fortsett til andre faner før kundekort + skall er bekreftet live.

## Åpent (ikke blokkerende)
- East Essence skal ha egen LILLA merkevarefarge (ikke teal) — egen `--ee`-token legges til når vi tar konsept-fargene samlet.
- Når alt er omstylet og verifisert: rydd ut død/duplisert gammel inline-CSS.
