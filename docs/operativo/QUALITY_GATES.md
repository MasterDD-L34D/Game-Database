# QUALITY GATES

Questi gate minimi devono essere verificati prima del merge:

1. **Test locali pertinenti eseguiti**
   - Sono stati eseguiti i test locali coerenti con le modifiche introdotte.
2. **Nessuna modifica breaking senza nota**
   - Ogni cambiamento breaking deve essere esplicitato nella PR e nelle note di rilascio.
3. **Documentazione aggiornata se cambia UX/API**
   - Se cambiano flussi utente, interfacce o contratti API, la documentazione deve essere aggiornata nello stesso branch.
