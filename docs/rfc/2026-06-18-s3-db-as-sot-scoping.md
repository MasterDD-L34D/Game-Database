# S3 scoping: DB-as-SoT authoring migration (RFC #4 follow-on)

**Status: SCOPING (not ratified).** Co-design input for a Game-led session.
Prepared 2026-06-18 from a read-only recon (schema gap + runtime consumers +
migration mechanics). Parent: `docs/rfc/2026-06-11-bidirectional-sync.md`
(RFC #4, "Species S2" + the 2026-06-18 amendments). This brief does NOT ratify
anything -- it frames the decision.

## Context

RFC #4 S2 is closed across all four entities: traits export-shipped (live),
species fidelity-shadow, biome + ecosystem import-only. The single remaining
RFC #4 ambition is **S3: make the Game-Database DB the source-of-truth (SoT) for
taxonomy authoring**, so one generator owns each surface (resolving the
SoT inversion that rescoped species/biome/eco to shadow). This brief scopes what
that migration would entail and surfaces the decisions a co-design must make.
Authoring, runtime consumers, and the pack generators all live in Game and the
DB is currently downstream -- so the co-design is **Game-led**.

## Finding 1 -- schema gap (large)

The DB models a thin, gameplay-relevant subset; the authored surfaces are far
richer:

| Entity | DB columns (approx) | Authored fields (approx) | Examples the DB does NOT model |
| --- | --- | --- | --- |
| Species | ~36 | ~60 (`species_catalog.json` v0.4.x) | ecology, interactions (predates/predated/symbiosis), risk_profile, constraints, sentience_index, ecotypes, lifecycle_yaml, clade_tag, role_tags, default_parts, functional_signature, visual_description |
| Biome | ~14 | ~150 (`*.biome.yaml` v1.1) | morfologia, composizione_aria, detailed clima/precip/vento/bilancio_idrico, abiotico, trofico, gruppi_funzionali (10), suolo, acque, servizi_ecosistemici, pressioni_stato_risposte, rules manifest |
| Ecosystem | ~5 | ~30+ (`*.ecosystem.yaml`) + biome-inherited | detailed clima/composizione_aria/abiotico/trofico, note, rules |

The `*Version` snapshot tables mirror the thin DB columns, so a release snapshot
also drops the rich fields. `schema_version` + receipt (author/date/trace_hash)
provenance are not modeled either.

**Implication:** DB-as-author requires either (a) extending the schema to model
~150-field biome / ~60-field species structures (a very large schema + UI +
migration effort), or (b) absorbing the authored docs wholesale into
`sourceExtras` JSON -- which stores them but does not *model* them, undermining
the value of DB-as-SoT (it becomes a JSON blob store, not a queryable model).

## Finding 2 -- consumer blast radius (~25 classes)

The authored data is read at ~25 distinct points, each loading independently
with its own path resolution and (for species) a primary/fallback chain
(`species_catalog.json` + legacy YAML, ADR-2026-05-15):

- JS services: vcScoring, synergyDetector, biomeResonance, speciesBaseStats,
  biomePoolLoader, ecosystemResolver, biomeAdapter, foodwebFilter, traitEffects,
  wikiLinkBridge (+ biomeModifiers, biomePopulation).
- Python tools: `tools/py/lib/species_loader.py` + validators / ETL.
- REST routes: speciesWiki, speciesBiomes (already DB-backed), generation.
- Tests: inject custom file paths as fixtures.
- Godot frontend (separate repo): consumes biome/pressure/hazards via the
  biomeAdapter REST mirror.

No single endpoint serves all three classes, so a DB-as-SoT migration is a
scattered re-point with a caching-strategy decision (in-memory vs file-snapshot
vs hybrid) and an offline/batch question (Dafne / swarm / AI-playtest without DB).

## Finding 3 -- migration mechanics + missing machinery

- The DB already has CRUD UI + write routes for Species/Biome/Ecosystem, so
  authoring *could* move into the DB.
- BUT there is no biome/ecosystem exporter and no YAML emitter (only trait
  glossaries + per-file species render; species export is gated to
  fidelity-shadow). For the DB to be the single generator it would have to emit
  `catalog_data.json` + per-file species JSON + the biome/ecosystem YAML +
  indices, retiring Game's `sync:evo-pack`.
- Superset unresolved: `species_catalog.json` holds 75 species (4-source merge);
  only 21 are in the active `catalog_data.json` biome roster; 22 per-file
  species exist. The active/canonical/legacy split must be reconciled before
  the DB can own authoring.
- Reversibility: high for traits (already shipped from DB), medium for species
  (shadow), low for biome/ecosystem (no exporter, deeper YAML dependency, no
  per-file surface).

## Co-design questions (Game-led)

1. **Authoring locus (gating):** do authors edit in the DB UI going forward, or
   stay file-first (`species_catalog.json` + YAML)? Everything else follows.
2. **Schema strategy:** model the rich authored fields as real columns / nested
   tables, or absorb into `sourceExtras` JSON? (model = huge; blob = low value.)
3. **Generator unification:** does the DB become the single generator (emit
   catalog_data + per-file species + YAML + indices), retiring `sync:evo-pack`?
   That needs a YAML emitter that does not exist.
4. **Consumer re-point + caching:** DB API vs DB-generated files; in-memory vs
   file-snapshot; Godot REST mirror; Python tooling; offline / batch.
5. **Superset reconciliation:** what is the 75 vs 21 vs 22 species split --
   active catalog, legacy debt, or multi-tier?
6. **Versioning / provenance:** model `schema_version` + receipt
   (author/date/trace_hash), or relegate to `sourceExtras`?
7. **Reversibility / sequencing:** per-entity, phased, deprecation window,
   fidelity gates, operator-controlled (manual PR like taxonomy-export.yml).

## Recommendation (analysis hypothesis -- co-design decides)

> SDMG note: this recommendation is a hypothesis from a single read-only recon,
> not a decision. The Game-led co-design (with external falsification) owns the
> verdict.

The schema gap (40+ fields/entity), the ~25-consumer blast radius, the missing
biome/eco exporter + YAML emitter, and the unresolved superset together make a
full DB-as-SoT migration a large, high-risk, multi-month effort with uncertain
ROI. The authored surfaces are designed for rich, file-first, human + ETL
authoring; the DB deliberately models a thin gameplay-relevant subset.

**The premise "the DB should be the SoT for all taxonomy authoring" is worth
re-examining rather than assuming.** The current architecture -- files
(`species_catalog.json` + YAML) as the authoring SoT, the DB as the downstream
queryable / normalized shadow, plus the DB as the export-SoT for traits (where
it already works) -- may be the right long-term steady state, not a temporary
S2 compromise. If any DB-as-SoT is still wanted, the lower-risk path is to scope
it NARROWLY to the gameplay subset the DB already models, leaving the rich
authoring in files.

## If pursued anyway -- sequencing sketch

1. Resolve the species superset (active vs legacy) first -- it gates everything.
2. Decide the schema strategy per entity; if modeling, start with species
   (smallest gap), defer biome/eco (largest gap, no exporter).
3. Build the missing generator machinery (biome/eco exporter, YAML emitter) +
   fidelity gates before any consumer re-point.
4. Re-point consumers behind a file-snapshot the DB generates (keep the
   file-read contract; swap the producer) to bound the blast radius and keep
   offline / batch working.
5. Retire `sync:evo-pack` only after the DB generator reaches parity (fidelity
   green on every surface).

## References

- RFC #4: `docs/rfc/2026-06-11-bidirectional-sync.md` (Species S2 + 2026-06-18
  amendments: species fidelity-shadow #225/#226, biome/eco import-only #227).
- ADR-2026-05-15 (Game): species catalog schema fork resolution (Option A;
  `species_catalog.json` v0.4.x = canonical authored SoT).
- codemasterdd memory: `project_rfc4_species_s2`.
