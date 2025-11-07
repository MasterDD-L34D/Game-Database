
# Game – Data Management Dashboard (Standalone Repo)

Repository pronto per l'uso che unisce:
- **Dashboard dati** (React + MUI + Tailwind + TanStack Table)
- **API** Express + Prisma (PostgreSQL)
- **Modelli taxonomy**: Trait, Biome, Species, Ecosystem
- **Import tool**: script per importare dati taxonomy (JSON/YAML/Markdown/CSV)
- **Autenticazione** a token + Audit (createdBy/updatedBy)

## Avvio rapido

### 0) Requisiti
- Node 18+
- Docker Desktop (Windows/macOS) oppure Docker Engine + Docker Compose plugin (Linux)
- In alternativa a Docker: un'istanza PostgreSQL 15 raggiungibile localmente

### 1) Database (Postgres in dev)
```bash
docker compose up -d
```

> **Nota:** l'ambiente di sviluppo è stato validato con Docker Desktop 4.x.
> Se non puoi usare Docker/Docker Desktop, segui la procedura "Senza Docker" più in basso.

### 2) Server API
```bash
cd server
cp .env.example .env  # compila DATABASE_URL, API_TOKEN (e opzionalmente PORT)
npm i
npx prisma generate
npx prisma migrate dev -n init
npm run prisma:seed   # opzionale: record demo + tassonomia base
node index.js         # http://localhost:3333
```

### 3) Dashboard
```bash
cd ../apps/dashboard
cp .env.local.example .env.local
npm i
npm run dev           # http://localhost:5174
```

> Copia `.env.local.example` in `.env.local` e aggiorna i valori necessari:
> - `VITE_API_BASE_URL` per puntare al server (default: `http://localhost:3333/api`).
> - `VITE_API_TOKEN` se usi endpoint protetti da token.
> - `VITE_API_USER` per indicare l'identità delle operazioni registrate.

### 4) Import taxonomy (opzionale)
```bash
cd ../server
node scripts/ingest/import-taxonomy.js --repo /percorso/al/tuo/repo --dry-run --verbose
node scripts/ingest/import-taxonomy.js --repo /percorso/al/tuo/repo --verbose
```

### Dati caricati dal seed Prisma

`npm run prisma:seed` popola il database con:

- 200 record di esempio per testare rapidamente la dashboard.
- Tassonomia minima condivisa (trait, biomi, specie ed ecosistemi) con slug coerenti e descrizioni climatiche realistiche.
- Valori associati (trait per specie, associazioni specie ↔ biomi ed ecosistemi ↔ biomi) utili alla UI per mostrare relazioni già pronte.

Lo script utilizza `upsert` per rendere l'operazione idempotente: puoi rilanciarlo in sicurezza per ripristinare l'ambiente di sviluppo.

### Senza Docker (Postgres installato manualmente)

1. Installa PostgreSQL 15 (o compatibile) e assicurati che il server sia in esecuzione.
2. Crea un database, ad esempio `game_db`, e un utente con privilegi completi:
   ```bash
   createuser --interactive --pwprompt game_admin
   createdb --owner=game_admin game_db
   ```
3. Aggiorna il file `server/.env` con una stringa di connessione valida, ad esempio:
   ```env
   DATABASE_URL="postgresql://game_admin:<password>@localhost:5432/game_db?schema=public"
   ```
4. Procedi con la sezione "Server API" più sopra (generate/migrate/seed). Se usi un'altra porta/host, sincronizza la variabile `VITE_API_BASE_URL` nel file `apps/dashboard/.env.local`.
5. Se desideri arrestare il server PostgreSQL, utilizza i comandi standard del sistema operativo (`pg_ctl`, `systemctl stop postgresql`, ecc.).

> Se intendi lavorare in team, documenta nel tuo `.env` le eventuali variazioni di porta o credenziali.

## Pubblicazione su un nuovo repo
```bash
git init
git add .
git commit -m "feat: initial standalone dashboard + api + taxonomy"
git branch -M main
git remote add origin <url-del-tuo-repo>
git push -u origin main
```

---

Per dettagli di design/architettura, consulta **docs/Documento_Riferimento.md**.
