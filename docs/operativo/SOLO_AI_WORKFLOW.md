# Solo AI Workflow

## 1. Scopo
Definire un flusso operativo per task eseguibili in autonomia da AI con perimetro chiaro, verifiche esplicite e output osservabile.

## 2. Guardrail Operativi
- Dimensione task target: 30-120 minuti.
- WIP limit: massimo 1 task in stato `Doing`.
- Ogni task deve avere contesto, file target, criteri di accettazione, comandi di verifica e output atteso prima di iniziare.
- Un task non entra in esecuzione se manca almeno uno degli elementi richiesti dal template.

## 3. Matrice Decisionale

| Tipo di task | AI procede in autonomia | AI si ferma e chiede conferma |
| --- | --- | --- |
| Refactor locali | Si, se confinati ai file target e senza cambiare il comportamento osservabile | Se il refactor si allarga a moduli, contratti o dipendenze non previste |
| Test | Si, per aggiungere, aggiornare o rieseguire test coerenti con i criteri di accettazione | Se i test richiedono ambienti, fixture, dati o tempi di esecuzione non previsti |
| Docs | Si, per chiarimenti, esempi, runbook e allineamento alla behavior attuale | Se la documentazione formalizza decisioni non ancora approvate |
| Bugfix non-breaking | Si, se il fix e localizzato e non altera contratti pubblici | Se il fix impatta API, schema dati, sicurezza o introduce tradeoff non banali |
| Schema DB e migrazioni distruttive | No | Sempre |
| Sicurezza e auth | No | Sempre |
| Breaking API contract | No | Sempre |
| Tradeoff costosi in tempo | No | Sempre, quando la soluzione richiede lavoro extra significativo o apre strade alternative con costo diverso |

## 4. Checklist Pre-Flight
- [ ] Il task rientra nel perimetro 30-120 minuti.
- [ ] Contesto, file target, criteri di accettazione, comandi di verifica e output atteso sono presenti.
- [ ] L'intervento e locale, osservabile e compatibile con i contratti esistenti.
- [ ] Non sono previste modifiche a schema DB, migrazioni distruttive, sicurezza/auth o API breaking.
- [ ] I comandi di verifica sono eseguibili con gli strumenti disponibili.
- [ ] Esiste un percorso chiaro per salvare evidenze, log o output finale.
- [ ] Sono note le condizioni che impongono stop ed escalation prima di iniziare.

## 5. Stop Conditions
- [ ] Emergere di una modifica a schema DB o migrazione distruttiva.
- [ ] Impatto su autenticazione, autorizzazione, segreti, permessi o altre aree di sicurezza.
- [ ] Necessita di cambiare un API contract o introdurre comportamento breaking.
- [ ] Refactor o bugfix non piu locale rispetto al perimetro iniziale.
- [ ] Verifica impossibile, ambiente incoerente o dipendenze mancanti non previste.
- [ ] Tempo stimato oltre il limite del task o presenza di tradeoff costosi da valutare.
- [ ] Mancanza di evidenze sufficienti per dimostrare l'esito osservabile richiesto.
- [ ] Ambiguita sui criteri di accettazione tale da richiedere una decisione di prodotto o architettura.

## 6. Flusso
1. Preparare il task usando il template standard.
2. Eseguire la checklist `Pre-Flight` e confermare che il task ricada nelle aree gestibili in autonomia.
3. Portare un solo task alla volta in `Doing`.
4. Eseguire le modifiche solo sui file target dichiarati o su file strettamente necessari emersi durante il lavoro.
5. Fermarsi immediatamente se si verifica una delle `Stop Conditions`.
6. Eseguire i comandi di verifica previsti.
7. Salvare evidenze, log o output nel percorso concordato.
8. Chiudere il task solo se i criteri di accettazione sono soddisfatti e l'output atteso e presente.

## 7. Template Task
````md
## Task ID: <ID>

### Contesto
- Problema da risolvere:
- Vincoli:
- Dipendenze:

### File Target
- path/file-1
- path/file-2

### Criteri di Accettazione
- [ ] Criterio 1
- [ ] Criterio 2
- [ ] Criterio 3

### Comandi di Verifica
```bash
<comando 1>
<comando 2>
```

### Output Atteso
- Artefatto prodotto:
- Path evidenze/log:
- Esito osservabile:

### Pre-Flight
- [ ] Perimetro entro 30-120 minuti
- [ ] Nessun impatto su DB distruttivo, sicurezza/auth o API breaking
- [ ] Verifiche eseguibili
- [ ] Output ed evidenze salvabili

### Stop Conditions
- [ ] Stop se emerge impatto su DB, sicurezza/auth o API contract
- [ ] Stop se il task supera il perimetro locale o temporale
- [ ] Stop se serve una decisione architetturale o di prodotto
````

## 8. Regole di Chiusura
- Se i comandi di verifica falliscono, il task resta aperto.
- Se l'output atteso non e salvato nel percorso previsto, il task non e `Done`.
- Se il task supera il perimetro 30-120 minuti, va spezzato in task piu piccoli prima di proseguire.
- Se durante l'esecuzione si verifica una `Stop Condition`, il task torna in stato di chiarimento e richiede conferma esplicita.
