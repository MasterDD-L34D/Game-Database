# Scheda operativa per i Trait

Questa scheda raccoglie le informazioni essenziali per configurare correttamente un **Trait** e i relativi valori di specie. Usa questa pagina come checklist operativa prima di creare o aggiornare un trait nella dashboard.

## Dati anagrafici
- **Slug (`slug`, obbligatorio)**: identificatore univoco in minuscolo con trattini.
- **Nome (`name`, obbligatorio)**: etichetta leggibile; consulta le proposte approvate in [`docs/catalog/trait_reference.md`](catalog/trait_reference.md) prima di crearne di nuove.
- **Descrizione (`description`, opzionale)**: testo di contesto; preferire descrizioni già validate in [`docs/catalog/trait_reference.md`](catalog/trait_reference.md).
- **Categoria (`category`, opzionale)**: raggruppamento logico (es. morfologia, comportamento, genetica).
- **Unità (`unit`, opzionale)**: specifica metri, %, kg ecc. solo quando necessario.
- **Tipo dato (`dataType`, obbligatorio)**: uno tra `BOOLEAN`, `NUMERIC`, `CATEGORICAL`, `TEXT`.

## Vincoli per tipo dato
- **BOOLEAN**
  - Nessun campo extra sul trait.
  - Valori ammessi per specie: `bool`.
- **NUMERIC**
  - Campi facoltativi: `rangeMin`, `rangeMax` (con `rangeMin` ≤ `rangeMax`).
  - Valori ammessi per specie: `num`, `confidence`, `unit`.
- **CATEGORICAL**
  - Campo obbligatorio: `allowedValues` (array di stringhe non vuote).
  - Valori ammessi per specie: `value` e/o `text`, coerenti con `allowedValues`.
- **TEXT**
  - Nessun campo extra sul trait.
  - Valori ammessi per specie: `text`, `source`.

## Varianti e categorie
- Ogni combinazione `speciesId` + `traitId` + `category` è univoca; usa `category` per mutazioni o varianti.
- Mantieni la `category` di default `baseline` quando non servono varianti.

## Passi operativi
1. Scegli un **nome** e una **descrizione** partendo dalle proposte approvate in [`docs/catalog/trait_reference.md`](catalog/trait_reference.md); aggiorna il catalogo se aggiungi un nuovo valore condiviso.
2. Imposta **slug** e **tipo dato** coerenti con l’uso previsto.
3. Compila i campi aggiuntivi richiesti dal tipo (`allowedValues`, `rangeMin`/`rangeMax`, `unit`).
4. Definisci eventuali **varianti** tramite `category` in `SpeciesTrait` solo se realmente necessarie.
5. Verifica che i valori di specie seguano i vincoli del tipo dato.

## Materiali correlati
- Guida passo-passo: [`README_HOWTO_AUTHOR_TRAIT.md`](../README_HOWTO_AUTHOR_TRAIT.md)
- Template di scheda: [`docs/traits_template.md`](traits_template.md)
- Riferimento Prisma: [`docs/trait-scheda.md`](trait-scheda.md)
