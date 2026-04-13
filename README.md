
# Game – Data Management Dashboard (Standalone Repo)

Repository pronto per l'uso che unisce:
- **Dashboard dati** (React + MUI + Tailwind + TanStack Table)
- **API** Express + Prisma (PostgreSQL)
- **Modelli taxonomy**: Trait, Biome, Species, Ecosystem
- **Import tool**: script per importare dati taxonomy (JSON/YAML/Markdown/CSV)
- **Audit** (createdBy/updatedBy) tracciato tramite header opzionale

## Avvio rapido

### 0) Requisiti
- **Windows 10/11** con [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) (le istruzioni riportano i comandi PowerShell)
- [Node.js 18+](https://nodejs.org/en/download)
- [Docker Desktop per Windows](https://www.docker.com/products/docker-desktop/)
- In alternativa a Docker Desktop: un'istanza PostgreSQL 15 raggiungibile localmente

### 1) Database (Postgres in dev)
```powershell
docker compose up -d
```

> **Nota:** l'ambiente di sviluppo è stato validato con Docker Desktop 4.x.
> Se non puoi usare Docker/Docker Desktop, segui la procedura "Senza Docker" più in basso.

### 2) Server API
```powershell
Set-Location server
Copy-Item .env.example .env    # compila DATABASE_URL (e opzionalmente PORT)
npm install
npm run dev:setup              # migrate deploy + seed (idempotente)
npm run dev                    # http://localhost:3333
```

> Lo script `npm run dev:setup` esegue `prisma generate`, applica le migrazioni con `prisma migrate deploy` e lancia `prisma db seed`.
> Per creare nuove migrazioni durante lo sviluppo continua a usare `npm run prisma:migrate`.
> Se importando `@prisma/client` ricevi l'errore "did not initialize yet", esegui `npm run prisma:generate` oppure rilancia `npm run dev:setup`.
>
> Variabili d'ambiente utili:
> - `TAXONOMY_WRITE_ROLES` (opzionale) elenca i ruoli autorizzati a creare/modificare la tassonomia. Il default è `taxonomy:write,admin`. Per sovrascriverlo usa ad esempio `setx TAXONOMY_WRITE_ROLES "taxonomy:write,superuser"` prima di avviare il server.
>
> Porte e indirizzamenti in sviluppo:
> - Il server espone le API su `http://localhost:3333` (anche se avvii `docker compose up server`, grazie al port mapping `3333:3333`).
> - Il database Postgres del `docker compose` ascolta su `localhost:5432` dall'host. Se invece il server gira **dentro** il container `server`, usa `db:5432` come host nel `DATABASE_URL` (vedi esempio nel `docker-compose.yml`).

#### Audit opzionale

- Se desideri tracciare chi esegue le mutazioni, invia l'header `X-User` con un identificativo (es. email).
- L'header viene propagato su `createdBy`/`updatedBy` e nei log di audit, ma non è obbligatorio.

### 3) Dashboard
```powershell
Set-Location ..\apps\dashboard
Copy-Item .env.local.example .env.local
npm install
npm run dev                    # http://localhost:5174
```

> Copia `.env.local.example` in `.env.local` e aggiorna i valori necessari:
> - `VITE_API_BASE_URL` per puntare al server (default: `http://localhost:3333/api`).
> - `VITE_API_USER` per indicare l'identità delle operazioni registrate (facoltativo).
>
> Prima di avviare la dashboard assicurati che il server API sia **già in esecuzione** e raggiungibile (es. `curl http://localhost:3333/api/biomes`). Se il backend gira su host/porta diversi:
> - imposta `VITE_API_BASE_URL` nel tuo `.env.local` verso l'endpoint corretto (incluso il suffisso `/api`), **oppure** aggiorna il proxy di sviluppo in `apps/dashboard/vite.config.ts` per puntare al nuovo host;
> - riavvia `npm run dev` del dashboard così da evitare il `NetworkError` causato da un proxy/API non raggiungibili.

### 3.1) Test rapidi
Backend:
```powershell
Set-Location server
npm test
npx prisma studio
```

> La suite backend viene eseguita file-per-file tramite `test/run-tests.ps1`, così i mock Prisma restano isolati e non si contaminano tra loro.

> Per consultare il database in modo visuale puoi usare anche `npm run prisma:studio`.

Frontend:
```powershell
Set-Location apps\dashboard
npm test -- --run src/features/records/components/__tests__/RecordTable.test.tsx src/features/records/pages/__tests__/RecordDetailsPage.test.tsx src/features/records/pages/__tests__/RecordEditPage.test.tsx src/features/taxonomies/pages/__tests__/TraitListPage.test.tsx src/features/taxonomies/pages/__tests__/TaxonomyCrudPages.test.tsx src/components/data-table/__tests__/DataTable.test.tsx
```

> I test frontend usano Vitest/Vite con `esbuild`: in ambienti con sandbox restrittivo potrebbero fallire con errori `spawn EPERM` anche se il codice è corretto.

> Smoke test E2E con Playwright:
> ```powershell
> Set-Location apps\dashboard
> npx playwright install
> npm run test:e2e
> ```
> I test E2E assumono backend e dashboard raggiungibili in locale (`http://localhost:3333` e `http://localhost:5174`). Se serve, puoi sovrascrivere la UI target con `PLAYWRIGHT_BASE_URL`.

### 3.2) Matrice di copertura

| Area | Backend/API | Frontend unit/integration | E2E live |
| --- | --- | --- | --- |
| Health/API root | ✅ `server/test/health.test.js` | n/a | verificato via `GET /api`, `GET /health`, `GET /api/health` |
| Records | ✅ `server/test/records.test.js` | ✅ `RecordTable`, `RecordDetailsPage`, `RecordEditPage` | ✅ smoke `/records` |
| Trait | ✅ `server/test/taxonomyRouters.test.js` | ✅ `TraitListPage.test.tsx` | ✅ CRUD live |
| Biome | ✅ `server/test/taxonomyRouters.test.js` | ✅ `TaxonomyCrudPages.test.tsx` | ✅ smoke + CRUD live |
| Species | ✅ `server/test/taxonomyRouters.test.js` | ✅ `TaxonomyCrudPages.test.tsx` | ✅ CRUD live |
| Ecosystem | ✅ `server/test/taxonomyRouters.test.js` | ✅ `TaxonomyCrudPages.test.tsx` | ✅ CRUD live |
| Species traits | ✅ `server/test/speciesTraits.test.js` | ⏳ non ancora coperto | ✅ CRUD live |
| Species biomes | ✅ `server/test/speciesBiomes.test.js` | ⏳ non ancora coperto | ✅ CRUD live |
| Ecosystem biomes | ✅ `server/test/ecosystemBiomes.test.js` | ⏳ non ancora coperto | ✅ CRUD live |
| Ecosystem species | ✅ `server/test/ecosystemSpecies.test.js` | ⏳ non ancora coperto | ✅ CRUD live |

Legenda:
- `✅` verificato
- `⏳` copertura ancora da estendere

### 3.3) CI

La repository include ora tre workflow GitHub Actions:

- `Verify Prisma seed`
  verifica generate + migrate + seed del backend su Postgres effimero
- `Backend and Frontend Tests`
  esegue `server/npm test` e la suite frontend mirata consolidata
- `Playwright E2E`
  avvia Postgres, bootstrap Prisma, backend, dashboard e lancia l'intera suite Playwright con artifact del report

Per rendere questi check obbligatori in PR devi ancora configurarli nelle branch protection rules del repository GitHub.

### 3.4) Modalità LAN

Per esporre dashboard e API su un solo URL accessibile da altri dispositivi della tua rete locale:

```powershell
Set-Location server
$env:APP_AUTH_USER="admin"
$env:APP_AUTH_PASSWORD="change-me"
$env:PORT="3333"
npm run start:lan
```

Effetto della modalità LAN:
- il backend builda il dashboard e serve UI + API sullo stesso server
- il server si espone su `0.0.0.0`
- l'accesso è protetto da Basic Auth
- le API restano sotto `/api`

Da un altro dispositivo della stessa rete puoi aprire:
- `http://IP-DELLA-MACCHINA:3333/`

Note:
- `GET /health` e `GET /api/health` restano disponibili per controllo stato
- questa fase copre accesso in **LAN**, non pubblicazione su Internet
- puoi personalizzare i ruoli dell'utente autenticato con `APP_AUTH_ROLES` (default: `taxonomy:write,admin`)

### 4) Import taxonomy (opzionale)
Consulta [docs/evo-import.md](docs/evo-import.md) per la pipeline completa.

```powershell
Set-Location ..\server
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game --dry-run
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game
```

Il seed Prisma resta volutamente minimo per bootstrap e test. Il popolamento reale della tassonomia passa dall'import del repository `Game`.

L'importer taxonomy ora espone anche indicatori di qualita nel report:
- `importati_completi`
- `importati_parziali`
- `scartati` con esempi sintetici di record esclusi

Limiti noti del dataset importato:
- alcune specie derivate dai cataloghi Evo non hanno descrizioni narrative complete; in quei casi viene generato un riassunto diagnostico leggibile
- i record evento restano esclusi dalla tassonomia principale
- i meta-record aggregati non consultabili vengono scartati dall'import

### Ripopolamento database

Vedi [docs/database-bootstrap.md](docs/database-bootstrap.md) per una guida dettagliata su come ripristinare le tabelle sia in locale sia negli ambienti Docker/staging.

#### Nuovi endpoint relazionali

Per utilizzare gli endpoint `/api/species-biomes`, `/api/ecosystem-biomes` e `/api/ecosystem-species` esegui nuovamente le migrazioni prima del seed:

1. `npm run prisma:migrate deploy`
2. `npm run prisma:seed` (oppure `npm run dev:setup` per generare client, applicare le migrazioni ed eseguire il seed in un solo passaggio)

Il seed aggiorna le relazioni specie↔biomi ed ecosistemi↔biomi, e ora crea anche associazioni ecosistemi↔specie con dati consistenti per testare subito i nuovi endpoint.

### Dati caricati dal seed Prisma

`npm run prisma:seed` popola il database con:

- 200 record di esempio per testare rapidamente la dashboard.
- Tassonomia minima condivisa (trait, biomi, specie ed ecosistemi) con slug coerenti e descrizioni climatiche realistiche.
- Valori associati (trait per specie, associazioni specie ↔ biomi ed ecosistemi ↔ biomi) utili alla UI per mostrare relazioni già pronte.

Lo script utilizza `upsert` per rendere l'operazione idempotente: puoi rilanciarlo in sicurezza per ripristinare l'ambiente di sviluppo.

### Senza Docker (Postgres installato manualmente)

1. Installa PostgreSQL 15 (o compatibile) e assicurati che il server sia in esecuzione.
2. Apri **SQL Shell (psql)** o una PowerShell con gli strumenti di PostgreSQL nella variabile d'ambiente `PATH`, quindi crea un database e un utente con privilegi completi:
   ```powershell
   createuser --interactive --pwprompt game_admin
   createdb --owner=game_admin game_db
   ```
3. Aggiorna il file `server/.env` con una stringa di connessione valida, ad esempio:
   ```env
   DATABASE_URL="postgresql://game_admin:<password>@localhost:5432/game_db?schema=public"
   ```
4. Procedi con la sezione "Server API" più sopra (generate/migrate/seed). Se usi un'altra porta/host, sincronizza la variabile `VITE_API_BASE_URL` nel file `apps/dashboard/.env.local`.
5. Se desideri arrestare il server PostgreSQL, utilizza gli strumenti Windows dedicati (es. **Services.msc**, `Stop-Service postgresql-x64-15`, oppure `pg_ctl stop`).

> Se intendi lavorare in team, documenta nel tuo `.env` le eventuali variazioni di porta o credenziali.

## Pubblicazione su un nuovo repo
```powershell
git init
git add .
git commit -m "feat: initial standalone dashboard + api + taxonomy"
git branch -M main
git remote add origin <url-del-tuo-repo>
git push -u origin main
```

---

Per dettagli di design/architettura, consulta **docs/Documento_Riferimento.md**.
