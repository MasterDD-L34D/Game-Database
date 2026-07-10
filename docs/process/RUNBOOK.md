# Runbook operativo import Evo

Questo runbook descrive la procedura operativa per importare i cataloghi Evo dal repository `Game` nel database Game Database in modo ripetibile e verificabile.

> Documentazione tecnica di dettaglio: [`docs/process/evo-import.md`](./evo-import.md).

## 1) Bootstrap DB

### Obiettivo
Preparare un database locale/staging con schema aggiornato + seed base prima dell'import tassonomico.

### Procedura (locale)

```powershell
cd C:\dev\Game-Database\server
npm install
npm run dev:setup
```

`npm run dev:setup` esegue in sequenza:

1. generazione Prisma Client
2. applicazione migrazioni (`prisma migrate deploy`)
3. seed base (`prisma db seed`)

### Verifica rapida bootstrap

```powershell
cd C:\dev\Game-Database\server
npm run dev
# In un altro terminale:
Invoke-WebRequest http://localhost:3333/health
```

Se `/health` risponde, l'ambiente è pronto per l'import.

---

## 2) Reset / Seed

Usare questa sezione quando serve ripartire da DB pulito (test, QA, replay import).

### Reset completo + seed

```powershell
cd C:\dev\Game-Database\server
npx prisma migrate reset --force
```

Il comando resetta il database, riapplica le migrazioni ed esegue il seed.

### Seed senza reset

```powershell
cd C:\dev\Game-Database\server
npm run dev:setup
```

Utile quando il DB è già presente ma vuoi riallineare schema + dati iniziali in modo idempotente.

---

## 3) Ripristino ambiente locale

Usare in caso di ambiente “rotto” (dipendenze incoerenti, DB fuori sync, import falliti).

### Procedura consigliata

1. Arresta processi locali (`npm run dev`, compose, watcher).
2. Verifica variabili in `server/.env` (`DATABASE_URL`, `PORT`, eventuali ruoli).
3. Reinstalla dipendenze:

```powershell
cd C:\dev\Game-Database\server
Remove-Item node_modules -Recurse -Force
npm install
```

4. Riallinea DB:

```powershell
npm run dev:setup
```

5. Esegui dry-run import per validazione input:

```powershell
npm run evo:import -- --repo C:\dev\Game --dry-run
```

6. Esegui import reale:

```powershell
npm run evo:import -- --repo C:\dev\Game
```

---

## 4) Checklist pre-import

- [ ] `DATABASE_URL` punta al database corretto (dev/staging/prod).
- [ ] Backup disponibile o snapshot creato prima dell'import.
- [ ] `npm run dev:setup` eseguito senza errori.
- [ ] Repository sorgente `Game` aggiornato e coerente con il branch target.
- [ ] Config import verificata (`server/scripts/ingest/evo-import.config.json`).
- [ ] Dry-run completato e output coerente con le attese.
- [ ] Finestra operativa concordata (se ambiente condiviso).

## 5) Checklist post-import

- [ ] Nessun errore bloccante su stdout/stderr.
- [ ] Totali import coerenti con dry-run/previsioni.
- [ ] Verifica funzionale API/dashboard su entità importate.
- [ ] Report import salvato (vedi formato sotto).
- [ ] Eventuali scarti/errori classificati con ticket/azione correttiva.

---

## 6) Formato report import

Ogni esecuzione deve produrre un report strutturato con almeno questi campi:

```text
IMPORT REPORT
- data_ora_utc: 2026-04-10T14:30:00Z
- ambiente: local|staging|prod
- operatore: <nome o CI job>
- repo_sorgente: C:\dev\Game
- comando: npm run evo:import -- --repo ... [--dry-run]
- esito: OK|KO

CONTEGGI
- totali_letti: <n file/record sorgente>
- normalizzati: <n>
- completi: <n>
- parziali: <n>
- aggiornati_o_upsertati: <n>
- scartati: <n>
- errori: <n>

DETTAGLIO PER DOMINIO
- traits: letti=<n> normalizzati=<n> completi=<n> parziali=<n> aggiornati=<n> scartati=<n> errori=<n>
- biomes: letti=<n> normalizzati=<n> completi=<n> parziali=<n> aggiornati=<n> scartati=<n> errori=<n>
- species: letti=<n> normalizzati=<n> completi=<n> parziali=<n> aggiornati=<n> scartati=<n> errori=<n>
- ecosystems: letti=<n> normalizzati=<n> completi=<n> parziali=<n> aggiornati=<n> scartati=<n> errori=<n>
- motivi_scarto: mappa causa->conteggio

NOTE
- anomalie_rilevate: <testo libero>
- azioni_raccomandate: <testo libero>
```

### Definizioni operative

