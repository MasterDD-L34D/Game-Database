# QUALITY GATES

Questi gate minimi devono essere verificati prima del merge:

1. **Test locali pertinenti eseguiti**
   - Sono stati eseguiti i test locali coerenti con le modifiche introdotte.
2. **Nessuna modifica breaking senza nota**
   - Ogni cambiamento breaking deve essere esplicitato nella PR e nelle note di rilascio.
3. **Documentazione aggiornata se cambia UX/API**
   - Se cambiano flussi utente, interfacce o contratti API, la documentazione deve essere aggiornata nello stesso branch.

## Permessi scrittura tassonomie

La scrittura delle tassonomie è protetta dal middleware `requireTaxonomyWrite`, che usa la lista ruoli `TAXONOMY_WRITE_ROLES` (default: `taxonomy:write`, `admin`). I ruoli possono essere passati negli header `X-Roles` o `X-User-Roles` (supporto multi-valore con separatori `,` e spazi).  

### Endpoint protetti (endpoint → ruolo richiesto)

| Endpoint | Metodo | Ruolo richiesto |
|---|---|---|
| `/api/biomes` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/biomes/:id` | `PUT` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/biomes/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species/:id` | `PUT` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/traits` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/traits/:id` | `PUT` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/traits/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystems` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystems/:id` | `PUT` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystems/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-traits` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-traits/:id` | `PATCH` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-traits/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-biomes` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-biomes/:id` | `PATCH` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/species-biomes/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-biomes` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-biomes/:id` | `PATCH` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-biomes/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-species` | `POST` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-species/:id` | `PATCH` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
| `/api/ecosystem-species/:id` | `DELETE` | uno tra `taxonomy:write` / `admin` (`TAXONOMY_WRITE_ROLES`) |
