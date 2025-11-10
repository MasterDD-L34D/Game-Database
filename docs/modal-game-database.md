# Game – Data Management Dashboard
- **Repository**: https://github.com/pvdvreede/Game-Database
- **Tecnologie principali**: PostgreSQL 15, Prisma ORM, Express API, React Dashboard (Vite + MUI + Tailwind)

## Obiettivo e dominio
- **Descrizione sintetica**: Dashboard e API per gestire schede di ricerca artistiche e tassonomia ecologica (trait, biomi, specie, ecosistemi), con audit e strumenti di import da repository esterni.
- **Entità chiave**:
  - `Record`: schede descrittive con metadati stilistici e audit.
  - `Trait`: definizioni di caratteristiche quantitative/qualitative con range e valori ammessi.
  - `Biome`: tassonomia di biomi gerarchici con descrizioni climatiche.
  - `Species`: specie tassonomiche con nomenclatura scientifica e relazioni con trait/biomi/ecosistemi.
  - `Ecosystem`: ecosistemi con biomi collegati e ruoli ecologici delle specie.
  - Tabelle ponte per relazioni (`SpeciesTrait`, `SpeciesBiome`, `EcosystemBiome`, `EcosystemSpecies`).

## Schema
| Entità | Campi principali | Relazioni |
| ------ | ---------------- | --------- |
| `Record` | `id`, `nome`, `stato`, metadati (stile, pattern, peso, curvatura), audit `createdBy/updatedBy`, timestamp | Nessuna relazione diretta; tabelle indicizzate per ricerca rapida |
| `AuditLog` | `entity`, `entityId`, `action`, `user`, `payload`, `createdAt` | Log di mutazioni su tutte le entità applicative |
| `Trait` | `slug`, `name`, `dataType`, `allowedValues`, `rangeMin/Max`, `unit` | Relazione 1:N con `SpeciesTrait` |
| `Biome` | `slug`, `name`, `description`, `climate`, `parentId` | Relazioni gerarchiche (parent/children), bridge con `SpeciesBiome` e `EcosystemBiome` |
| `Species` | `slug`, `scientificName`, tassonomia completa, `status`, `description` | Bridge con `SpeciesTrait`, `SpeciesBiome`, `EcosystemSpecies` |
| `SpeciesTrait` | `value` JSON, campi normalizzati (`num`, `bool`, `text`, `category`, `unit`, `confidence`) | Molti-a-uno verso `Species` e `Trait` |
| `SpeciesBiome` | `presence`, `abundance`, `notes` | Molti-a-uno verso `Species` e `Biome` |
| `Ecosystem` | `slug`, `name`, `description`, `region`, `climate` | Bridge con `EcosystemBiome` e `EcosystemSpecies` |
| `EcosystemBiome` | `proportion`, `notes` | Molti-a-uno verso `Ecosystem` e `Biome` |
| `EcosystemSpecies` | `role`, `abundance`, `notes` | Molti-a-uno verso `Ecosystem` e `Species` |

## Processi di popolamento
- **Seed o migrazioni**: `npm run dev:setup` esegue `prisma generate`, `prisma migrate deploy` e `prisma db seed`. Il seed crea 200 record demo e una tassonomia coerente; è idempotente.
- **Strumenti di import**: `server/scripts/ingest/import-taxonomy.js` importa trait/biomi/specie/ecosistemi da file JSON/YAML/Markdown/CSV in un repository locale. Flag principali: `--repo`, `--dry-run`, `--verbose`.

## Sicurezza e audit
- **Tracciamento utenti**: header opzionale `X-User`; propagato su `createdBy/updatedBy` e `AuditLog.user`.
- **Permessi/ruoli**: variabile `TAXONOMY_WRITE_ROLES` (default `taxonomy:write,admin`) delimita chi può modificare la tassonomia.

## Note operative
- **Prerequisiti**: Node.js 18+, npm, Docker Desktop (o PostgreSQL 15 locale), PowerShell 7+ su Windows.
- **Comandi utili**: `docker compose up -d` per Postgres, `npm run dev` (backend), `npm run dev` in `apps/dashboard` (frontend), `npm run prisma:migrate`, `npm run prisma:seed`.
- **Variabili d'ambiente**: `DATABASE_URL`, `PORT` (opzionale), `TAXONOMY_WRITE_ROLES`, `VITE_API_BASE_URL`, `VITE_API_USER`.

## Questioni aperte / TODO
- Documentare eventuali ruoli custom oltre al default.
- Aggiornare il riferimento repository se viene pubblicato sotto un'organizzazione differente.
