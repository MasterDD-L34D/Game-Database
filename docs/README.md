# Documentazione Game-Database

Indice della documentazione del taxonomy CMS Evo-Tactics (server Express + Prisma +
PostgreSQL, dashboard React). Lingua: italiano per i doc, inglese per gli identificatori.

## Struttura (riorganizzata 2026-06-04)

```
docs/
+-- reference/          # Schema/dominio/dati: architettura, schede trait, catalogo
+-- process/            # Workflow operativi: runbook, roadmap, sprint, onboarding, import
+-- research/           # Spike log datati + note di audit (evidence trail Quality Gate)
+-- rfc/                # Proposte/design formali (es. schema-versioning, semantic-search)
+-- superpowers/        # Piani di esecuzione + spec per subagent (plans/ + specs/)
+-- schema-reference.md # AUTO-GENERATO da server/prisma/schema.prisma (NON editare a mano)
```

## Note

- `schema-reference.md` resta nella root di `docs/`: e' generato da
  `server/scripts/generate-schema-doc.js` (`npm run schema:doc`) e verificato in CI da
  `.github/workflows/schema-doc-check.yml`. Rigeneralo, non modificarlo a mano.
- `research/` e `rfc/` sono mantenuti: sono la traccia di evidenza referenziata dai
  piani in `superpowers/plans/` e la sede standard dei report Quality Gate.
- L'export Insomnia (`docs/insomnia/game-database.json`) e' ora gitignored (file generato).

## Riassetto 2026-06-04 (PR chore/docs-reorg)

- `catalog/` -> `reference/`; root *.md distribuiti tra `reference/` e `process/`.
- `operativo/` -> `process/` (allineamento naming IT->process).
- `insomnia/` rimosso dal versioning (gitignore), file di lavoro mantenuto.
