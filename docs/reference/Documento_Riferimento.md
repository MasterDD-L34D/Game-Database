
# Game – Data Management Dashboard • Documento di Riferimento (v1)

**Frontend:** React + TypeScript + Tailwind + MUI + TanStack Table  
**Backend:** Express + Prisma + PostgreSQL  
**Dati:** Record + (Trait, Biome, Species, Ecosystem)  
**Feature chiave:** Filtri, top bar contestuale, resize/pin colonne, export server streaming, audit, import taxonomy.

Per setup e flussi vedi README alla radice.

## Localizzazione UI

L'interfaccia del dashboard utilizza [i18next](https://www.i18next.com/) tramite `react-i18next` con risorse definite in `apps/dashboard/src/i18n/locales/it/`. Le stringhe sono suddivise per namespace (es. `records`, `dashboard`, `taxonomy`) per mantenere i moduli indipendenti.

Per aggiungere una nuova stringa:

1. Individua il namespace del modulo (o creane uno nuovo se necessario) e aggiungi la chiave nel relativo JSON.
2. Se serve un namespace nuovo, registralo in `apps/dashboard/src/i18n/index.ts` aggiornando import, `resources` e l'elenco `ns`.
3. Nel componente usa `useTranslation('<namespace>')` e sostituisci il testo hardcoded con `t('chiave')`. Per stringhe riutilizzabili prevedi parametri (`{{placeholder}}`).
4. Ricordati di importare `./i18n` nei test (già fatto in `setupTests.ts`) e, se aggiorni snapshot, rigenerali dopo aver popolato le nuove traduzioni.

I test e gli snapshot devono usare i testi tradotti, quindi evita di inserire stringhe raw nei componenti.

## Gestione CRUD nelle pagine elenco

- Il componente `ListPage` supporta ora `createConfig`, `editConfig` e `deleteConfig` per gestire i dialog di creazione/modifica/eliminazione. Ogni configurazione accetta un array `fields` (nome, etichetta, `required`, `type: 'textarea' | 'text' | 'number'`) e le rispettive `mutation` asincrone che devono usare gli helper `postJSON`/`deleteJSON`.
- Le azioni di riga sono esposte tramite il menù contestuale (`RowActionsMenu`) che appare automaticamente quando si passa almeno una configurazione CRUD; al termine di ogni operazione la lista viene aggiornata con un `refetch` automatico.
- Gli esiti sono notificati tramite `SnackbarProvider`: personalizza `successMessage`/`errorMessage` nelle configurazioni se vuoi messaggi specifici, altrimenti verranno usate le stringhe di fallback in `common.feedback`.
- Per i moduli taxonomy (`traits`, `biomes`, `species`, `ecosystems`) sono stati introdotti dialog preconfigurati con relative traduzioni in `taxonomy.json` e test di integrazione (`ListPageCrud.test.tsx`) che verificano il flusso completo.

## Tema UI e palette condivisa

- Il tema MUI vive in `apps/dashboard/src/theme/index.ts` ed estende `Theme` con i namespace `layout`, `gradients` e `customShadows`. Usa `theme.layout.cardPadding` e `theme.customShadows.card` quando serve replicare il padding/pattern delle card nelle nuove viste (`sx={(theme) => ({ padding: theme.layout.cardPadding })}`).
- La palette principale è stata allineata a Tailwind: `primary` (blu 600) per le call-to-action, `secondary` (emerald 500) per gli accenti, `info/success/warning/error` coerenti con le tonalità delle notifiche. Lo sfondo base è `surface[50]`/`theme.palette.background.default`.
- Tailwind (`apps/dashboard/tailwind.config.js`) esporta le stesse tonalità e la tipografia del tema: classi come `bg-gradient-primary`, `shadow-card`, `text-neutral-600`, `px-card` assicurano coerenza anche nei componenti non-MUI.
- Per componenti dimostrativi/QA avvia `npm run dev` in `apps/dashboard`: la dashboard mostra le nuove card di sintesi e le viste `Records`/`Create` aggiornate con spacing e gradienti del tema.

