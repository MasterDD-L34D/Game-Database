# Runbook operativo import Evo

Questo runbook descrive la procedura operativa per importare i cataloghi Evo dal repository `Game` nel database Game Database in modo ripetibile e verificabile.

> Documentazione tecnica di dettaglio: [`docs/evo-import.md`](../evo-import.md).

## 1) Bootstrap DB

### Obiettivo
Preparare un database locale/staging con schema aggiornato + seed base prima dell'import tassonomico.

### Procedura (locale)

```powershell
cd C:\Users\VGit\Documents\GitHub\Game-Database\server
npm install
npm run dev:setup
```

`npm run dev:setup` esegue in sequenza:

1. generazione Prisma Client
2. applicazione migrazioni (`prisma migrate deploy`)
3. seed base (`prisma db seed`)

### Verifica rapida bootstrap

```powershell
cd C:\Users\VGit\Documents\GitHub\Game-Database\server
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
cd C:\Users\VGit\Documents\GitHub\Game-Database\server
npx prisma migrate reset --force
```

Il comando resetta il database, riapplica le migrazioni ed esegue il seed.

### Seed senza reset

```powershell
cd C:\Users\VGit\Documents\GitHub\Game-Database\server
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
cd C:\Users\VGit\Documents\GitHub\Game-Database\server
Remove-Item node_modules -Recurse -Force
npm install
```

4. Riallinea DB:

```powershell
npm run dev:setup
```

5. Esegui dry-run import per validazione input:

```powershell
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game --dry-run
```

6. Esegui import reale:

```powershell
npm run evo:import -- --repo C:\Users\VGit\Documents\GitHub\Game
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
- repo_sorgente: C:\Users\VGit\Documents\GitHub\Game
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

## 8) Riferimenti rapidi

- Guida import: [`docs/evo-import.md`](../evo-import.md)
- Config ingest: [`server/scripts/ingest/evo-import.config.json`](../../server/scripts/ingest/evo-import.config.json)
- Script ingest: [`server/scripts/ingest/import-taxonomy.js`](../../server/scripts/ingest/import-taxonomy.js)
