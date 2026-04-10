# Roadmap Operativa — 6 Settimane

## Settimana 1

### P0

#### 1) Standard error response backend
- **Owner:** Backend Lead
- **Stima:** 1.5 giorni
- **Dipendenze:** Allineamento con contratto API corrente e convenzioni logging.
- **Criterio di chiusura:** Tutti gli endpoint prioritari restituiscono payload errore uniforme (codice, messaggio, dettagli) validato da test di integrazione e documentato.

#### 2) Validazioni input router prioritari
- **Owner:** Backend Engineer
- **Stima:** 2 giorni
- **Dipendenze:** Definizione schema richieste e regole dominio condivise con prodotto.
- **Criterio di chiusura:** I router prioritari bloccano input non validi con errori coerenti; copertura test su casi limite principali.

#### 3) Test permessi negativi/positivi
- **Owner:** QA Engineer
- **Stima:** 1.5 giorni
- **Dipendenze:** Matrice ruoli/permessi aggiornata e ambienti test allineati.
- **Criterio di chiusura:** Suite automatizzata copre percorsi consentiti e negati per i ruoli critici, con esecuzione stabile in CI.

### P1

#### 4) Uniformazione feedback error/loading dashboard
- **Owner:** Frontend Lead
- **Stima:** 2 giorni
- **Dipendenze:** Linee guida UI/UX e componenti condivisi di stato caricamento/errore.
- **Criterio di chiusura:** Dashboard usa pattern unico per loading/error in tutte le viste principali, verificato con review UI.

#### 5) Verifica i18n stringhe nuove
- **Owner:** Frontend Engineer
- **Stima:** 1 giorno
- **Dipendenze:** Merge delle nuove chiavi testo e disponibilità file di localizzazione target.
- **Criterio di chiusura:** Nessuna chiave mancante nelle lingue supportate per i flussi toccati e fallback validato manualmente.

### P2

#### 6) Runbook bootstrap DB/import
- **Owner:** DevOps Engineer
- **Stima:** 1 giorno
- **Dipendenze:** Script aggiornati di bootstrap e procedura import dati concordata con backend.
- **Criterio di chiusura:** Runbook versionato con passi ripetibili (bootstrap + import), testato da almeno un membro non autore.

## Milestone 1 — Settimane 1-2: Fondazioni di delivery
- **Titolo:** Baseline tecnica e governance del flusso di lavoro
- **Owner:** Tech Lead
- **Outcome:** Pipeline CI attiva, convenzioni di branching documentate e checklist PR condivisa per ridurre regressioni iniziali.

## Milestone 2 — Settimane 3-4: Qualità e stabilizzazione
- **Titolo:** Rafforzamento qualità e copertura test
- **Owner:** QA Lead
- **Outcome:** Soglie minime di test applicate in CI, tracciamento bug prioritizzati e riduzione del tasso di difetti in ambiente di test.

## Milestone 3 — Settimane 5-6: Preparazione rilascio
- **Titolo:** Hardening finale e readiness di rilascio
- **Owner:** Engineering Manager
- **Outcome:** Criteri di rilascio verificati, piano rollback definito e pacchetto di release pronto per approvazione finale.