- **totali_letti**: record individuati nei file sorgente prima della normalizzazione.
- **normalizzati**: record convertiti con successo nel formato atteso dal database.
- **aggiornati_o_upsertati**: record effettivamente scritti via upsert.
- **scartati**: record non validi/non normalizzabili (es. senza chiave minima come nome/slug).
- **errori**: eccezioni runtime, errori parsing, errori DB.

---

## 7) Troubleshooting

### Errore: `P1001` / connessione DB fallita
**Sintomi:** Prisma non raggiunge Postgres.

**Azioni:**
1. verifica `DATABASE_URL`.
2. assicurati che il DB sia attivo (`docker compose up -d db` se usi Docker).
3. ritenta `npm run dev:setup`.

### Errore: `Cannot find module ...`
**Sintomi:** script import non parte per dipendenze mancanti.

**Azioni:**
1. `cd server`
2. `npm install`
3. rilancia import.

### Errore: `Unexpected token` / parse JSON/YAML/CSV
**Sintomi:** uno o più file sorgente hanno formato non valido.

**Azioni:**
1. identifica file dal log.
2. correggi sintassi nel repository sorgente Evo.
3. riesegui prima in `--dry-run`.

### Errore: import con conteggi anomali (troppo bassi)
**Sintomi:** output finale con pochi record importati.

**Azioni:**
1. verifica path `--repo`.
2. controlla glob in `server/scripts/ingest/evo-import.config.json`.
3. usa `--verbose` per vedere i record processati.

### Errore: vincoli relazionali incoerenti dopo import
**Sintomi:** relazioni specie-biomi/ecosistemi incomplete.

**Azioni:**
1. rilancia import completo senza `--no-setup`.
2. controlla slug sorgente (coerenza naming).
3. in caso di mismatch persistente, esegui reset + seed e reimport.

---

## 8) Log storico import

Ogni `npm run evo:import` riuscito appende una riga a
`server/logs/evo-import-history.log` (gitignored, per-macchina): timestamp UTC,
modo (`import`/`dry-run`/`validate-only`), hostname, argomenti. E' la fonte di
verita' per "quando e' stato aggiornato l'ultima volta il DB standing di questa
macchina": solo le righe `import ok` sono update reali (gli altri modi non
scrivono sul DB).

---

## 9) Servizio standing su Lenovo (porta 3333)

Il backend `Game` in produzione (Lenovo) interroga `http://localhost:3333/api/traits/glossary`
(default `GAME_DATABASE_URL`, attivo salvo `GAME_DATABASE_ENABLED=false`) e fa
fallback sui file locali se il servizio non risponde. Senza servizio attivo il
gioco funziona comunque, ma ogni boot logga `fetch failed`.

Stato rilevato 2026-07-10: sul Lenovo il repo esiste con `node_modules`, ma
mancano `server/.env`, il Postgres dedicato e il task di avvio -- lo stack non
e' mai stato provisionato. Procedura completa sotto. Pattern di riferimento:
task `EvoTacticsBackend` gia' attivo sulla stessa macchina (Postgres portable
`C:\dev\tools\pgsql` + datadir dedicato + task Boot/Logon con restart).

Tutti i comandi vanno eseguiti SUL Lenovo (regola cross-PC: azioni mutanti solo
dalla macchina che possiede il canonical).

### 9.1) Provisioning one-time

```powershell
# 1. Postgres portable dedicato, porta 5433 (il 5432 e' del backend Game)
& C:\dev\tools\pgsql\bin\initdb.exe -D C:\dev\tools\pgdata-gamedb -U postgres -E UTF8
New-Item -ItemType Directory C:\dev\tools\pgdata-gamedb\log
& C:\dev\tools\pgsql\bin\pg_ctl.exe -D C:\dev\tools\pgdata-gamedb -o "-p 5433" -l C:\dev\tools\pgdata-gamedb\log\pg-autostart.log start
& C:\dev\tools\pgsql\bin\createdb.exe -h localhost -p 5433 -U postgres game

# 2. Config server (.env NON va committato)
cd C:\dev\Game-Database\server
Copy-Item .env.example .env
# Edita .env: DATABASE_URL=postgresql://postgres@localhost:5433/game?schema=public
# (auth locale trust: il DB binda solo localhost).
# APP_AUTH_USER / APP_AUTH_PASSWORD: LASCIALI NON settati su questo servizio.
# La Basic Auth copre TUTTO /api/* (app.js la monta prima dei router) e il
# consumer Game NON manda credenziali (catalog.js: solo header Accept):
# con auth ON il glossary risponde 401 e Game resta per sempre in fallback,
# cioe' il servizio non serve a niente. Con auth OFF il server e' comunque
# read-only per gli anonimi (fail-closed CWE-290: niente ruoli = scritture
# negate, vedi middleware/user.js) -- esattamente cio' che serve qui.
# Abilita Basic Auth SOLO se/quando il fetch di Game imparera' a mandare
# credenziali (richiede modifica lato Game).

# 3. Schema + seed + primo import (repo Game aggiornato prima: git -C C:\dev\Game pull --ff-only)
npm install
npm run dev:setup
npm run evo:import -- --repo C:\dev\Game --dry-run   # verifica report
npm run evo:import -- --repo C:\dev\Game             # import reale (scrive anche il log storico)
```