## Documento operativo – blocchi richiesti (template PM)
Blocchi compilati secondo la struttura condivisa dal PM e allineati ai file/referenze interni del progetto.

- **Identità / Versioning**
  - Repository e stack: panoramica già presente in apertura di file; versionamento dello schema affidato alle migrazioni Prisma eseguite da `npm run dev:setup`. 【F:docs/reference/Documento_Riferimento.md†L2-L9】【F:server/package.json†L8-L27】
  - Stato di bootstrap e seed: comando `npm run dev:setup` (Prisma generate + migrate deploy + seed). 【F:README.md†L27-L37】【F:server/package.json†L17-L27】

- **Classificazione / Ruolo**
  - Ruoli applicativi e permessi di scrittura tassonomia definiti da `TAXONOMY_WRITE_ROLES`; audit opzionale tramite header `X-User`. 【F:README.md†L39-L49】
  - Entità e dominio: panoramica in `docs/reference/modal-game-database.md`; schema completo (campi, tipi, modifiers, indici, relazioni) auto-generato in `docs/schema-reference.md`. 【F:docs/reference/modal-game-database.md†L1-L14】【F:docs/schema-reference.md†L1-L40】

- **Relazioni / Sinergie**
  - Relazioni tra entità modellate in Prisma (Species↔Trait/biomi/ecosistemi, Ecosystem↔Biome/Species) con indici/unici per consistenza. 【F:server/prisma/schema.prisma†L136-L251】
  - Pipeline di import che preserva sinergie tra collezioni (upsert specie/trait/biomi/ecosistemi e legami ponte). 【F:server/scripts/ingest/import-taxonomy.js†L1-L150】

- **Ambiente / Contesto**
  - Prerequisiti runtime e setup locale/Docker descritti nella scheda (Node 18+, PostgreSQL 16/Docker, Vite dashboard). 【F:docs/reference/Documento_Riferimento.md†L2-L9】【F:docs/process/onboarding.md†L1-L66】
  - Variabili d'ambiente principali: `DATABASE_URL`, `PORT`, `VITE_API_BASE_URL`, `VITE_API_USER`. 【F:README.md†L27-L63】

- **Bilanciamento / Costi**
  - Import idempotente (`--dry-run`, slug univoci, upsert) per evitare duplicati e ridurre costi operativi di bonifica. 【F:docs/process/evo-import.md†L1-L40】【F:server/scripts/ingest/import-taxonomy.js†L1-L80】
  - Campi di range/allowed values nei Trait per controllare domini numerici e categoriali (limita errori e rework). 【F:server/prisma/schema.prisma†L119-L152】

- **Localizzazione / Testi**
  - Gestione i18n centralizzata in `apps/dashboard/src/i18n/index.ts` con namespace `common`, `records`, `taxonomy` ecc. 【F:apps/dashboard/src/i18n/index.ts†L1-L49】
  - Stringhe italiane organizzate per modulo in `apps/dashboard/src/i18n/locales/it/*.json`; i componenti usano `useTranslation`. 【F:apps/dashboard/src/i18n/index.ts†L5-L35】

### Reference rapide
- **Glossario / schede dettagliate**: `docs/reference/trait-scheda.md` per i campi trait e relativi vincoli. 【F:docs/reference/trait-scheda.md†L1-L104】
- **Fonti editoriali / pipeline**: `docs/process/evo-import.md` e `server/scripts/ingest/import-taxonomy.js` per origini dati e normalizzazione. 【F:docs/process/evo-import.md†L1-L40】【F:server/scripts/ingest/import-taxonomy.js†L1-L80】
- **Tassonomie**: schema Prisma per Trait/Biome/Species/Ecosystem e relazioni ponte. 【F:server/prisma/schema.prisma†L119-L251】
- **Modelli estesi**: dominio in `docs/reference/modal-game-database.md` (descrizione + entità + processi + sicurezza + runtime); schema completo (auto-generato da `schema.prisma`) in `docs/schema-reference.md`. 【F:docs/reference/modal-game-database.md†L1-L40】【F:docs/schema-reference.md†L1-L40】
