# Scheda completa Trait

Questa scheda riepiloga tutti i campi necessari per definire un **Trait** e per collegarlo ai valori delle specie. Le informazioni provengono dal modello Prisma e dalle API di backend/front-end.

## Dati anagrafici del trait
- **Slug** (`slug`): identificatore univoco, normalizzato in minuscolo con trattini. Obbligatorio. # Prisma `Trait.slug`; slugificato in UI o migrato manualmente. 【F:server/prisma/schema.prisma†L119-L131】
- **Nome** (`name`): etichetta leggibile. Obbligatorio. # Prisma `Trait.name`; inserito come testo libero. 【F:server/prisma/schema.prisma†L119-L131】
- **Descrizione** (`description`): testo libero opzionale. # Prisma `Trait.description`; supporta testo generico. 【F:server/prisma/schema.prisma†L119-L131】
- **Categoria** (`category`): raggruppamento logico opzionale (es. morfologia, comportamento). # Prisma `Trait.category`; usata per raggruppare/filtrare. 【F:server/prisma/schema.prisma†L119-L131】
- **Unità di misura** (`unit`): opzionale, usata soprattutto per dati numerici o percentuali. # Prisma `Trait.unit`; compilare solo se serve indicare metri, %, kg, ecc. 【F:server/prisma/schema.prisma†L119-L131】
- **Tipo dato** (`dataType`): uno tra `BOOLEAN`, `NUMERIC`, `CATEGORICAL`, `TEXT` (controllato sia lato API sia UI). # Enum Prisma `TraitDataType`; selezionato via select nel form. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】

## Vincoli specifici per tipo dato
- **BOOLEAN** # Gestito da `Trait.dataType = BOOLEAN`; nessun campo extra. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
  - Nessun campo extra sul trait.
  - Valori per specie ammessi: `bool` (true/false). # Prisma `SpeciesTrait.bool`; unico campo atteso per booleani. 【F:server/prisma/schema.prisma†L136-L152】
- **NUMERIC** # Gestito da `Trait.dataType = NUMERIC`; range opzionale. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
  - Campi facoltativi: `rangeMin`, `rangeMax` (entrambi numerici, `rangeMin` ≤ `rangeMax`). # Prisma `Trait.rangeMin`/`rangeMax`; compilare solo se si vuole limitare l'intervallo. 【F:server/prisma/schema.prisma†L119-L131】
  - Valori per specie ammessi: `num`, `confidence`, `unit`. # Prisma `SpeciesTrait.num`, `confidence`, `unit`; inserire numero, confidenza percentuale e unità coerente. 【F:server/prisma/schema.prisma†L136-L152】
- **CATEGORICAL** # Gestito da `Trait.dataType = CATEGORICAL`; richiede lista valori. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
  - Campo obbligatorio: `allowedValues` (array di stringhe non vuote). Non è consentito su altri tipi. # Prisma `Trait.allowedValues` tipo `Json`; riempire con elenco/array di opzioni. 【F:server/prisma/schema.prisma†L119-L131】
  - Valori per specie ammessi: `value` e/o `text`, devono appartenere a `allowedValues`. # Prisma `SpeciesTrait.value`/`text`; mappa a una delle opzioni definite. 【F:server/prisma/schema.prisma†L136-L152】
- **TEXT** # Gestito da `Trait.dataType = TEXT`; nessun campo extra. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
  - Nessun campo extra sul trait.
  - Valori per specie ammessi: `text`, `source`. # Prisma `SpeciesTrait.text`/`source`; testo libero con eventuale fonte. 【F:server/prisma/schema.prisma†L136-L152】

## Relazione con SpeciesTrait
- Ogni combinazione `speciesId` + `traitId` + `category` deve essere univoca (categoria di default `baseline`). # Indice univoco Prisma `@@unique([speciesId, traitId, category])`; categoria opzionale per mutazioni/varianti. 【F:server/prisma/schema.prisma†L136-L152】
- Campi scrivibili per il valore di specie sono limitati dal tipo dato del trait:
  - **BOOLEAN:** solo `bool`. # Prisma `SpeciesTrait.bool`; gli altri campi sono null. 【F:server/prisma/schema.prisma†L136-L152】
  - **NUMERIC:** `num`, `confidence`, `unit`. # Prisma `SpeciesTrait.num`/`confidence`/`unit`; usare confidenza come percentuale 0-1 o 0-100 secondo la UI. 【F:server/prisma/schema.prisma†L136-L152】
  - **CATEGORICAL:** `value`, `text` (entrambi validati contro `allowedValues`). # Prisma `SpeciesTrait.value`/`text`; compilare con una scelta dall'elenco. 【F:server/prisma/schema.prisma†L136-L152】
  - **TEXT:** `text`, `source`. # Prisma `SpeciesTrait.text`/`source`; inserire testo libero e citazione. 【F:server/prisma/schema.prisma†L136-L152】