### 9.2) Script di avvio

Crea `C:\Users\edusc\start-game-database.cmd` (stesso pattern di
`start-evo-backend.cmd`: prima il Postgres dedicato in modo idempotente, poi
l'API con log persistente). ATTENZIONE: il server NON ha un loader dotenv
(legge `process.env` diretto), quindi lo script DEVE sourcare `server/.env`
prima di lanciare `node index.js` -- senza, `/health` risponde ma ogni
endpoint Prisma (incluso `/api/traits/glossary` usato da Game) fallisce:

```cmd
@echo off
REM Avvio servizio Game-Database (API 3333). Idempotente: pg_ctl start e' un
REM no-op se il Postgres dedicato (datadir pgdata-gamedb, porta 5433) gira gia'.
REM set -a + source .env = esporta DATABASE_URL/PORT/APP_AUTH_* al processo node.
REM tr -d '\r' = .env salvato CRLF su Windows non deve iniettare \r nei valori.
REM Gate readiness: se il Postgres non e' pronto entro 90s lo script ESCE 1
REM senza lanciare node (il server non connette Prisma allo startup, quindi
REM /health resterebbe verde con i dati rotti); l'exit non-zero fa scattare
REM il RestartOnFailure del task (retry ogni minuto).
"C:\Program Files\Git\bin\bash.exe" -lc "(/c/dev/tools/pgsql/bin/pg_ctl.exe -D /c/dev/tools/pgdata-gamedb -o '-p 5433' -l /c/dev/tools/pgdata-gamedb/log/pg-autostart.log start >/dev/null 2>&1 || true); ok=0; for i in $(seq 1 90); do /c/dev/tools/pgsql/bin/pg_isready.exe -h localhost -p 5433 -q && ok=1 && break; sleep 1; done; [ $ok -eq 1 ] || { echo $(date -u -Iseconds) pgdata-gamedb non pronto dopo 90s, abort >> /c/Users/edusc/game-database.log; exit 1; }; cd /c/dev/Game-Database/server && set -a && source <(tr -d '\r' < ./.env) && set +a && node index.js >> /c/Users/edusc/game-database.log 2>&1"
```

### 9.3) Task di avvio (Boot + Logon, restart automatico)

Salva come `C:\Users\edusc\game-database-server.xml` (mirror del task
`EvoTacticsBackend`):

```xml
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <URI>\GameDatabaseServer</URI>
  </RegistrationInfo>
  <Principals>
    <Principal id="Author">
      <UserId>CODEMASTERDD\edusc</UserId>
      <LogonType>InteractiveToken</LogonType>
    </Principal>
  </Principals>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <RestartOnFailure>
      <Count>999</Count>
      <Interval>PT1M</Interval>
    </RestartOnFailure>
    <UseUnifiedSchedulingEngine>true</UseUnifiedSchedulingEngine>
  </Settings>
  <Triggers>
    <LogonTrigger>
      <UserId>CODEMASTERDD\edusc</UserId>
    </LogonTrigger>
    <BootTrigger />
  </Triggers>
  <Actions Context="Author">
    <Exec>
      <Command>C:\Users\edusc\start-game-database.cmd</Command>
    </Exec>
  </Actions>
</Task>
```

Registrazione + avvio:

```powershell
schtasks /create /tn GameDatabaseServer /xml C:\Users\edusc\game-database-server.xml
schtasks /run /tn GameDatabaseServer
```

Nota restart: come per `EvoTacticsBackend`, "riavviare" il servizio = Stop +
Start del task (uno Start da solo e' no-op se il task risulta gia' running).

### 9.4) Verifica

```powershell
# Sul Lenovo
Invoke-WebRequest http://localhost:3333/health
# Da un'altra macchina della LAN (es. Ryzen)
Invoke-WebRequest http://192.168.1.10:3333/api/traits/glossary
```

Poi riavvia il backend Game (task `EvoTacticsBackend`, Stop + Start) e verifica
che nel log di boot NON compaia piu' il `fetch failed` del glossario.

---

## 10) Riferimenti rapidi

- Guida import: [`docs/process/evo-import.md`](./evo-import.md)
- Config ingest: [`server/scripts/ingest/evo-import.config.json`](../../server/scripts/ingest/evo-import.config.json)
- Script ingest: [`server/scripts/ingest/import-taxonomy.js`](../../server/scripts/ingest/import-taxonomy.js)
- Smoke CI: [`.github/workflows/evo-import-smoke.yml`](../../.github/workflows/evo-import-smoke.yml)
