# Board operativa - YYYY-MM-DD

## Naming convention
- Nome file obbligatorio: `BOARD_GIORNATA_YYYY-MM-DD.md`
- Un file per giorno operativo.
- La data nel filename deve coincidere con la data riportata nel titolo e nel registro decisioni.
- Nuovi board: creare copiando questo template e sostituendo tutti i placeholder `YYYY-MM-DD`.

## Resume context in 60 sec
- Obiettivo del giorno in 3-4 bullet.
- Stato ereditato dal board precedente.
- Decisioni o rischi da tenere in testa prima di eseguire il primo comando.
- Vincoli operativi o dipendenze esterne attive.

## Governance operativa
- **Owner:** 
- **Executor:** 
- **Decision policy:** 

## RACI semplificata
- **Decide:** 
- **Esegue:** 
- **Verifica finale:** 

## Obiettivo di giornata
Descrivi il risultato concreto da chiudere entro fine giornata.

## Checkpoint
- **13:00 UTC** - checkpoint intermedio.
- **17:30 UTC** - checkpoint finale.

## Kanban

### Todo

#### Card: <titolo>
- **Status:** Todo
- **Owner:** 
- **Stima:** 
- **Next action (1 comando massimo):** `<comando unico>`
- **Blocker:** nessuno | descrizione blocco
- **Last verified at (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Artifacts/links:** `<file, PR, issue, log, dashboard, runbook>`
- **Done when:** descrizione osservabile e verificabile del completamento

### Doing

#### Card: <titolo>
- **Status:** Doing
- **Owner:** 
- **Stima:** 
- **Next action (1 comando massimo):** `<comando unico>`
- **Blocker:** nessuno | descrizione blocco
- **Last verified at (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Artifacts/links:** `<file, PR, issue, log, dashboard, runbook>`
- **Done when:** descrizione osservabile e verificabile del completamento

### Review

#### Card: <titolo>
- **Status:** Review
- **Owner:** 
- **Stima:** 
- **Next action (1 comando massimo):** `<comando unico>`
- **Blocker:** nessuno | descrizione blocco
- **Last verified at (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Artifacts/links:** `<file, PR, issue, log, dashboard, runbook>`
- **Done when:** descrizione osservabile e verificabile del completamento

### Done

#### Card: <titolo>
- **Status:** Done
- **Owner:** 
- **Stima:** 
- **Next action (1 comando massimo):** `<comando di verifica o lettura evidenza>`
- **Blocker:** nessuno
- **Last verified at (UTC):** YYYY-MM-DDTHH:MM:SSZ
- **Artifacts/links:** `<file, PR, issue, log, dashboard, runbook>`
- **Done when:** descrizione osservabile e verificabile del completamento

## Registro decisioni (YYYY-MM-DD)
- **YYYY-MM-DD HH:MM UTC** - Decisione: <testo>. **Responsabile:** <nome>.

## Capacita stimata (giornata)
Totale stime: **0h**.
