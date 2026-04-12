# Board operativa - 2026-04-10

## Resume context in 60 sec
- Giornata focalizzata su baseline operativa, quality gates e piano iniziale di esecuzione.
- Output gia consolidati in repo: roadmap, quality gates e runbook skeleton.
- Backlog ancora aperto su permessi API e uniformazione UX error handling dashboard.
- Questo board usa il formato standard per-card: `Next action`, `Blocker`, `Last verified at (UTC)`, `Artifacts/links`, `Done when`.

## Governance operativa
- **Owner:** Solo Maintainer
- **Executor:** AI Agent
- **Decision policy:** human-in-the-loop solo per approvazioni di rilascio e scelte architetturali

## RACI semplificata
- **Decide:** Solo Maintainer
- **Esegue:** AI Agent (con supervisione)
- **Verifica finale:** Solo Maintainer

## Obiettivo di giornata
Completare **baseline docs + checklist qualita + piano settimana 1**.

## Checkpoint
- **13:00 UTC** - allineamento avanzamento su baseline e quality gates.
- **17:30 UTC** - review finale deliverable di giornata e piano Week 1.

## Esito revisione coerenza (Roadmap <-> Quality Gates)
- Confermata coerenza tra priorita Week 1 e gate di merge su: evidenza test, uniformita gestione errori API/UI, allineamento i18n e aggiornamento documentazione.
- Nessuna discrepanza bloccante rilevata sui deliverable documentali prodotti oggi.

## Kanban

### Todo

#### Card: permessi API
- **Status:** Todo
- **Owner:** Solo Maintainer
- **Stima:** 3h
- **Next action (1 comando massimo):** `cd server && npm test -- permissions`
- **Blocker:** manca evidenza aggiornata dei casi positivi/negativi sui ruoli critici e relativo salvataggio output CI.
- **Last verified at (UTC):** 2026-04-12T21:48:29Z
- **Artifacts/links:** `docs/operativo/ROADMAP.md`; pipeline CI con test permessi; suite backend autorizzazioni.
- **Done when:** test positivi/negativi sui ruoli critici eseguiti in CI con output salvato e referenziabile dal board.

#### Card: UX error handling dashboard
- **Status:** Todo
- **Owner:** Solo Maintainer
- **Stima:** 4h
- **Next action (1 comando massimo):** `cd apps/dashboard && npm test`
- **Blocker:** non esiste ancora evidenza unica che confermi pattern loading/error coerente nelle viste principali.
- **Last verified at (UTC):** 2026-04-12T21:48:29Z
- **Artifacts/links:** review UI dashboard; linee guida quality gates; viste principali dashboard.
- **Done when:** pattern loading/error unificato nelle viste principali con evidenza di review UI o test di regressione equivalenti.

### Doing
- [ ] Nessuna attivita in corso.

### Review
- [ ] Nessuna attivita in review.

### Done

#### Card: baseline operativa
- **Status:** Done
- **Owner:** Solo Maintainer
- **Stima:** 2h
- **Next action (1 comando massimo):** `Get-Content docs/operativo/ROADMAP.md`
- **Blocker:** nessuno.
- **Last verified at (UTC):** 2026-04-12T21:48:29Z
- **Artifacts/links:** `docs/operativo/ROADMAP.md`
- **Done when:** roadmap settimanale e milestone pubblicate in `docs/operativo/ROADMAP.md`.

#### Card: quality gates
- **Status:** Done
- **Owner:** Solo Maintainer
- **Stima:** 1h
- **Next action (1 comando massimo):** `Get-Content docs/operativo/QUALITY_GATES.md`
- **Blocker:** nessuno.
- **Last verified at (UTC):** 2026-04-12T21:48:29Z
- **Artifacts/links:** `docs/operativo/QUALITY_GATES.md`
- **Done when:** checklist e blocchi di merge pubblicati in `docs/operativo/QUALITY_GATES.md`.

#### Card: runbook skeleton
- **Status:** Done
- **Owner:** Solo Maintainer
- **Stima:** 2h
- **Next action (1 comando massimo):** `Get-Content docs/operativo/RUNBOOK.md`
- **Blocker:** nessuno.
- **Last verified at (UTC):** 2026-04-12T21:48:29Z
- **Artifacts/links:** `docs/operativo/RUNBOOK.md`
- **Done when:** struttura operativa iniziale pubblicata in `docs/operativo/RUNBOOK.md`.

## Registro decisioni (2026-04-10)
- **2026-04-10 13:10 UTC** - Decisione: applicare gate di merge obbligatori su test, i18n, error handling e documentazione. **Responsabile:** Solo Maintainer.
- **2026-04-10 15:40 UTC** - Decisione: priorita Week 1 focalizzata su standardizzazione errori API, validazioni input e test permessi. **Responsabile:** Solo Maintainer.
- **2026-04-10 17:20 UTC** - Decisione: chiudere in Done solo attivita con output gia versionato nel repository. **Responsabile:** Solo Maintainer.

## Capacita stimata (giornata)
Totale stime: **12h**.
