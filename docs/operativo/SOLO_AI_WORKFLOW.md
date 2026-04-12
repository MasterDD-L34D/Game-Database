# Solo AI Workflow

## 1. Scopo
Definire un flusso operativo per task eseguibili in autonomia da AI con perimetro chiaro, verifiche esplicite e output osservabile.

## 2. Guardrail Operativi
- Dimensione task target: 30-120 minuti.
- WIP limit: massimo 1 task in stato `Doing`.
- Ogni task deve avere contesto, file target, criteri di accettazione, comandi di verifica e output atteso prima di iniziare.
- Un task non entra in esecuzione se manca almeno uno degli elementi richiesti dal template.

## 3. Flusso
1. Preparare il task usando il template standard.
2. Verificare che il task sia autonomo, limitato e completabile entro 30-120 minuti.
3. Portare un solo task alla volta in `Doing`.
4. Eseguire le modifiche solo sui file target dichiarati o su file strettamente necessari emersi durante il lavoro.
5. Eseguire i comandi di verifica previsti.
6. Salvare evidenze, log o output nel percorso concordato.
7. Chiudere il task solo se i criteri di accettazione sono soddisfatti e l'output atteso è presente.

## 4. Template Task
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
````

## 5. Regole di Chiusura
- Se i comandi di verifica falliscono, il task resta aperto.
- Se l'output atteso non è salvato nel percorso previsto, il task non è `Done`.
- Se il task supera il perimetro 30-120 minuti, va spezzato in task più piccoli prima di proseguire.