- I campi comuni disponibili nel payload di specie-trait sono `value`, `num`, `bool`, `text`, `unit`, `source`, `confidence`, più `category` per distinguere varianti/mutazioni. # Prisma `SpeciesTrait` definisce tutti i campi facoltativi; il backend/UI accettano solo quelli pertinenti al tipo. 【F:server/prisma/schema.prisma†L136-L152】

## Linee guida per la compilazione della scheda
1. **Identità**: inserire slug e nome; verificare l’unicità dello slug. # `Trait.slug` è unique in Prisma. 【F:server/prisma/schema.prisma†L119-L131】
2. **Contesto**: aggiungere categoria e descrizione per chiarire l’ambito (es. morfologia, genetica, comportamento, mutazioni). # Campi opzionali `category` e `description`. 【F:server/prisma/schema.prisma†L119-L131】
3. **Tipo dato**: scegliere il tipo corretto e compilare solo i campi pertinenti: # Enum `TraitDataType` vincola il comportamento. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
   - Numerico ⇒ valutare unità, range minimo/massimo. # `unit`, `rangeMin`, `rangeMax`. 【F:server/prisma/schema.prisma†L119-L131】
   - Categorico ⇒ elencare tutti i valori ammessi (uno per riga o separati da virgole). # `allowedValues` come Json array. 【F:server/prisma/schema.prisma†L119-L131】
   - Booleano/Testo ⇒ nessun campo aggiuntivo, ma è possibile usare categoria/unità se rilevanti. # Campi opzionali restano utilizzabili per contesto. 【F:server/prisma/schema.prisma†L119-L131】
4. **Varianti/Mutazioni**: usare il campo `category` di SpeciesTrait per gestire versioni alternative (es. mutazioni, stadi di sviluppo) mantenendo lo stesso trait. # `SpeciesTrait.category` consente più record per stesso trait specie. 【F:server/prisma/schema.prisma†L136-L152】
5. **Validazione**: ricordare che # Regole dal modello Prisma/validazioni backend.
   - `allowedValues` è obbligatorio solo per trait categorici e vietato sugli altri tipi. # `allowedValues` presente solo se `dataType=CATEGORICAL`. 【F:server/prisma/schema.prisma†L61-L66】【F:server/prisma/schema.prisma†L119-L131】
   - `rangeMin`/`rangeMax` sono ammessi solo per trait numerici e devono essere numeri coerenti. # Campi numerici facoltativi per NUMERIC. 【F:server/prisma/schema.prisma†L119-L131】
   - Ogni valore di specie deve rispettare i campi consentiti dal relativo tipo dato. # `SpeciesTrait` limita i campi disponibili per payload. 【F:server/prisma/schema.prisma†L136-L152】

## Campi da includere nella scheda (frontend/backoffice)
- Slug (text, required) # popola `Trait.slug`; generato automaticamente o digitato manualmente.
- Nome (text, required) # popola `Trait.name`; testo libero.
- Categoria (text, optional) # popola `Trait.category`; utile per filtri.
- Tipo dato (select: Booleano, Numerico, Categorico, Testo; required) # popola `Trait.dataType`; menu vincolato all'enum.
- Unità di misura (text, optional) # popola `Trait.unit`; usare solo quando applicabile.
- Descrizione (textarea, optional) # popola `Trait.description`; note esplicative.
- Valori consentiti (textarea, mostrato solo se Categorico; obbligatorio con almeno un valore) # popola `Trait.allowedValues`; inserire elenco formattato.
- Valore minimo (number, mostrato solo se Numerico) # popola `Trait.rangeMin`; default vuoto.
- Valore massimo (number, mostrato solo se Numerico) # popola `Trait.rangeMax`; default vuoto.

Questa struttura copre tutti i vincoli applicati dal backend (`Trait` e `SpeciesTrait`) e riflette la configurazione attuale del form nella dashboard. # Riferimento incrociato Prisma/forma UI.
