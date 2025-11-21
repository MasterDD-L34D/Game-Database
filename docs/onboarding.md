# Onboarding rapido per Game – Data Management Dashboard

Questa guida sintetizza i passaggi di setup già presenti nel README, con il focus su Docker/PostgreSQL e sul bootstrap del database, per aiutarti a partire rapidamente in locale.

## Prerequisiti
- Windows 10/11 con [PowerShell 7+](https://learn.microsoft.com/powershell/scripting/install/installing-powershell)
- [Node.js 18+](https://nodejs.org/en/download)
- [Docker Desktop per Windows](https://www.docker.com/products/docker-desktop/) **oppure** un'istanza PostgreSQL 15 locale

## Avvio con Docker
1. **PostgreSQL**: dal root del repository avvia il database:
   ```powershell
   docker compose up -d
   ```
   L'ambiente è stato validato con Docker Desktop 4.x.

2. **Server API**:
   ```powershell
   Set-Location server
   Copy-Item .env.example .env    # compila DATABASE_URL (e facoltativamente PORT)
   npm install
   npm run dev:setup              # prisma generate + migrate deploy + seed
   npm run dev                    # http://localhost:3333
   ```
   - `npm run dev:setup` è idempotente: genera il client Prisma, applica le migrazioni e popola i dati demo.
   - Per creare nuove migrazioni continua a usare `npm run prisma:migrate`.
   - `TAXONOMY_WRITE_ROLES` (opzionale) elenca i ruoli autorizzati a modificare la tassonomia.
   - Per tracciare chi esegue le mutazioni, invia l'header `X-User` nelle chiamate API (opzionale).

3. **Dashboard**:
   ```powershell
   Set-Location ..\apps\dashboard
   Copy-Item .env.local.example .env.local
   npm install
   npm run dev                    # http://localhost:5174
   ```
   - Configura `VITE_API_BASE_URL` per puntare al server (default: `http://localhost:3333/api`).
   - `VITE_API_USER` è facoltativo per identificare le operazioni registrate.

## Ripopolamento/seed del database
Il comando `npm run prisma:seed` inserisce 200 record di esempio e la tassonomia minima (trait, biomi, specie, ecosistemi) con relazioni già pronte. È idempotente e può essere rilanciato per ripristinare l'ambiente.

Se devi ripetere migrazioni + seed in locale o nei container:
```powershell
cd server
npm run dev:setup
```

In Docker il servizio backend salta il bootstrap se esiste il marker `server/.docker-prisma-bootstrapped`. Eliminalo per forzare un nuovo seed oppure esegui:
```powershell
rm -f server/.docker-prisma-bootstrapped
npm run dev:setup
```

## Nuovi endpoint relazionali
Per usare `/api/species-biomes`, `/api/ecosystem-biomes` e `/api/ecosystem-species` assicurati di aver rieseguito le migrazioni e il seed:
```powershell
npm run prisma:migrate deploy
npm run prisma:seed   # oppure npm run dev:setup
```

## Setup senza Docker (PostgreSQL manuale)
1. Installa PostgreSQL 15 (o compatibile) e avvia il server.
2. Crea un utente e un database:
   ```powershell
   createuser --interactive --pwprompt game_admin
   createdb --owner=game_admin game_db
   ```
3. Aggiorna `server/.env` con una connessione valida, ad esempio:
   ```env
   DATABASE_URL="postgresql://game_admin:<password>@localhost:5432/game_db?schema=public"
   ```
4. Segui la sezione "Server API" sopra (generate/migrate/seed). Se usi host/porta diversi sincronizza `VITE_API_BASE_URL` in `apps/dashboard/.env.local`.
5. Per fermare PostgreSQL usa gli strumenti di sistema (es. Services.msc, `Stop-Service postgresql-x64-15`, oppure `pg_ctl stop`).

Documenta nel tuo `.env` eventuali variazioni di credenziali/porte per mantenerle condivise con il team.
