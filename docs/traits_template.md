# Template per la scheda Trait

Usa questo template per documentare un nuovo Trait in modo consistente tra catalogo, backend e dashboard. Per una checklist operativa completa consulta subito la [scheda operativa](traits_scheda_operativa.md).

## Campi principali
- **Slug**: identificatore univoco (minuscolo, trattini).
- **Nome**: etichetta leggibile; preferire le voci approvate in [`docs/catalog/trait_reference.md`](catalog/trait_reference.md).
- **Descrizione**: contesto e significato; riusa descrizioni approvate in [`docs/catalog/trait_reference.md`](catalog/trait_reference.md).
- **Categoria**: gruppo logico (morfologia, comportamento, ecc.).
- **Tipo dato**: `BOOLEAN`, `NUMERIC`, `CATEGORICAL`, `TEXT`.
- **Unità** (opzionale): specifica solo se serve.

## Sezioni consigliate
1. **Definizione**: scopo del trait e quando usarlo.
2. **Campi specifici**: vincoli extra per il tipo dato (allowedValues, range, ecc.).
3. **Esempi**: valori di specie validi, includendo eventuali categorie/varianti.
4. **Note di validazione**: errori comuni, relazioni con altri trait.
