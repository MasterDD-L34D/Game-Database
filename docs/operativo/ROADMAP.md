# ROADMAP (6 settimane)

## Rituali operativi e decisioni

| Data | Decisione | Owner |
|---|---|---|
| 2026-04-10 | Pianificato meeting fisso di **Sprint Planning** settimanale da **45 minuti** (ogni lunedì, 09:30-10:15 CET). | Scrum Master |
| 2026-04-10 | Definita **Technical Review** da **30 minuti** dedicata alla verifica dei quality gates (ogni mercoledì, 16:00-16:30 CET). | Tech Lead |
| 2026-04-10 | Stabilita **Retrospective** con cadenza **quindicinale** e agenda fissa: 1) cosa tenere, 2) cosa cambiare, 3) prossima azione. | Agile Coach |
| 2026-04-10 | Confermato tracking decisioni operative in `docs/operativo/ROADMAP.md` con data e owner. | Project Manager |
| 2026-04-10 | Imposto vincolo di sprint scope: massimo **3 obiettivi misurabili** per sprint. | Product Owner |

## Convenzione branch

Utilizzare i seguenti prefissi per i branch:

- `feat/*` per nuove funzionalità
- `fix/*` per bugfix
- `chore/*` per manutenzione tecnica/non funzionale

## Milestone

### Settimana 1-2
- **server** (owner: Team Backend)
  - Stabilizzazione endpoint principali e revisione error handling (KPI: `5xx rate` < 1% su smoke test).
- **apps/dashboard** (owner: Team Frontend)
  - Allineamento pagine core con i dati reali e miglioramento stati di loading/error (KPI: 0 errori bloccanti su flusso CRUD base).
- **docs** (owner: Team Docs)
  - Baseline documentale su setup, flussi e convenzioni operative (KPI: 100% documenti chiave aggiornati nel branch sprint).

### Settimana 3-4
- **server** (owner: Team Backend)
  - Copertura test per servizi critici e hardening validazioni input (KPI: +15% test sui moduli critici).
- **apps/dashboard** (owner: Team Frontend)
  - Miglioramento UX dei flussi ad alta frequenza (filtri, ricerca, navigazione) (KPI: riduzione del 20% del tempo medio task in test interno).
- **docs** (owner: Team Docs)
  - Aggiornamento guide API/UX in base alle modifiche rilasciate (KPI: changelog sprint completo entro 24h dalla demo).

### Settimana 5-6
- **server** (owner: Team Backend)
  - Ottimizzazione performance query e monitoraggio errori di produzione (KPI: p95 endpoint principali < 300ms su dataset di riferimento).
- **apps/dashboard** (owner: Team Frontend)
  - Rifiniture UI, accessibilità di base e verifica regressioni principali (KPI: 0 regressioni critiche aperte a fine sprint).
- **docs** (owner: Team Docs)
  - Consolidamento runbook operativo e checklist pre-release (KPI: checklist pre-release completata al 100% prima del tag).

## Regola di pianificazione sprint (vincolante)

Ogni sprint deve includere **massimo 3 obiettivi**, ognuno definito con metrica verificabile (baseline + target + scadenza).
