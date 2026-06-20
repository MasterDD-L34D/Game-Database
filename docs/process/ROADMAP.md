# Roadmap Operativa - 6 Settimane

## Scopo

Rendere ogni item pronto per esecuzione delegabile con il minimo attrito operativo.

> **Audit 2026-06-20 (ground-truth, cross-repo backlog audit)**: documento di pianificazione di aprile 2026, **parzialmente eseguito**. Gli item sotto non hanno status marker, ma a verifica del codice: item **2/4/5/6 = DONE**, item **1 = PARZIALE** (4 router junction ancora flat-error), item **3 = OPEN** (checker missing-key non costruito + single-locale). Vedi "Stato 2026-06-20 (audit)" per-item. NB: NON superseded dalla spec `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` (workstream diverso -- slug-hardening/junction-test; collisione solo nel nome "roadmap").

## Governance operativa

- **Owner:** Solo Maintainer
- **Executor:** AI Agent
- **Decision policy:** human-in-the-loop solo per approvazioni di rilascio e scelte architetturali

## RACI semplificata

- **Decide:** Solo Maintainer
- **Esegue:** AI Agent (con supervisione)
- **Verifica finale:** Solo Maintainer

## Now (pronto subito)

### 1) Standard error response backend

- **Dipendenza singola esplicita:** Nessuna
- **Input minimi:** elenco endpoint prioritari; contratto API corrente nel repository; suite test di integrazione esistente o estendibile
- **Output verificabile:** payload errore uniforme (`code`, `message`, `details`) sugli endpoint prioritari; test di integrazione verdi; documentazione API aggiornata
- **Criterio di handoff to AI:** handoff possibile quando gli endpoint prioritari sono già identificati nel repo o in issue collegata e l'AI puo modificare backend, test e docs senza attendere decisioni di prodotto
- **Stato 2026-06-20 (audit):** PARZIALE -- contratto `server/utils/httpErrors.js` (`errorPayload`/`AppError`/`sendError`, code+message+details) shipped e usato in 9/13 router (audit/biomes/ecosystems/records/search/species/taxonomyVersions/traits = 0 flat-error). Residuo OPEN: 4 router junction restano flat `{error:'string'}` -> ecosystemBiomes (17) / ecosystemSpecies (22) / speciesBiomes (23) / speciesTraits (11): migrarli al contratto uniforme.

## Next (pronto dopo 1 dipendenza)

### 2) Test permessi negativi/positivi

- **Dipendenza singola esplicita:** matrice ruoli/permessi approvata e versionata
- **Input minimi:** matrice ruoli/permessi; elenco endpoint o use case critici; ambiente test/CI allineato
- **Output verificabile:** suite automatizzata con casi consentiti e negati per i ruoli critici; esecuzione stabile in CI; report test allegabile a PR
- **Criterio di handoff to AI:** handoff possibile appena esiste una sola fonte di verita per ruoli e permessi, cosi l'AI puo derivare i casi di test senza chiedere interpretazioni
- **Stato 2026-06-20 (audit):** DONE -- `server/test/permissions.test.js` (casi pos/neg, 403/FORBIDDEN + allow); SoT ruoli = `TAXONOMY_WRITE_ROLES` in `server/middleware/permissions.js` (CWE-290 fix).

### 3) Verifica i18n stringhe nuove

- **Dipendenza singola esplicita:** merge delle nuove chiavi di testo nei file sorgente
- **Input minimi:** elenco chiavi nuove; file di localizzazione target; flussi UI toccati
- **Output verificabile:** nessuna chiave mancante nelle lingue supportate per i flussi coinvolti; fallback verificato manualmente o con check automatico; eventuale report chiavi mancanti a zero
- **Criterio di handoff to AI:** handoff possibile quando il set di chiavi da verificare e gia presente nel codice e non dipende da copy ancora in definizione
- **Stato 2026-06-20 (audit):** OPEN -- infra i18n esiste (`apps/dashboard/src/i18n/`, i18next + pipeline trait #185) ma manca il check automatico missing-key e c'e' un solo locale (`it`). Se single-locale e' intenzionale -> N/A; altrimenti il deliverable "report chiavi mancanti a zero" non e' costruito.

### 4) Runbook bootstrap DB/import

- **Dipendenza singola esplicita:** script di bootstrap/import aggiornati e stabili
- **Input minimi:** script correnti; percorso dati di esempio o dump minimo; ambiente target del runbook
- **Output verificabile:** runbook versionato con passi ripetibili di bootstrap e import; esecuzione provata end-to-end; conferma di esito atteso documentata
- **Criterio di handoff to AI:** handoff possibile quando gli script da documentare sono gia quelli definitivi o abbastanza stabili da non invalidare il runbook al primo cambio
- **Stato 2026-06-20 (audit):** DONE -- `docs/process/RUNBOOK.md` + `docs/process/database-bootstrap.md` (bootstrap + import ripetibile end-to-end, versionati, PR #87).

## Later

### 5) Validazioni input router prioritari

- **Dipendenza singola esplicita:** schema richieste e regole di dominio approvati
- **Input minimi:** elenco router prioritari; schema richieste; regole dominio da applicare; casi limite noti
- **Output verificabile:** i router prioritari rifiutano input non validi con errori coerenti; test automatici sui casi limite principali; note di compatibilita aggiornate se necessarie
- **Criterio di handoff to AI:** handoff possibile quando esiste una definizione univoca delle regole di validazione e non serve negoziare il comportamento con prodotto o backend
- **Stato 2026-06-20 (audit):** DONE -- `server/utils/validation.js` (assertString/assertEnum/assertPagination/assertIdParam -> 400 VALIDATION_ERROR) in 11/13 router; test `taxonomyRouters.test.js` + `records.test.js` green; shipped PR #83.

### 6) Uniformazione feedback error/loading dashboard

- **Dipendenza singola esplicita:** linee guida UI/UX approvate per loading e error state
- **Input minimi:** viste dashboard coinvolte; componenti condivisi disponibili o design reference approvato; elenco stati da coprire
- **Output verificabile:** pattern unico di loading/error in tutte le viste principali; verifica UI su desktop e mobile; screenshot o review checklist completata
- **Criterio di handoff to AI:** handoff possibile quando esiste un pattern UI unico da applicare, cosi l'AI esegue convergenza senza introdurre scelte visuali arbitrarie
- **Stato 2026-06-20 (audit):** DONE -- pattern condiviso loading/error (`apps/dashboard/src/components/LoadingTableSkeleton.tsx` + `lib/api/errors.ts`, isLoading/isError uniforme nelle detail page, commit e242883). Spot-audit viste residue opzionale.

## Milestone

### Milestone 1 - Settimane 1-2

- **Titolo:** Fondazioni di delivery
- **Outcome:** baseline tecnica e operativa pronta per delegare task eseguibili end-to-end all'AI con criteri di verifica espliciti

### Milestone 2 - Settimane 3-4

- **Titolo:** Qualita e stabilizzazione
- **Outcome:** copertura test e coerenza dei comportamenti applicativi aumentate sulle aree a rischio piu alto

### Milestone 3 - Settimane 5-6

- **Titolo:** Preparazione rilascio
- **Outcome:** hardening finale, runbook affidabili e readiness di rilascio verificabile

## Regola operativa

- Un item puo stare in **Now** solo se la dipendenza singola esplicita e `Nessuna`.
- Un item puo stare in **Next** solo se manca una sola dipendenza concreta, osservabile e assegnabile.
- Un item va in **Later** se la dipendenza esiste ma non e ancora abbastanza definita da consentire esecuzione autonoma senza chiarimenti.
