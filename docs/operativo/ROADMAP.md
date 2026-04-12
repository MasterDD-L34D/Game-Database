# Roadmap Operativa - 6 Settimane

## Scopo
Rendere ogni item pronto per esecuzione delegabile con il minimo attrito operativo.

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

## Next (pronto dopo 1 dipendenza)

### 2) Test permessi negativi/positivi
- **Dipendenza singola esplicita:** matrice ruoli/permessi approvata e versionata
- **Input minimi:** matrice ruoli/permessi; elenco endpoint o use case critici; ambiente test/CI allineato
- **Output verificabile:** suite automatizzata con casi consentiti e negati per i ruoli critici; esecuzione stabile in CI; report test allegabile a PR
- **Criterio di handoff to AI:** handoff possibile appena esiste una sola fonte di verita per ruoli e permessi, cosi l'AI puo derivare i casi di test senza chiedere interpretazioni

### 3) Verifica i18n stringhe nuove
- **Dipendenza singola esplicita:** merge delle nuove chiavi di testo nei file sorgente
- **Input minimi:** elenco chiavi nuove; file di localizzazione target; flussi UI toccati
- **Output verificabile:** nessuna chiave mancante nelle lingue supportate per i flussi coinvolti; fallback verificato manualmente o con check automatico; eventuale report chiavi mancanti a zero
- **Criterio di handoff to AI:** handoff possibile quando il set di chiavi da verificare e gia presente nel codice e non dipende da copy ancora in definizione

### 4) Runbook bootstrap DB/import
- **Dipendenza singola esplicita:** script di bootstrap/import aggiornati e stabili
- **Input minimi:** script correnti; percorso dati di esempio o dump minimo; ambiente target del runbook
- **Output verificabile:** runbook versionato con passi ripetibili di bootstrap e import; esecuzione provata end-to-end; conferma di esito atteso documentata
- **Criterio di handoff to AI:** handoff possibile quando gli script da documentare sono gia quelli definitivi o abbastanza stabili da non invalidare il runbook al primo cambio

## Later

### 5) Validazioni input router prioritari
- **Dipendenza singola esplicita:** schema richieste e regole di dominio approvati
- **Input minimi:** elenco router prioritari; schema richieste; regole dominio da applicare; casi limite noti
- **Output verificabile:** i router prioritari rifiutano input non validi con errori coerenti; test automatici sui casi limite principali; note di compatibilita aggiornate se necessarie
- **Criterio di handoff to AI:** handoff possibile quando esiste una definizione univoca delle regole di validazione e non serve negoziare il comportamento con prodotto o backend

### 6) Uniformazione feedback error/loading dashboard
- **Dipendenza singola esplicita:** linee guida UI/UX approvate per loading e error state
- **Input minimi:** viste dashboard coinvolte; componenti condivisi disponibili o design reference approvato; elenco stati da coprire
- **Output verificabile:** pattern unico di loading/error in tutte le viste principali; verifica UI su desktop e mobile; screenshot o review checklist completata
- **Criterio di handoff to AI:** handoff possibile quando esiste un pattern UI unico da applicare, cosi l'AI esegue convergenza senza introdurre scelte visuali arbitrarie

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
