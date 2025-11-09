
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
>
> Variabili d'ambiente utili:
> - `TAXONOMY_WRITE_ROLES` (opzionale) elenca i ruoli autorizzati a creare/modificare la tassonomia. Il default è `taxonomy:write,admin`. Per sovrascriverlo usa ad esempio `setx TAXONOMY_WRITE_ROLES "taxonomy:write,superuser"` prima di avviare il server.

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

### 4) Import taxonomy (opzionale)
```powershell
Set-Location ..\server
node scripts/ingest/import-taxonomy.js --repo C:\percorso\al\tuo\repo --dry-run --verbose
node scripts/ingest/import-taxonomy.js --repo C:\percorso\al\tuo\repo --verbose
```

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
