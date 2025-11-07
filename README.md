
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
- Docker (per PostgreSQL)

### 1) Database (Postgres in dev)
```bash
docker compose up -d
```

### 2) Server API
```bash
cd server
cp .env.example .env  # compila DATABASE_URL, API_TOKEN (e opzionalmente PORT)
npm i
npx prisma generate
npx prisma migrate dev -n init
npm run prisma:seed   # opzionale: 200 record demo
node index.js         # http://localhost:3333
```

### 3) Dashboard
```bash
cd ../apps/dashboard
cp .env.local.example .env.local
npm i
npm run dev           # http://localhost:5174
```

> In `.env.local` imposta `VITE_API_BASE_URL` al server (default: `http://localhost:3333/api`) e `VITE_API_TOKEN` se usi il token.

### 4) Import taxonomy (opzionale)
```bash
cd ../server
node scripts/ingest/import-taxonomy.js --repo /percorso/al/tuo/repo --dry-run --verbose
node scripts/ingest/import-taxonomy.js --repo /percorso/al/tuo/repo --verbose
```

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
