# Ripopolamento del database

Queste istruzioni descrivono come applicare le migrazioni Prisma e rilanciare il seed sia in locale sia negli ambienti basati su Docker/staging.

## Variabili d'ambiente richieste

| Nome | Descrizione |
| --- | --- |
| `DATABASE_URL` | Connessione PostgreSQL che Prisma utilizza (es. `postgresql://postgres:postgres@localhost:5432/game?schema=public`). |
| `PORT` | Porta esposta da Express. Facoltativa (default `3333`). |

> Copia `server/.env.example` in `server/.env` e compila le variabili con valori validi. In Docker puoi sovrascriverle tramite `environment:` nel `docker-compose.yml`.

## Ambiente locale (Node + npm)

1. Avvia PostgreSQL (ad es. `docker compose up -d db`).
2. Installa le dipendenze del backend:
   ```bash
   cd server
   npm install
   ```
3. Applica migrazioni e seed con il nuovo script combinato:
   ```bash
   npm run dev:setup
   ```
   Lo script esegue `prisma migrate deploy` e successivamente `prisma db seed` per popolare record demo e tassonomia. L'operazione è idempotente: puoi rilanciarla in sicurezza.
4. Avvia il backend:
   ```bash
   npm run dev
   ```

## Ambiente Docker / containerizzati

Il servizio `server` nel `docker-compose.yml` utilizza `server/scripts/docker-entrypoint.sh` per garantire che le migrazioni e il seed vengano eseguiti la prima volta che il container parte.

```bash
docker compose up -d db
# avvia e bootstrap del backend (porta 3333)
docker compose up server
```

Il bootstrap viene saltato se esiste il file marker specificato da `PRISMA_BOOTSTRAP_MARKER` (default `server/.docker-prisma-bootstrapped`). Per rieseguire il seed elimina il file oppure imposta `FORCE_NPM_INSTALL=1`/`SKIP_DB_BOOTSTRAP=1` secondo necessità:

```bash
# Rilanciare il seed dopo aver svuotato il DB
docker compose run --rm -e SKIP_DB_BOOTSTRAP=0 server npm run dev:setup
# Oppure, per forzare il bootstrap del servizio
rm -f server/.docker-prisma-bootstrapped
```

## Ambienti di staging

Negli ambienti remoti (staging/pre-prod) utilizza la stessa sequenza:

```bash
npm install --production=false
npm run dev:setup
```

Assicurati che `DATABASE_URL` punti al database di staging e che le credenziali abbiano i permessi per applicare le migrazioni. In pipeline CI/CD puoi riutilizzare il job `Verify Prisma seed` che esegue le stesse operazioni contro un Postgres effimero.

> Suggerimento: tieni `DATABASE_URL` e gli eventuali token/API key in un secret manager (GitHub Actions Secrets, Vault, ecc.) e impostali come variabili d'ambiente prima di eseguire `npm run dev:setup`.
