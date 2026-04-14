# Pipeline di import per Game / Evo Tactics Pack

Questo progetto importa i cataloghi del repository sorgente `Game` nel database Prisma/Postgres di `Game-Database`.

## Riferimenti operativi

- Runbook operativo: [`docs/operativo/RUNBOOK.md`](./operativo/RUNBOOK.md)
- Importer principale: [`server/scripts/ingest/import-taxonomy.js`](../server/scripts/ingest/import-taxonomy.js)
- Wrapper cross-platform: [`server/scripts/evo-import.js`](../server/scripts/evo-import.js)
- Config sorgenti: [`server/scripts/ingest/evo-import.config.json`](../server/scripts/ingest/evo-import.config.json)

## Sorgente ufficiale v1

Repository validato:

- `C:\Users\VGit\Documents\GitHub\Game`

Input usati dal runtime:

- `packs/evo_tactics_pack/docs/catalog/trait_glossary.json`
- `packs/evo_tactics_pack/docs/catalog/trait_reference.json`
- `packs/evo_tactics_pack/docs/catalog/env_traits.json`
- `packs/evo_tactics_pack/docs/catalog/catalog_data.json`
- `packs/evo_tactics_pack/docs/catalog/species/**/*.json`
- `packs/evo_tactics_pack/data/ecosystems/*.biome.yaml`
- `packs/evo_tactics_pack/data/ecosystems/*.ecosystem.yaml`

Fuori scope runtime:

- `archive`
- `incoming`
- `reports`
- dump decompressi o cartelle di lavorazione temporanea

## Script disponibili

| Script | Descrizione |
| --- | --- |
| `npm run dev:setup` | Genera Prisma Client, applica le migrazioni ed esegue il seed base. |
| `npm run evo:import -- --repo <path>` | Wrapper cross-platform che opzionalmente esegue `dev:setup` e poi l'importer taxonomy. |
| `node scripts/ingest/import-taxonomy.js ...` | Importer diretto per debugging e test mirati. |

## Esecuzione tipica

```powershell
Set-Location server
npm install
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game --dry-run
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game
```

Parametri utili:

- `--dry-run`: produce il report senza scrivere sul DB
- `--config <file>`: usa una configurazione sorgenti alternativa
- `--no-setup`: salta `npm run dev:setup`
- `--verbose`: stampa slug processati e motivi sintetici di scarto

## Output

L'importer produce un report JSON con:

- `totali_letti`
- `normalizzati`
- `aggiornati_o_upsertati`
- `importati_completi`
- `importati_parziali`
- `scartati`
- `errori`
- `dettaglio` per dominio (`traits`, `biomes`, `species`, `ecosystems`)

Questo report vale sia in `dry-run` sia in import reale.

## Note operative

- Il seed Prisma resta volutamente minimo e serve a bootstrap/test.
- Il popolamento reale dei cataloghi passa dall'import del repository `Game`.
- Il parser è tollerante verso shape eterogenee (`traits` come mappa, `biomi` in italiano, YAML `*.biome` / `*.ecosystem`).
- I record evento vengono esclusi dal dominio `species` per evitare rumore nella tassonomia principale.
- I meta-record aggregati non consultabili vengono scartati e, se gia presenti nel DB, rimossi durante l'import reale.
- Le descrizioni `i18n:` delle specie vengono convertite in riassunti diagnostici leggibili quando il sorgente non fornisce un testo narrativo.
