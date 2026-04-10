# Pipeline di import per Evo Tactics Pack

Questo progetto può importare i cataloghi del repository **Evo Tactics Pack MongoDB** direttamente nel database Prisma/Postgres grazie a una pipeline completamente scriptata.

## Riferimenti operativi

- Runbook operativo completo: [`docs/operativo/RUNBOOK.md`](./operativo/RUNBOOK.md)
- Script ingest principale: [`server/scripts/ingest/import-taxonomy.js`](../server/scripts/ingest/import-taxonomy.js)
- Configurazione glob: [`server/scripts/ingest/evo-import.config.json`](../server/scripts/ingest/evo-import.config.json)

## Prerequisiti

- repository Evo clonato localmente (es. `/workspace/Game`)
- variabile `DATABASE_URL` configurata verso l'istanza Postgres del progetto
- dipendenze installate (`npm install` nella cartella `server/`)

## Script disponibili

| Script | Descrizione |
| --- | --- |
| `npm run dev:setup` | Genera il client Prisma, applica le migrazioni e rilancia il seed di base. |
| `npm run evo:import -- --repo <path>` | Orchestratore completo: esegue `dev:setup` (salvo `--no-setup`) e poi l'importer `import-taxonomy.js`. |
| `server/scripts/ingest/import-taxonomy.js` | Importatore generico (trait, biomi, specie, ecosistemi) con supporto JSON/YAML/MD/CSV. |

## Configurazione glob

Il file `server/scripts/ingest/evo-import.config.json` contiene i percorsi ai cataloghi generati dal repository Evo (biomi, specie, tratti, ecosistemi). Modificalo se i file sorgente vengono spostati o rinominati.

## Esecuzione tipica

```bash
cd server
npm install
npm run evo:import -- --repo /percorso/al/repo/EvoTactics
```

Parametri utili:

- `--dry-run`: esegue il parsing e mostra i conteggi senza scrivere sul database.
- `--config <file>`: usa un file config alternativo.
- `--no-setup`: salta `npm run dev:setup` se il database è già aggiornato.
- `--verbose`: stampa a log i singoli slug processati.

## Output e report

Output standard script:

```text
Import completato: { traits: <n>, biomes: <n>, species: <n>, ecosystems: <n> }
```

Per governance operativa usare il formato report definito nel runbook (`RUNBOOK.md`, sezione **Formato report import**) includendo sempre:

- totali letti
- aggiornati/upsertati
- scartati
- errori

## Estensioni

- Per aggiungere nuove collezioni (es. `sessions`, `activity_logs`) seguire il pattern delle funzioni `upsert*` dentro `import-taxonomy.js`.
- Il normalizzatore supporta i campi specifici del pacchetto Evo (`label`, `network_id`, `display_name`, `environment_affinity`, ecc.) e crea automaticamente gli upsert delle relazioni.
