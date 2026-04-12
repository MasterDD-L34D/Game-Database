# Board operativa — 10 aprile 2026

## Governance operativa
- **Owner:** Solo Maintainer
- **Executor:** AI Agent
- **Decision policy:** human-in-the-loop solo per approvazioni di rilascio e scelte architetturali

## RACI semplificata
- **Decide:** Solo Maintainer
- **Esegue:** AI Agent (con supervisione)
- **Verifica finale:** Solo Maintainer

## Obiettivo di giornata
Completare **baseline docs + checklist qualità + piano settimana 1**.

## Checkpoint
- **13:00 UTC** — allineamento avanzamento su baseline e quality gates.
- **17:30 UTC** — review finale deliverable di giornata e piano Week 1.

## Esito revisione coerenza (Roadmap ↔ Quality Gates)
- Confermata coerenza tra priorità Week 1 e gate di merge su: evidenza test, uniformità gestione errori API/UI, allineamento i18n e aggiornamento documentazione.
- Nessuna discrepanza bloccante rilevata sui deliverable documentali prodotti oggi.

## Kanban (provvisoria)

### Todo
- [ ] **permessi API**  
  Owner: **Solo Maintainer** · Stima: **3h** · Criterio di completamento: **Test positivi/negativi sui ruoli critici in CI con output salvato**
- [ ] **UX error handling dashboard**  
  Owner: **Solo Maintainer** · Stima: **4h** · Criterio di completamento: **Pattern loading/error unificato nelle viste principali con evidenza review UI**

### Doing
- [ ] Nessuna attività in corso.

### Review
- [ ] Nessuna attività in review.

### Done
- [x] **baseline operativa**  
  Owner: **Solo Maintainer** · Stima: **2h** · Criterio di completamento: **Roadmap settimanale e milestone pubblicate in `docs/operativo/ROADMAP.md`**
- [x] **quality gates**  
  Owner: **Solo Maintainer** · Stima: **1h** · Criterio di completamento: **Checklist e blocchi di merge pubblicati in `docs/operativo/QUALITY_GATES.md`**
- [x] **runbook skeleton**  
  Owner: **Solo Maintainer** · Stima: **2h** · Criterio di completamento: **Struttura operativa iniziale pubblicata in `docs/operativo/RUNBOOK.md`**

## Registro decisioni (10 aprile 2026)
- **2026-04-10 13:10 UTC** — Decisione: applicare gate di merge obbligatori su test, i18n, error handling e documentazione. **Responsabile:** Solo Maintainer.
- **2026-04-10 15:40 UTC** — Decisione: priorità Week 1 focalizzata su standardizzazione errori API, validazioni input e test permessi. **Responsabile:** Solo Maintainer.
- **2026-04-10 17:20 UTC** — Decisione: chiudere in Done solo attività con output già versionato nel repository. **Responsabile:** Solo Maintainer.

## Capacità stimata (giornata)
Totale stime: **12h**.
