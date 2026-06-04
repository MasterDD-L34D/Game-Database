# Prompt di intenti per l'estrazione dati dai repository

Quando analizzi un nuovo repository con un database da documentare, segui queste istruzioni e compila il file `modal.md` usando il formato standard:

1. **Raccolta informazioni**
   - Leggi `README`, cartelle `docs/`, file di schema (es. `prisma/schema.prisma`, migrazioni SQL) e script di seed/import.
   - Identifica tecnologia database, linguaggi, tool di migrazione/ORM, script di bootstrap e variabili d'ambiente.
   - Individua le entità principali, i campi chiave e le relazioni (inclusi enum o tabelle ponte).
   - Mappa le sorgenti dati già presenti nel repository (cartelle `data/`, `fixtures/`, dump, file CSV/JSON/YAML/Markdown) e raccogli esempi di record, campi obbligatori, formati, convenzioni di naming e trasformazioni da applicare.

2. **Compilazione `modal.md`**
   - Popola tutte le sezioni del template: titolo, repository, tecnologie, obiettivo, entità chiave, tabella schema, processi di popolamento, dati sorgente per import, sicurezza/audit, note operative, TODO.
   - Usa descrizioni sintetiche ma complete, mantenendo i nomi delle entità come appaiono nel codice.
   - Per la tabella schema, riassumi campi distintivi e descrivi il tipo di relazione (1:N, N:M, gerarchica, ecc.).

3. **Output finale**
   - Restituisci il file compilato (o il diff se già esistente) nel repository corrente.
   - Evidenzia eventuali lacune o TODO per approfondimenti futuri.
   - Se emergono strumenti di import o audit specifici, documentali nelle sezioni dedicate.

## Template di riferimento
Copia e compila questo blocco Markdown:

```markdown
# Nome database / progetto
- **Repository**: <!-- link o percorso -->
- **Tecnologie principali**: <!-- es. PostgreSQL + Prisma -->

## Obiettivo e dominio
- **Descrizione sintetica**: <!-- a cosa serve il DB -->
- **Entità chiave**: <!-- elenco con breve spiegazione -->

## Schema
| Entità | Campi principali | Relazioni |
| ------ | ---------------- | --------- |
| <!-- es. Species --> | <!-- campi core + note --> | <!-- relazioni uno-a-molti/molti-a-molti --> |

## Processi di popolamento
- **Seed o migrazioni**: <!-- comandi, script, comportamento -->
- **Strumenti di import**: <!-- script, formati supportati, flag utili -->

## Dati sorgente per import
- **Sorgenti disponibili**: <!-- cartelle/file con dati grezzi, URL, API -->
- **Formato e struttura**: <!-- estensioni, schema campi, esempio di record -->
- **Campi obbligatori e mapping**: <!-- colonne chiave, trasformazioni, corrispondenze -->
- **Note operative**: <!-- esigenze di normalizzazione, cleaning, limitazioni -->

## Sicurezza e audit
- **Tracciamento utenti**: <!-- campi audit, header richiesti -->
- **Permessi/ruoli**: <!-- variabili d'ambiente o policy -->

## Note operative
- **Prerequisiti**: <!-- runtime, servizi -->
- **Comandi utili**: <!-- avvio, test, reset -->
- **Variabili d'ambiente**: <!-- elenco chiave -->

## Questioni aperte / TODO
- <!-- punti da chiarire o integrare -->
```

Seguendo questo prompt otterrai sempre una scheda coerente, pronta per essere integrata nel database centralizzato.
