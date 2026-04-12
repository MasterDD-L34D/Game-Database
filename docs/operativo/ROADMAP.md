# Roadmap Operativa — 6 Settimane

## Governance operativa
- **Owner:** Solo Maintainer
- **Executor:** AI Agent
- **Decision policy:** human-in-the-loop solo per approvazioni di rilascio e scelte architetturali

## RACI semplificata
- **Decide:** Solo Maintainer
- **Esegue:** AI Agent (con supervisione)
- **Verifica finale:** Solo Maintainer

## Settimana 1

### P0

#### 1) Standard error response backend
- **Owner:** Solo Maintainer
- **Stima:** 1.5 giorni
- **Dipendenze:** Allineamento con contratto API corrente e convenzioni logging.
- **Criterio di chiusura:** Tutti gli endpoint prioritari restituiscono payload errore uniforme (codice, messaggio, dettagli) validato da test di integrazione e documentato.

#### 2) Validazioni input router prioritari
- **Owner:** Solo Maintainer
- **Stima:** 2 giorni
- **Dipendenze:** Definizione schema richieste e regole dominio condivise con prodotto.
- **Criterio di chiusura:** I router prioritari bloccano input non validi con errori coerenti; copertura test su casi limite principali.

#### 3) Test permessi negativi/positivi
- **Owner:** Solo Maintainer
- **Stima:** 1.5 giorni
- **Dipendenze:** Matrice ruoli/permessi aggiornata e ambienti test allineati.
- **Criterio di chiusura:** Suite automatizzata copre percorsi consentiti e negati per i ruoli critici, con esecuzione stabile in CI.

### P1

#### 4) Uniformazione feedback error/loading dashboard
- **Owner:** Solo Maintainer
- **Stima:** 2 giorni
- **Dipendenze:** Linee guida UI/UX e componenti condivisi di stato caricamento/errore.
- **Criterio di chiusura:** Dashboard usa pattern unico per loading/error in tutte le viste principali, verificato con review UI.

#### 5) Verifica i18n stringhe nuove
- **Owner:** Solo Maintainer
- **Stima:** 1 giorno
- **Dipendenze:** Merge delle nuove chiavi testo e disponibilità file di localizzazione target.
- **Criterio di chiusura:** Nessuna chiave mancante nelle lingue supportate per i flussi toccati e fallback validato manualmente.

### P2

#### 6) Runbook bootstrap DB/import
- **Owner:** Solo Maintainer
- **Stima:** 1 giorno
- **Dipendenze:** Script aggiornati di bootstrap e procedura import dati concordata con backend.
- **Criterio di chiusura:** Runbook versionato con passi ripetibili (bootstrap + import), testato da almeno un membro non autore.

## Milestone 1 — Settimane 1-2: Fondazioni di delivery
- **Titolo:** Baseline tecnica e governance del flusso di lavoro
- **Owner:** Solo Maintainer
- **Outcome:** Pipeline CI attiva, convenzioni di branching documentate e checklist PR condivisa per ridurre regressioni iniziali.

## Milestone 2 — Settimane 3-4: Qualità e stabilizzazione
- **Titolo:** Rafforzamento qualità e copertura test
- **Owner:** Solo Maintainer
- **Outcome:** Soglie minime di test applicate in CI, tracciamento bug prioritizzati e riduzione del tasso di difetti in ambiente di test.

## Milestone 3 — Settimane 5-6: Preparazione rilascio
- **Titolo:** Hardening finale e readiness di rilascio
- **Owner:** Solo Maintainer
- **Outcome:** Criteri di rilascio verificati, piano rollback definito e pacchetto di release pronto per approvazione finale.

## Priorità di domani (11 aprile 2026)
1. Chiudere **standard error response backend** con evidenza test integrazione e aggiornamento documentazione API.
2. Completare **test permessi negativi/positivi** in CI sui ruoli critici con report allegato.
3. Consolidare **runbook bootstrap DB/import** con prova esecuzione da reviewer non autore.
