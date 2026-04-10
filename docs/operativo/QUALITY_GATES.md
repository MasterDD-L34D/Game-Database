# Quality Gates — Regole Minime di Merge

Per poter effettuare il merge di una Pull Request nel branch principale, devono essere rispettate almeno le seguenti regole:

## 1) Integrità tecnica
- Build CI completata con esito positivo.
- Nessun test unitario/integrativo fallito.
- Nessun conflitto non risolto con il branch target.

## 2) Revisione del codice
- Almeno **1 approvazione** da un reviewer assegnato.
- Tutti i commenti di review devono essere risolti o tracciati con decisione esplicita.
- Le modifiche ad aree critiche (autenticazione, dati, sicurezza) richiedono reviewer con ownership del dominio.

## 3) Sicurezza e affidabilità
- Nessuna vulnerabilità critica o alta introdotta dalle dipendenze/modifiche.
- Segreti e credenziali non devono comparire nel codice o nella cronologia della PR.
- Logging e gestione errori coerenti con gli standard di progetto.

## 4) Tracciabilità
- PR con descrizione chiara: contesto, modifica, impatti, piano di test.
- Ticket/issue collegato (quando applicabile).
- Evidenza dei test eseguiti (output CI o checklist manuale).

## 5) Prontezza funzionale
- Criteri di accettazione soddisfatti.
- Documentazione utente/tecnica aggiornata se il comportamento cambia.
- Feature flag/configurazioni di rollout dichiarate (se previste).
