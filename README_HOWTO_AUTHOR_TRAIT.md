# Come redigere un Trait

Questa guida spiega come preparare una nuova voce Trait per il catalogo e pubblicarla in dashboard/backend.

## Prima di iniziare
- Consulta la [scheda operativa completa](docs/traits_scheda_operativa.md) per verificare campi obbligatori, vincoli e passi operativi.
- Verifica se esistono label/descrizioni già approvate in [`docs/catalog/trait_reference.md`](docs/catalog/trait_reference.md) e riutilizzale quando possibile.

## Preparare i contenuti
1. Definisci **slug** e **tipo dato** coerenti con l’utilizzo previsto.
2. Raccogli **nome** e **descrizione** proponendo varianti solo se non presenti nel catalogo.
3. Compila i campi aggiuntivi per il tipo dato (es. `allowedValues` o `rangeMin`/`rangeMax`).
4. Se servono varianti/mutazioni, pianifica le `category` da usare su `SpeciesTrait`.

## Pubblicare
- Inserisci il nuovo trait tramite la dashboard rispettando la checklist della [scheda operativa](docs/traits_scheda_operativa.md).
- Aggiorna [`docs/catalog/trait_reference.md`](docs/catalog/trait_reference.md) quando aggiungi una label/descrizione condivisa.
