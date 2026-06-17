# RFC #4: Bidirectional sync -- DB as taxonomy source-of-truth (scoping)

**Date**: 2026-06-11
**Author**: coordinator session (Lenovo, claude-fable-5)
**Status**: RATIFIED 2026-06-11 -- Eduardo resolved all 8 open questions (see "Ratified resolutions"); merged as scoping draft in #182 same day. Option B + ladder S0->S3 binding; S1 split into S1a (i18n model extension) + S1b (shadow exporter) per OQ2 override. No implementation in this RFC.
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

## Ratified resolutions (Eduardo, 2026-06-11 -- AskUserQuestion recommended-first, 2 rounds)

6 of 8 follow the RFC recommendation; OQ2 and OQ6 are explicit overrides, both in
the direction "full end-to-end fidelity" (export must carry complete data -- en
included -- all the way into Game's runtime files).

| # | Question | Ratified | Note |
|---|---|---|---|
| 1 | Export entity scope v1 | **Traits-only** (glossary + reference) | Species/ecosystems promoted only after a green fidelity report |
| 2 | i18n model gap | **OVERRIDE: add explicit i18n fields NOW** (`nameEn`/`descriptionEn` on Trait; labels-Json variant rejected) | en source data still lives in Game's trait_glossary.json -> backfill via re-import. Snapshot tables gain nullable columns + FIELD_MAP extension (old snapshots stay null -- frozen-set comment in versionSnapshot.js amended in the same PR) |
| 3 | Ecosystem model gap | **Import-only for now** | Extend-vs-sourceExtras decided AFTER S1 fidelity report quantifies the gap |
| 4 | Export trigger | **Manual CLI in S1/S2** | Release-hook automation = S3 question |
| 5 | Cross-repo PR actor | **Local operator CLI** | No standing credential; automation re-discussed at S3 |
| 6 | `data/core/*` runtime files | **OVERRIDE: export INCLUDES `data/core/*`** (non-goal rejected) | Export surface = pack catalog + derived runtime files (e.g. `data/core/traits/glossary.json`). Interaction with Game-internal mechanisms (`data/traits/index.json`, `_versions/` snapshots) is S2 design work and MUST be co-designed with a Game-side session; S1b fidelity report covers data/core targets too |
| 7 | 6h sync job in S2 | **Narrow + drift-check** | Scheduled import restricted to non-exported entities; exported entities get a read-only drift-check failing loud |
| 8 | Game canon authority | **Yes, prerequisite for S2** | One-line entry in Game's EVO_FINAL_DESIGN_SOURCE_AUTHORITY_MAP declaring Game-Database SoT for released taxonomy content; cross-repo doc PR, Eduardo merge |

**Ladder impact (OQ2)**: S1 splits -- **S1a** = i18n model extension (migration:
nullable `nameEn`/`descriptionEn` on Trait + TraitVersion, FIELD_MAP + import
pipeline extension to populate en, backfill via re-import from Game files) ships
BEFORE **S1b** = shadow exporter + fidelity report (else en would false-flag as
model-gap). **Surface impact (OQ6)**: S1b report and S2 exporter target both the
pack catalog AND the derived `data/core` files.

## Risk matrix

| Risk | Severity | Mitigation |
|---|---|---|
| Import/export ping-pong (6h sync re-importing exported files) | High | S2 narrows sync scope (Q7); fidelity invariant makes a clean round-trip a no-op by construction |
| Lossy export silently degrades Game data (ecosystems, i18n) | High | Entity flips gated on fidelity report (S1 tool); lossy entities stay import-only until model gap closed |
| Manual edits on generated files (drift) | Med | GENERATED header + scheduled drift-check failing loud; PR review on Game |
| Cross-repo PR automation credential scope | Med | S2 uses local operator CLI (no standing credential); automation deferred to S3 ratification |
| Canon authority conflict on Game side | Med | Q8 resolved before S2; export lands via PR under existing Game gates (evo-import-gate) |
| Exporter drifts from importer expectations over time | Low | Round-trip test in CI: export fixture -> import --validate-only must stay green |

## Acceptance criteria (S1a + S1b -- first implementation PR chains, post-ratification)

### S1a -- i18n model extension (ships first, per OQ2)

- [ ] Migration: nullable `nameEn` + `descriptionEn` on Trait AND TraitVersion
      (authored via `prisma migrate diff`, applied via `migrate deploy` --
      Migration discipline #159).
- [ ] FIELD_MAP.trait extended with the 2 fields (frozen-set comment in
      versionSnapshot.js amended); old snapshots stay null by design.
- [ ] Import pipeline populates en: `label_en`/`description_en` no longer
      collapsed away (import-taxonomy.js pickText split it/en).
- [ ] Backfill: one re-import run from Game files restores en for existing rows;
      row-count + sample diff documented in the PR.
- [ ] Glossary route serves stored en when present (fallback it unchanged);
      existing tests stay green.

### S1b -- shadow exporter + fidelity report

- [ ] `server/scripts/export/export-taxonomy.js --version <tag> --out <dir>`
      renders trait_glossary.json + trait_reference.json AND the derived
      `data/core` trait files (OQ6) from a released snapshot (read-only w.r.t.
      Game; writes only to `--out`).
- [ ] `--diff <game-checkout>` mode: machine-readable fidelity report
      (per-entity, per-target: exported / matching / divergent / model-gap
      fields), covering pack catalog + data/core targets.
- [ ] Round-trip check wired as a test: `import --validate-only` over the
      export fixture = 0 errors; documented in the PR.
- [ ] Field inventory appendix: trait_reference.json fields vs Trait model
      (closes the residual-gap unknown in "Current state" #3).
- [ ] No writes to the Game repo, no new prod dependencies without approval.

## Species export (Phase 2 scoping -- ratified 2026-06-17)

Traits completed the full ladder S1a->S2 (DB->Game loop live: Game
#2750/#2752/#2755/#2758, DB GATE chain G1..G6). RFC OQ1 promoted species "after a
green fidelity report"; Eduardo ratified species-FIRST (2026-06-14) and resolved
the species scope 2026-06-17 (AskUserQuestion, after a 69-vs-21 ground-truth
correction). The ground-truth claims below were adversarially verified against
Game/Game-DB code (6 verifiers, 0 refuted). This section scopes species;
biome/eco stay parked (YAML, separate scope).

### Current state (ground-truth, 2026-06-17)

- **Import (Game -> DB)**: the importer reads `defaultConfig.species` --
  `packs/evo_tactics_pack/docs/catalog/species/**/*.json` (21 per-file +
  index.json `.species[]`) AND `catalog_data.json` -- resolved by fast-glob in
  `main()`; `normalizeSpecies()` normalizes each parsed record. Event species are
  filtered by `isEventSpecies()` (trigger: `flags.event`, OR `role_trofico`
  containing 'evento', OR `display_name` starting with 'evento:'). `scientificName`
  falls back scientific_name -> binomial -> nomeScientifico -> display_name ->
  name -> id (most pack species have no binomial, so kingdom/phylum/class/order/
  family are mostly null or inferred). `description` is SYNTHESIZED by
  `buildSpeciesDescription` (role + biome) ONLY when the Game value is absent or
  an `i18n:` ref-key -- the pack case (cryo-lynx.json carries
  `i18n:species.cryo-lynx.description`); inline non-i18n prose would pass through
  verbatim.
- **Species model**: rich scalars + Json (trophicRole, functionalTags, flags,
  balance, vcCoefficients, spawnRules, environmentAffinity, jobsBias, telemetry)
  plus relations SpeciesTrait / SpeciesBiome / EcosystemSpecies / SpeciesVersion.
  FIELD_MAP.species lists exactly the 24 Species scalar/Json columns; #180 serves
  versioned species reads, so the released-snapshot input precondition is MET.
- **Model gap vs traits (provenance)**: Species has NO sourceKey/sourceFiles/
  sourceExtras (Trait gained all three in the reference cycle; FIELD_MAP.species
  deliberately omits them). Game per-file species carry rich Game-only structures
  (derived_from_environment, receipt, hazards_expected, path, genetic_traits,
  services_links, environment_affinity.koppen, spawn_rules.densita) with nowhere
  to round-trip, so a naive export is lossy-destructive.
- **Model gap vs traits (snapshot determinism -- verifier finding)**: the
  `speciesVersion` snapshot captures only the 24 scalar/Json columns, NOT the
  junctions (SpeciesBiome/SpeciesTrait). The trait exporter reads from the
  immutable `traitVersion` snapshot (deterministic) and never joins relations. A
  species exporter reading `speciesVersion` would therefore find NO biome
  membership in the snapshot. To keep the export snapshot-deterministic (not a
  live-table join), Sp1a must also capture biome membership (slug-array) into the
  snapshot.
- **Field shape**: DB camelCase vs Game snake_case (trophicRole/role_trofico,
  vcCoefficients/vc, spawnRules/spawn_rules, environmentAffinity/
  environment_affinity, jobsBias/jobs_bias, functionalTags/functional_tags,
  playableUnit/playable_unit) -- all mappings verified in import-taxonomy.js.
- **Relations**: biomes are a SpeciesBiome junction; Game emits `biomes:[slug]`.
  genetic_traits map to SpeciesTrait. Export must reconstruct slug arrays from
  junctions -- new vs traits (scalar/Json only).
- **canonical-index is downstream-generated**: `species-canonical-index.json`
  (69 species, richer schema) is GENERATED by Game
  `scripts/update_evo_pack_catalog.js` (writeJson at :358) from
  `data/core/species/species_catalog.json` (4-source merge: pack-v2-full-plus 10,
  game-canonical-stub 5, legacy-yaml-merge 38, gameplay-promote 16 = 69;
  events_excluded 6). The DB import does NOT read it and holds only the 21 pack
  species (species-index.json total_species 21), so it is NOT a direct DB export
  target.

### Reuse (from the traits GATE cycle, verified present)

- export-taxonomy.js diff engine: `canonicalize` (key-order-independent),
  `deepEqual`, per-target/per-field classification (matching / divergent /
  exported_only / game_only_model_gap / game_only_unexpected / header_drift),
  MODEL_GAP awareness, and the missing/unparsable-target guard (Codex P2 #187).
- export-shapes.js `orderObjKeys(dbObj, templateObj)`: order-preserving rendering
  used by renderGlossary/renderReference via a generic `template` argument. The
  Game-file templates are loaded in export-taxonomy.js (from the `--diff` root)
  and passed in. A species renderer reuses orderObjKeys with a per-file template.
- `snapshotToMaster()` is generic and FIELD_MAP-driven, so
  `snapshotToMaster('species', row)` already resolves FIELD_MAP.species (no
  change needed).
- `resolveReleasedVersion()` resolves a released TaxonomyVersion (404/400 guards).
- sourceExtras per-field-precedence + sourceKey-rank + sourceFiles-membership
  primitives (added to Species in Sp1a).

### Ratified resolutions (Eduardo, 2026-06-17)

| # | Question | Ratified | Note |
|---|---|---|---|
| S-Q1 | Game-only fields round-trip | **sourceExtras parity** | Add sourceKey/sourceFiles/sourceExtras to Species + speciesVersion snapshot + import populate (Sp1a), BEFORE the exporter. Mirrors trait S1c/S1d. Lossless round-trip + species-as-SoT. |
| S-Q2 | description (i18n ref-key vs synthesized) | **Non-exported model-gap** | Export omits `description` for species v1; drift-check ignores it. Pack species use `i18n:` ref-keys (DB value synthesized), so it would never round-trip. i18n bundles stay a separate subsystem (records=non-goal precedent). |
| S-Q3 | canonical-index inclusion | **Per-file surface, canonical regen downstream** | DB exports the 21 owned species -> per-file catalog + index.json. canonical-index stays Game-generated (update_evo_pack_catalog.js) downstream; NOT a direct DB target. No generator collision, no species drop. data/core/species (runtime YAML) deferred. |

### Ladder (mirrors traits S1a->S2)

```
Sp1a model    add sourceKey + sourceFiles + sourceExtras to Species +
              SpeciesVersion; capture biome membership (slug-array) into the
              snapshot so the export stays snapshot-deterministic;
              FIELD_MAP.species extension (frozen-set comment amended); import
              populates sourceExtras + the biome slug-array; backfill via
              re-import.
   |  gate: migration + backfill green, existing species tests pass
Sp1b shadow   export-taxonomy.js gains a species path: speciesVersion ->
              snapshotToMaster -> species renderer (camel->snake, biome
              slug-array from the snapshot, sourceExtras spread) -> per-file
              *.json + index.json; --diff fidelity report (read-only, writes
              only to --out). Round-trip: import --validate-only over export
              = 0 errors.
   |  gate: fidelity report green (matching, only intended model-gaps)
Sp2 export    export-on-release for species: branch + PR on Game (GENERATED
              headers); Eduardo merges. Drift-check on species pack files.
              canonical-index regenerates downstream via Game's generator.
```

### Acceptance criteria (Sp1a + Sp1b -- first PR chains, post-ratification)

**Sp1a -- Species provenance + snapshot determinism (ships first)**
- [ ] Migration: nullable `sourceKey` + `sourceFiles` + `sourceExtras` on Species
      AND SpeciesVersion (prisma migrate diff -> migrate deploy, discipline #159).
- [ ] Capture biome membership for snapshot determinism: store the biome
      slug-array as a snapshotted field (e.g. `biomes Json` on Species +
      SpeciesVersion, populated from the SpeciesBiome junction at import) OR fold
      it into sourceExtras -- so the exporter reconstructs `biomes:[slug]` from
      the released snapshot, never a live junction join.
- [ ] FIELD_MAP.species extended with the new fields (frozen-set comment in
      versionSnapshot.js amended; old snapshots stay null).
- [ ] import `normalizeSpecies` populates sourceExtras from unmapped Game-only
      fields, sourceKey from the source slug/id, sourceFiles from membership, and
      the biome slug-array.
- [ ] Backfill: one re-import restores the new fields; row-count + sample diff
      documented in the PR.
- [ ] Existing species tests stay green.

**Sp1b -- Species shadow exporter + fidelity report**
- [ ] export-taxonomy.js `--version <tag> --out <dir>` renders per-file
      `docs/catalog/species/<slug>.json` + `index.json` from a released snapshot
      (camel->snake; biome slug-array from the snapshot; sourceExtras spread back;
      events excluded; `description` omitted per S-Q2).
- [ ] `--diff <game-checkout>` species fidelity report (per-file + index)
      reusing the trait diff engine; canonical-index NOT compared.
- [ ] Round-trip test: import --validate-only over the species export = 0 errors.
- [ ] Field inventory appendix: Species model + sourceExtras vs Game per-file
      fields (intended model-gaps enumerated, e.g. description).
- [ ] No writes to the Game repo; no new prod dependencies without approval.

### Open items (resolve during Sp1a/Sp1b, not blocking dispatch)

- Snapshot vessel for biome membership (dedicated `biomes Json` snapshot field vs
  sourceExtras) -- decide in Sp1a; genetic_traits (SpeciesTrait) likewise if
  exported.
- index.json is a summary projection (subset of per-file fields) -- the exporter
  emits the summary shape for index, the full shape per-file; confirm the field
  subset during Sp1b.
- environmentAffinity.koppen / spawn_rules.densita: confirm these are DB-mapped
  (Json) vs sourceExtras during the Sp1b field inventory.

## Species fidelity gap-closing (Sp1c -- ratified 2026-06-17)

The Sp1b shadow exporter shipped (#216). The first real fidelity run
(fidelity-report.yml run 27697871099, against a released snapshot rebuilt from a
Game checkout) measured species fidelity as NOT green -- exactly the S1-shadow
purpose (measure the gap before any S2 write). Counts: matching 258, divergent 8,
game_only_model_gap 17, game_only_unexpected 53, targetMissing 22 (39 DB species
vs ~21 catalog-tier). Sp1c closes the five gap categories below.

### Gaps + ratified fixes (Eduardo, 2026-06-17)

| Gap | Root cause (evidence) | Resolution |
|---|---|---|
| `id` missing (x17) | renderSpecies omits the per-file `id` field | **Fix**: emit `id` = species slug. |
| `sourceExtras` nulled (x7: derived_from_environment / receipt / genetic_traits / services_links) | Dual-source upsert -- the rich per-file species record AND the light `catalog_data.json` record upsert the same slug; last-write-wins (worsened by the Sp1a `?? null` update) nulls the rich sourceExtras when the light record is processed last | **Fix**: merge species records per-slug with field-precedence (the rich per-file source wins for the unmapped Game-only fields), mirroring `mergeTraitRecords`. |
| `biomes` divergent (x8) | Slug-normalization ONLY: Game files carry non-canonical biome strings (`FORESTA_TEMPERATA`, `foresta_temperata`) while the DB junction stores canonical slugs (`foresta-temperata`) -- same set, different form | **Ratified**: the fidelity diff slug-normalizes both sides before comparing `biomes` (normalization-only -> matching); the exporter emits canonical slugs, so S2 canonicalizes the Game files' biome casing (a consistency improvement). |
| `last_synced_at` (x17) | Game-authored sync timestamp, not DB-owned | **Ratified**: add to the species MODEL_GAP -- non-exported, drift-check ignores it (same class as `description`, S-Q2). |
| targetMissing (x22) | The DB holds ~18 ecosystem-derived species (extracted from `data/species/<biome>/*.yaml` + ecosystem YAMLs at import) that have no `docs/catalog/species/*.json` per-file | **Ratified**: filter the export to the catalog-tier (species that have a `docs/catalog/species/` per-file). Requires real `sourceFiles` membership -- Sp1a hardcoded `['species-catalog']`; Sp1c makes it source-faithful (catalog-per-file vs ecosystem-derived vs catalog_data). Ecosystem-derived species stay on their own surface, NOT exported to docs/catalog. Mirrors the trait exporter's sourceFiles filter. |

### Acceptance (Sp1c)

- [ ] renderSpecies emits `id` (= slug); `last_synced_at` added to the species
      MODEL_GAP (non-exported, classified game_only_model_gap by the diff).
- [ ] Import: species records merged per-slug with field-precedence so the rich
      per-file fields (sourceExtras) survive the light catalog_data.json record;
      `sourceFiles` reflects the real source(s) (catalog-per-file /
      ecosystem-derived / catalog_data), not a hardcoded constant.
- [ ] Exporter filters to catalog-tier species (sourceFiles includes the
      catalog-per-file marker); ecosystem-derived species are not emitted.
- [ ] Fidelity diff slug-normalizes `biomes` before comparing
      (normalization-only difference = matching).
- [ ] A fresh fidelity-report.yml run on the catalog-tier shows GREEN: 0
      divergent, 0 game_only_unexpected, 0 targetMissing; only the intended
      model-gaps (`description`, `last_synced_at`).
- [ ] Existing trait export + species tests stay green. ASCII-only. No new
      production dependencies.

S2 (export-on-release, PR-to-Game) stays gated on this green fidelity + Q8 (a
Game canon-authority map entry for DB-origin species) + the cross-repo actor
decision (OQ5: local operator CLI).

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` (Fase 3 deliverable 4, migration plan + KPI)
- RFC #1: `docs/rfc/2026-05-21-schema-versioning.md` (snapshots = export input; #180 completed versioned reads for all 4 masters)
- Import pipeline: `server/scripts/ingest/import-taxonomy.js` + `docs/process/evo-import.md`
- CI: Game `evo-import-gate.yml` (dry-run gate), this repo `evo-import-sync.yml` (6h scheduled import)
- Game consumers: `apps/backend/services/catalog.js`, `apps/backend/services/traitRepository.js`, `packages/contracts/schemas/glossary.schema.json`
- Governance: external-repo boundary (branch+PR, merge Eduardo-only); Game authority map `docs/planning/EVO_FINAL_DESIGN_SOURCE_AUTHORITY_MAP.md`
