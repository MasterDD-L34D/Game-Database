# RFC #4: Bidirectional sync -- DB as taxonomy source-of-truth (scoping)

**Date**: 2026-06-11
**Author**: coordinator session (Lenovo, claude-fable-5)
**Status**: SCOPING DRAFT -- for Eduardo + coordinator ratification. No implementation in this RFC.
**Scope**: Game-Database export path + Game pack-catalog consumption + cross-repo governance. **Eduardo-sovereign gate mandatory** (value-roadmap spec, Fase 3 deliverable 4).
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` deliverable 4: "Bidirectional sync (RFC + implementation): Game <-> DB canonical flow review. Migration plan: Fase 1 import-only -> Fase 2 dual-write -> Fase 3 export-only."

## Problem statement

Source-of-truth is ambiguous (spec, verbatim): Game static pack files are the canonical
input via `npm run evo:import`, BUT Game runtime can consume HTTP
`GET /api/traits/glossary` when `GAME_DATABASE_ENABLED=true` (default ON since
2026-05-14). Two consequences:

1. **Dashboard edits do not reach Game files.** A designer editing a trait in the
   Game-Database UI changes the DB row (audited, versioned), but the canonical pack
   catalog in Game is untouched. The next scheduled import (`evo-import-sync.yml`,
   every 6h on this repo) re-asserts Game's files over nothing -- the DB edit
   survives only because import upserts by slug and does not delete divergent
   fields it does not carry. Effective result: silent divergence between DB and
   pack files, with no detector.
2. **The DB's value proposition is capped.** Versioning (TaxonomyVersion +
   snapshots, RFC #1 complete: #154/#158/#160/#161/#163/#164/#180), audit
   (#122/#130), bulk-edit and the curator dashboard only matter if the DB is, or
   can become, the place where taxonomy truth lives. While Game files stay
   canonical, the DB is a fancy mirror.

This RFC scopes the inversion: **DB becomes source-of-truth for taxonomy content;
Game pack files become generated artifacts** -- and defines the migration ladder,
the fidelity invariant, and the open questions that must be ratified before any
implementation PR.

## Goals

- A deterministic, reproducible **export**: released `TaxonomyVersion` snapshot ->
  Game pack catalog files (same set `evo:import` reads today).
- A **fidelity invariant** (round-trip): `import(export(DB))` reports zero errors
  and zero effective diff -- measurable with the existing `--validate-only` /
  `--dry-run` import machinery and the existing `evo-import-gate.yml` CI on Game.
- A **migration ladder** with reversible steps and explicit Eduardo gates,
  refining the spec's "import-only -> dual-write -> export-only".
- **Drift detection** between DB state and Game pack files (the missing detector).
- Cross-repo governance preserved: export lands on Game ONLY as branch + PR;
  merge is Eduardo-only (external-repo boundary, ADR-0037 family).

## Non-goals (this RFC)

- **No two-way merge / conflict resolution engine.** Concurrent edits on both
  sides with automatic reconciliation is option C below -- rejected (YAGNI).
- **No Game runtime cutover.** Game keeps loading local files at runtime
  (`data/core/*`, `catalog.js` local fallback); how Game derives runtime data
  from the pack is Game's concern, out of scope here.
- **No Records export** (per-user artistic schede; RFC #1 Q5 precedent).
- **No branch/staging** (RFC #2 territory).
- **No model migration in this doc** -- model gaps are flagged as open questions;
  any schema change ships in its own PR chain after ratification.

## Current state (ground-truth, 2026-06-11)

- **Import direction (Game -> DB)**: `server/scripts/ingest/import-taxonomy.js`
  reads `packs/evo_tactics_pack/docs/catalog/*` (trait_glossary.json,
  trait_reference.json, env_traits.json, species/**, catalog_data.json) +
  `packs/evo_tactics_pack/data/ecosystems/*.{biome,ecosystem}.yaml`; upserts by
  slug; `--dry-run` / `--validate-only` produce a machine-readable report.
- **CI**: Game-side `evo-import-gate.yml` runs the dry-run import on every Game PR
  touching the pack catalog (merge-blocking, errori=0). DB-side
  `evo-import-sync.yml` runs the import on a 6h schedule.
- **Versioning (DB)**: released `TaxonomyVersion` snapshots are immutable and
  readable for all 4 masters via `?versionId=` (#163 traits, #180
  biome/species/ecosystem). An export built from a released snapshot is therefore
  deterministic and replayable -- the precondition this RFC was waiting for.
- **Game-side consumers**: `apps/backend/services/catalog.js` (glossary, HTTP or
  local), `traitRepository.js` (local trait JSON + own `_versions/` snapshots),
  generation pipeline (species catalog, biomes YAML). Game runtime never reads
  Prisma directly; the pack catalog is the hand-off surface.
- **Known fidelity gaps** (verified in code):
  1. **i18n is lossy at import**: `name = pickText(label, label_it, label_en, ...)`
     collapses to ONE language (import-taxonomy.js:285-306). The glossary route
     already mirrors this by serving `labels: { it: name, en: name }`. An export
     cannot reconstruct a distinct `label_en` that was never stored.
  2. **Ecosystem model is much thinner than the YAML**: DB Ecosystem =
     slug/name/description/region/climate + junctions; Game `*.ecosystem.yaml`
     carries spawn rules, creature lists, structured headers. Export today would
     be lossy-destructive for ecosystems.
  3. **Trait mechanics largely covered**: Trait model carries tier, familyType,
     energyMaintenance, slotProfile, usageTags, synergies, conflicts,
     environmentalRequirements, inducedMutation, functionalUse, selectiveDrive,
     weakness (= FIELD_MAP.trait). Residual trait_reference.json fields need a
     field-by-field inventory in S1.

## Options considered

### Option A -- Declare one-way forever (Game stays SoT)

Kill the ambiguity by policy: DB is a read-mirror + curation UI; dashboard
mutations restricted to non-canonical metadata; scheduled import remains the only
flow.

- (+) Zero new code, zero cross-repo risk, ambiguity resolved by documentation.
- (-) Caps the designer-tool value dimension (spec dimension 2): UI edits to
  canonical fields stay second-class forever; versioning investment underused.
- (-) Does not even add the missing drift detector.

### Option B -- Export-on-release, PR-gated (RECOMMENDED)

DB becomes SoT for taxonomy content. On (or after) a `TaxonomyVersion` release,
an exporter renders the released snapshot into the exact pack-catalog file set
the importer reads, and opens a **branch + PR on Game**. Game's existing
`evo-import-gate.yml` validates the PR (round-trip closure: the exported files
must re-import with errori=0). Eduardo merges. Generated files carry a
`GENERATED FROM Game-Database <tag>` header; manual edits to them become drift,
caught by a scheduled drift-check (dry-run import + diff, the inverse of today's
sync job).

- (+) Reuses everything just shipped: released snapshots (deterministic input),
  FIELD_MAP (field source), import dry-run (validator), evo-import-gate
  (cross-repo CI), external-repo PR boundary (governance unchanged).
- (+) Incremental + reversible: each ladder step has a kill-switch (stop
  exporting; files are still valid pack files).
- (+) "Bidirectional" in the honest sense: import (legacy, then drift-check) +
  export (new), never two concurrent writers on the same field.
- (-) Requires model-gap closure (i18n, ecosystems) before those entities flip.
- (-) Cross-repo PR automation needs an auth design (open question 5).

### Option C -- Continuous dual-write / two-way merge

Every dashboard mutation immediately writes both DB and Game files (or a sync
daemon reconciles both directions continuously).

- (-) Conflict resolution engine, cross-repo locking, partial-failure states;
  highest complexity for zero current demand (single curator, low edit volume).
- (-) Violates the released-snapshot determinism that makes export auditable.
- Rejected (YAGNI). Revisit only if multi-curator concurrent editing becomes real.

## Recommended design (Option B) -- migration ladder

Refines the spec's 3-phase plan into 4 gated steps. Each step is a separate PR
chain with its own acceptance; **S-gates are Eduardo ratifications**.

```
S0 (today)   import-only: Game -> DB (6h sync + gate)
   |  S1-gate: ratify this RFC + open-question resolutions
S1 shadow    exporter exists, runs read-only: renders released snapshot to a
             temp tree, diffs against a Game checkout, emits a fidelity report.
             NO writes to Game. Repeat per entity until diff = model-gap-only.
   |  S2-gate: fidelity report green on trait_glossary + trait_reference
S2 export    export-on-release for FIDELITY-COMPLETE entities only (traits
             first): branch + PR on Game with GENERATED headers; Eduardo merges.
             Manual edits on generated files = drift (scheduled drift-check
             fails loud). Import stays ON for non-exported entities; the 6h
             sync narrows to those (anti ping-pong, open question 7).
   |  S3-gate: all 4 entities fidelity-complete + N quiet cycles (no drift)
S3 export-only: import retired (gate flips to export-verify), DB is the single
             SoT for taxonomy content. Game pack catalog = build artifact.
```

**Fidelity invariant (all steps)**: for every exported entity set E,
`import --validate-only` over `export(snapshot)` reports 0 errors AND the upsert
diff against the DB is empty (no field changes round-trip). This is the KPI the
spec already names ("sync error rate"); S1's deliverable is precisely the tool
that measures it.

## Open questions (for Eduardo + coordinator)

1. **Export entity scope v1**: start traits-only (glossary + reference), the
   fidelity-complete core? Species likely next; ecosystems LAST (model gap).
2. **i18n model gap**: add explicit i18n fields (e.g. `nameEn`, `descriptionEn`
   or a `labels Json`) to masters + snapshots, or declare taxonomy it-only and
   let export duplicate it->en (current glossary behavior, zero schema change)?
3. **Ecosystem model gap**: extend the Ecosystem model toward the YAML manifest
   (spawn rules etc.), keep ecosystems import-only indefinitely, or store the
   unmapped YAML remainder as an opaque `sourceExtras Json` round-trip field?
4. **Export trigger**: on release (synchronous hook on
   `POST /api/taxonomy/versions/:tag/release`), manual CLI only, or scheduled?
   (Recommend: manual CLI in S1/S2, hook later -- keeps the human in the loop
   while the flow is young.)
5. **Cross-repo PR actor**: who opens the Game PR -- a GH Action on this repo
   with a scoped PAT, the fleet dispatch script (Jules), or a local operator
   CLI? (Recommend: local operator CLI in S2 -- same trust model as today's
   manual import; automation is an S3 question.)
6. **`data/core/*` runtime files**: export targets ONLY the pack catalog
   (importer's input set). Game deriving `data/core/*` from the pack stays a
   Game-side concern -- confirm as explicit non-goal? (Recommend: yes.)
7. **6h sync job in S2**: restrict `evo-import-sync.yml` to non-exported
   entities (or convert to drift-check-only) to prevent import/export ping-pong
   on the same fields -- which form?
8. **Game canon authority**: exported content lands under Game's authority map
   (A0..A5) and canon gates. Does DB-origin content need an authority-map entry
   on the Game side before S2? (Cross-repo doc touch, Eduardo-gated.)

## Risk matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Import/export ping-pong (6h sync re-importing exported files) | High | S2 narrows sync scope (Q7); fidelity invariant makes a clean round-trip a no-op by construction |
| Lossy export silently degrades Game data (ecosystems, i18n) | High | Entity flips gated on fidelity report (S1 tool); lossy entities stay import-only until model gap closed |
| Manual edits on generated files (drift) | Med | GENERATED header + scheduled drift-check failing loud; PR review on Game |
| Cross-repo PR automation credential scope | Med | S2 uses local operator CLI (no standing credential); automation deferred to S3 ratification |
| Canon authority conflict on Game side | Med | Q8 resolved before S2; export lands via PR under existing Game gates (evo-import-gate) |
| Exporter drifts from importer expectations over time | Low | Round-trip test in CI: export fixture -> import --validate-only must stay green |

## Acceptance criteria (S1 -- first implementation PR chain, after ratification)

- [ ] `server/scripts/export/export-taxonomy.js --version <tag> --out <dir>`
      renders trait_glossary.json + trait_reference.json from a released
      snapshot (read-only w.r.t. Game; writes only to `--out`).
- [ ] `--diff <game-checkout>` mode: machine-readable fidelity report
      (per-entity: exported / matching / divergent / model-gap fields).
- [ ] Round-trip check wired as a test: `import --validate-only` over the
      export fixture = 0 errors; documented in the PR.
- [ ] Field inventory appendix: trait_reference.json fields vs Trait model
      (closes the residual-gap unknown in "Current state" #3).
- [ ] No writes to the Game repo, no schema changes, no new prod dependencies
      without approval.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` (Fase 3 deliverable 4, migration plan + KPI)
- RFC #1: `docs/rfc/2026-05-21-schema-versioning.md` (snapshots = export input; #180 completed versioned reads for all 4 masters)
- Import pipeline: `server/scripts/ingest/import-taxonomy.js` + `docs/process/evo-import.md`
- CI: Game `evo-import-gate.yml` (dry-run gate), this repo `evo-import-sync.yml` (6h scheduled import)
- Game consumers: `apps/backend/services/catalog.js`, `apps/backend/services/traitRepository.js`, `packages/contracts/schemas/glossary.schema.json`
- Governance: external-repo boundary (branch+PR, merge Eduardo-only); Game authority map `docs/planning/EVO_FINAL_DESIGN_SOURCE_AUTHORITY_MAP.md`
