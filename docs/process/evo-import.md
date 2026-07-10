# Pipeline di import per Game / Evo Tactics Pack

Questo progetto importa i cataloghi del repository sorgente `Game` nel database Prisma/Postgres di `Game-Database`.

## Riferimenti operativi

- Runbook operativo: [`docs/process/RUNBOOK.md`](./RUNBOOK.md)
- Importer principale: [`server/scripts/ingest/import-taxonomy.js`](../../server/scripts/ingest/import-taxonomy.js)
- Wrapper cross-platform: [`server/scripts/evo-import.js`](../../server/scripts/evo-import.js)
- Config sorgenti: [`server/scripts/ingest/evo-import.config.json`](../../server/scripts/ingest/evo-import.config.json)

## Sorgente ufficiale v1

Repository validato (checkout locale del repo `Game`; path per macchina):

- Ryzen: `C:\dev\Game`
- Lenovo: `C:\dev\Game`

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
npm run evo:import -- --repo C:\dev\Game --dry-run
npm run evo:import -- --repo C:\dev\Game
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
- `completi`
- `parziali`
- `aggiornati_o_upsertati`
- `scartati`
- `errori`
- `dettaglio` per dominio (`traits`, `biomes`, `species`, `ecosystems`)

Nel dettaglio per dominio sono inclusi anche:

- `completi` / `parziali`
- `motivi_scarto` con conteggio per causa
- `esempi_scarti` (sample sintetico)

Questo report vale sia in `dry-run` sia in import reale.

## Log storico degli import

Ogni esecuzione di `npm run evo:import` andata a buon fine appende una riga a
`server/logs/evo-import-history.log` (gitignored, per-macchina):

```text
2026-07-10T09:15:00.000Z import ok host=CodeMasterDD args=--repo C:\dev\Game
```

Il log risponde alla domanda "quando e' stato aggiornato l'ultima volta il DB
standing di QUESTA macchina". Le esecuzioni `--dry-run` sono marcate `dry-run`
e non contano come aggiornamento del DB.

## CI: smoke test, NON sync

Il workflow `.github/workflows/evo-import-smoke.yml` (fino a 2026-07 si
chiamava `evo-import-sync.yml`) esegue l'intera pipeline di import contro un
Postgres usa-e-getta nel job runner, ogni 6 ore. Verde = "l'importer funziona
ancora contro il catalogo Game di oggi". NON aggiorna nessun database standing
e non puo' aprire PR di sync: l'import scrive solo sul DB, mai sul checkout.
L'aggiornamento del DB standing e' SOLO manuale (procedura sopra + runbook
[`docs/process/RUNBOOK.md`](./RUNBOOK.md), sezione servizio Lenovo).

## Note operative

- Il seed Prisma resta volutamente minimo e serve a bootstrap/test.
- Il popolamento reale dei cataloghi passa dall'import del repository `Game`.
- Il parser è tollerante verso shape eterogenee (`traits` come mappa, `biomi` in italiano, YAML `*.biome` / `*.ecosystem`).
- Per le `species` con descrizione `i18n:*`, l'import genera una descrizione consultativa dai metadati disponibili (`role_trofico`, biomi, tag funzionali, hazard, playable flag).
- Lo `status` specie può essere derivato da `balance.threat_tier`/`balance.rarity` quando il campo nativo non è presente.
- I record evento vengono esclusi dal dominio `species` per evitare rumore nella tassonomia principale.
