
# Game – Data Management Dashboard • Documento di Riferimento (v1)

**Frontend:** React + TypeScript + Tailwind + MUI + TanStack Table  
**Backend:** Express + Prisma + PostgreSQL  
**Dati:** Record + (Trait, Biome, Species, Ecosystem)  
**Feature chiave:** Filtri, top bar contestuale, resize/pin colonne, export server streaming, auth token, audit, import taxonomy.

Per setup e flussi vedi README alla radice.

## Localizzazione UI

L'interfaccia del dashboard utilizza [i18next](https://www.i18next.com/) tramite `react-i18next` con risorse definite in `apps/dashboard/src/i18n/locales/it/`. Le stringhe sono suddivise per namespace (es. `records`, `dashboard`, `taxonomy`) per mantenere i moduli indipendenti.

Per aggiungere una nuova stringa:

1. Individua il namespace del modulo (o creane uno nuovo se necessario) e aggiungi la chiave nel relativo JSON.
2. Se serve un namespace nuovo, registralo in `apps/dashboard/src/i18n/index.ts` aggiornando import, `resources` e l'elenco `ns`.
3. Nel componente usa `useTranslation('<namespace>')` e sostituisci il testo hardcoded con `t('chiave')`. Per stringhe riutilizzabili prevedi parametri (`{{placeholder}}`).
4. Ricordati di importare `./i18n` nei test (già fatto in `setupTests.ts`) e, se aggiorni snapshot, rigenerali dopo aver popolato le nuove traduzioni.

I test e gli snapshot devono usare i testi tradotti, quindi evita di inserire stringhe raw nei componenti.
