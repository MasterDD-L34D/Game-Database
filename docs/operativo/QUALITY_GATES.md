# Quality Gates - Regole Minime di Merge

## Governance operativa
- **Owner:** Solo Maintainer
- **Executor:** AI Agent
- **Decision policy:** human-in-the-loop solo per approvazioni di rilascio e scelte architetturali

## RACI semplificata
- **Decide:** Solo Maintainer
- **Esegue:** AI Agent (con supervisione)
- **Verifica finale:** Solo Maintainer

Per poter effettuare il merge di una Pull Request nel branch principale, devono essere rispettate almeno le seguenti regole:

## Checklist obbligatoria pre-merge
- [ ] Test pertinenti eseguiti (unit, integrazione, end-to-end o test manuali motivati) con evidenza allegata.
- [ ] Nessun nuovo hardcode introdotto nei flussi **i18n** (tutte le stringhe utente passano da chiavi/localizzazioni).
- [ ] Gestione errori coerente lato API e UI (codici errore, mapping messaggi, fallback e stati di errore).
- [ ] Documentazione aggiornata quando il comportamento applicativo cambia (tecnica e/o utente).

## 1) Integrità tecnica
- Build CI completata con esito positivo.
- Nessun test unitario/integrativo fallito.
- Nessun conflitto non risolto con il branch target.

## 2) Revisione del codice
- **Self-review obbligatoria** con checklist firmata dall'autore della PR.
- Tutti i commenti di review eventualmente presenti devono essere risolti o tracciati con decisione esplicita.
- I gate tecnici automatici (test, lint, sicurezza) restano il sostituto del reviewer umano e devono risultare tutti verdi.

## 3) Sicurezza e affidabilità
- Nessuna vulnerabilità critica o alta introdotta dalle dipendenze/modifiche.
- Segreti e credenziali non devono comparire nel codice o nella cronologia della PR.
- Logging e gestione errori coerenti con gli standard di progetto.

## 4) Tracciabilità
- PR con descrizione chiara: contesto, modifica, impatti, piano di test.
- Ticket/issue collegato (quando applicabile).
- Evidenza dei test eseguiti (output CI o checklist manuale).
- Se il comportamento cambia, aggiornamento documentazione esplicitato nella PR.

## 5) Prontezza funzionale
- Criteri di accettazione soddisfatti.
- Documentazione utente/tecnica aggiornata se il comportamento cambia.
- Feature flag/configurazioni di rollout dichiarate (se previste).

## Blocchi al merge
Una PR è **bloccata** (non mergiabile) se almeno uno dei criteri seguenti è vero:
- Almeno un job CI obbligatorio è in stato `failed`, `canceled` o `timed_out`.
- Sono presenti test falliti nei check obbligatori.
- Manca il piano di test nella descrizione della PR.
- Manca evidenza dell'output dei test/check eseguiti.
- È presente almeno un hardcode nuovo in i18n identificato in review o da controlli automatici.
- È rilevata incoerenza nella gestione errori tra API e UI (es. codici non gestiti, messaggi non mappati, stato errore non coperto).
- La PR modifica comportamento funzionale senza aggiornare la documentazione correlata.
- Manca la self-review obbligatoria con checklist firmata oppure sono presenti review in stato `changes requested`.
- Esistono vulnerabilità `high`/`critical` introdotte dalla PR o segreti esposti nel codice.
- Persistono conflitti di merge con il branch target.

## Esempio di PR descritta bene
```md
## Contesto
Correggiamo il flusso di salvataggio profilo che in caso di timeout API non mostrava un feedback coerente in UI.

## Cambi principali
- API: normalizzazione risposta errore `PROFILE_SAVE_TIMEOUT` con status HTTP 504.
- UI: mapping del codice errore a messaggio localizzato (`profile.save.timeout`) e stato di retry.
- i18n: aggiunte chiavi localizzazione `profile.save.timeout` in `it` e `en`.
- Docs: aggiornato runbook operativo con comportamento in timeout e azioni suggerite.

## Rischi
- Possibile regressione su altri error code del profilo se il mapping è incompleto.
- Potenziale aumento temporaneo dei retry lato client in reti instabili.

## Test eseguiti
- Unit test API su mapper errori (`ProfileErrorMapperTest`): PASS.
- Test integrazione UI su stato errore timeout: PASS.
- Smoke test manuale in staging (salvataggio profilo con latenza simulata): PASS.
```
