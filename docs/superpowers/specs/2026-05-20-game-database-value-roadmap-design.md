# Game-Database — Value Roadmap (Hybrid Short-Term + Vision)

**Date**: 2026-05-20
**Author**: parallel-#2 session (Ryzen, Claude opus-4.7)
**Status**: DRAFT — awaiting Eduardo review
**Scope**: Game-Database repo Fase 1 execution + Fase 2/3 vision tail across Evo-Tactics repo set

## Context

Evaluation of work done in parallel-#2 session (2026-05-20):

| PR | Scope | Status | SHA |
|---|---|---|---|
| #115 | Cleanup 3 untracked (gitignore .claude + AGENTS.md + species_catalog_53.json relocate) | MERGED | 1dda005 |
| #116 | Coverage masters CRUD (+21 test PUT traits/biomes/species + DELETE traits/biomes/ecosystems) | MERGED | 69af82d |
| #117 | utils.js restore() contract-fix + regression test | MERGED | b4bd1be |

Net delta: +3995 LOC, +22 test (107/107 verde), 3/3 PR CI green, 100% squash-merge, full handoff protocol respected.

## Problem statement

Game-Database role today = taxonomy CMS for Evo-Tactics, ma source-of-truth ambigua: Game (sibling repo) static files = canonical input via `npm run evo:import`, MA Game runtime può consumare HTTP `GET /api/traits/glossary` quando `GAME_DATABASE_ENABLED=true`. Bidirectional ambiguity confonde "valore reale" del DB.

User-picked value dimensions (2026-05-20 brainstorming):

1. **Strumento collaborativo designer** — dashboard UI per editing taxonomy, audit history, no git/PR per ogni modifica
2. **Validazione + integrità dati** — DB enforce constraint impossibili in static files (unicità slug, FK, range, allowedValues)
3. **Foundation features future** — abilita queries impossibili (semantic search, versioning, branch/staging, A/B test)

User-picked timeline: **Hybrid** — short-term execution (3-5 PR concrete) + vision tail (Fase 2 + Fase 3 sketches).

User-picked Fase 1 approach: **A — Integrity-first** (lowest-friction, zero NO-GO conflict, foundation per Fase 2/3).

## Architecture decision

**Game-Database = enhancement layer, NOT source-of-truth replacement.**

Static files Game restano canonici per Fase 1+2. Fase 3 valuta inversion via RFC con coordinator + Eduardo sign-off.

Stacked 3-fase model:

```
Fase 1 (now, 1-2 sprint)   →  Integrity foundation     →  Game-Database only
Fase 2 (1-2 mesi)          →  Designer-tool UI         →  Game-Database + dashboard
Fase 3 (Q3+, RFC-gated)    →  Strategic foundation     →  Cross-repo (Game touch)
```

Foundation rationale: Fase 1 piazza prerequisiti utili a tutte 3 dimensioni user-picked. Audit endpoint (PR-δ) abilita Fase 2 history UI. Validator hardening (PR-α) abilita Fase 3 versioning consistency. Schema doc (PR-γ) abilita drift detection long-term.

## Fase 1 — PR plan (5 PR, ~1850 LOC, Game-Database only)

### PR-α: Validator hardening — slug normalization edge cases

**Files**: `server/utils/taxonomyValidation.js` + new edge tests
**Gaps** (audit ground-truth required during PR):
- Unicode handling (`"Lùpus rufus"` → `"lùpus-rufus"` vs `"lupus-rufus"`)
- No truncation max-length (slug 500+ char accepted → DB index bloat)
- Trailing/leading dash post-normalize inconsistente
- Empty slug fallback inconsistente (alcuni route accettano null, altri throw)

**Approach**: lockdown regex OR adopt `slugify-strict`-style lib. Harmonize behavior across routes.

**Quality gates**:
- Smoke: 15+ edge tests verde
- Research: 3+ scenarios documented in `docs/research/slug-normalization-2026-05-20.md`
- Tuning: pre/post collision rate on seed measured

**LOC**: +200/-30

---

### PR-β: Junction endpoints coverage closure

**Files**: `server/test/ecosystemBiomes.test.js` + `ecosystemSpecies.test.js` + `speciesTraits.test.js` + `speciesBiomes.test.js`

**Gaps** (verify ground-truth pre-implementation):
- `ecosystemBiomes` PATCH validation edge (proportion out-of-range)
- `ecosystemSpecies` DELETE shape vs `species/ecosystem.delete` consistency
- `speciesTraits` PATCH 409 conflict (duplicate species+trait+category)
- `speciesBiomes` PATCH 404 + 403 path

**Approach**: mirror pattern PR #114/#116 (200/4xx/404/403 cases per endpoint).

**Quality gates**:
- Smoke: ~15 new tests verde
- Research: full audit junction matrix in `docs/research/junction-coverage-2026-05-20.md`
- Tuning: full suite duration delta <5%

**LOC**: +400/-0

---

### PR-γ: Schema doc auto-gen from Prisma

**Files**: `server/scripts/generate-schema-doc.js` (new) + npm script + `.github/workflows/schema-doc-check.yml`

**Cosa fa**: legge `prisma/schema.prisma` → emette `docs/schema-reference.md` (entità/campi/relazioni/indici). CI fail se doc out-of-sync.

**Existing drift caught**: `modal-game-database.md` cita Postgres 15, `docker-compose.yml` usa Postgres 16.

**Quality gates**:
- Smoke: script idempotent (2 run = no-diff)
- Research: 3 schema mutation drift test cases
- Tuning: gen time <2s

**LOC**: +150 script + ~400 generated doc / -manuali stale

---

### PR-δ: Audit history read endpoint

**Files**: `server/routes/audit.js` (new), `server/prisma/migrations/<ts>_audit_index/migration.sql`

**Endpoint**: `GET /api/audit?entity=X&entityId=Y&limit=N&page=M`

**Cosa fa**: legge AuditLog table (popolata da tutte le mutations), paginate, RBAC `audit:read` role default-open, configurabile via `AUDIT_READ_ROLES` env var.

**Foundation per**: Fase 2 audit history UI + Fase 3 versioning.

**Quality gates**:
- Smoke: GET success + filter + pagination + 403 RBAC test
- Research: query performance on 10k AuditLog rows EXPLAIN ANALYZE
- Tuning: add index `(entity, entityId, createdAt DESC)` if absent + measure

**LOC**: +150/-0 + migration

---

### PR-ε: evo:import pre-commit validator

**Files**: `server/scripts/ingest/import-taxonomy.js` enhancement

**Flag**: `--validate-only`

**Cosa fa**: gira tutta validation senza scrivere DB; emette report machine-readable JSON; exit 1 se conflitti. Game-side CI può chiamare prima di merge.

**Quality gates**:
- Smoke: dry-run su seed pulito = exit 0; corrupt fixture = exit 1 + JSON report
- Research: tipi conflitto enumerati (slug dup, FK orphan, invalid range) in `docs/research/import-validation-2026-05-20.md`
- Tuning: validate-only <5s su `server/test/fixtures/species_catalog_53.json` (53-species fixture relocated PR #115)

**LOC**: +250/-50

---

## Fase 1 sequencing & dependency graph

```
PR-α (slug) ──┬─→ PR-γ (schema doc, references slug)
              └─→ PR-ε (import validator, uses slug rules)

PR-β (junction) ──→ independent
PR-δ (audit endpoint) ──→ independent
```

**Suggested order**: α → β (parallel-OK) → γ → δ → ε. Wall-time estimate 1-2 settimane.

## Cross-repo coordination & NO-GO contract

| Repo | Fase 1 policy | Note |
|---|---|---|
| Game-Database | OWN, write OK | Tutti PR α-ε |
| Game | NO-TOUCH | A6/COOP sessions own; integration tested via Game-Database `evo:import` (read-only) |
| Game-Godot-v2 | NO-TOUCH | Subagent live (Godot #284 DRAFT) |
| vault | NO-TOUCH | Eduardo-sovereign + parallel governance |
| codemasterdd-ai-station | append-only handoff | Solo `docs/sessions/2026-05-19-continuity-handoff.md` per parallel-session protocol |

**Handoff protocol per ogni PR**:
1. Pre-start: append `[parallel-#2 OWNING Game-Database branch X start <ts>]` line locale
2. Pre-merge: post `[parallel-#2 DONE PR #N URL finish <ts>]` locale
3. Post-merge: post `[parallel-#2 MERGED PR #N squash <sha> finish <ts>]` locale
4. Local commit codemasterdd-ai-station — push delegato coordinator (NO-cross-repo per esplicito prompt)

**Conflict avoidance**:
- Pre-start: `gh pr list --state open` Game-Database — coord se altra sessione PR aperti
- Jules-cluster: 0 open al 2026-05-20T09:55Z; se arrivano oggi, pre-triage prima di PR-ε

**Cross-repo escalation Fase 2/3**:
- Touch fuori Game-Database = RFC-first in `docs/rfc/YYYY-MM-DD-<topic>.md`
- RFC review-gate coordinator session (#1 Ryzen) sign-off prima implementare
- Eduardo-sovereign final approval su structural changes cross-repo

## Commit policy (ADR-0011)

- Trailers `Coding-Agent: claude-opus-4.7` + `Trace-Id: <uuidv7>` obbligatori
- NO `Co-Authored-By` GitHub trailer (forbidden)
- Squash merge style + PR# suffix (repo convention osservata #105-117)

## Vision tail

### Fase 2 — Designer-tool (1-2 mesi, ~8-10 PR)

**Prerequisito**: Fase 1 completata (audit endpoint PR-δ + validator hardened PR-α).

1. **Audit history UI** (consume PR-δ): dashboard panel `History` per entity, timeline view + JSON-aware diff renderer
2. **Bulk edit**: multi-select TanStack Table + batch edit dialog + optimistic UI + rollback partial failure
3. **Search-as-you-type**: debounced query + `?q=` filter (already supported) + hit count + pg_trgm fuzzy index
4. **Undo via AuditLog rollback**: `POST /api/audit/:logId/revert` + UI button + RBAC `audit:revert`
5. **Taxonomy diff view**: 2-snapshot git-style diff (foundation per Fase 3 versioning)

**Boundary check**: tocca `Game-Database/apps/dashboard/` (React+MUI+TanStack). A6 session lavora `Game/apps/dashboard/` (Vue3) — stack + repo diverso, zero overlap. Coordinator pre-start.

### Fase 3 — Foundation-future (Q3+, ~10-15 PR + RFC chain)

**Prerequisito**: Fase 2 audit/diff infrastructure stabile.

1. **Schema versioning**: `taxonomy_version` table (semver) + `version_id` on entities + `GET /api/taxonomy/versions` + Game build-time version pin flag
2. **Branch/staging**: Postgres schema-per-branch (`taxonomy_staging` vs `taxonomy_main`) + promote-to-main workflow + playtest pin
3. **Semantic search**: pg_trgm + tsvector index su descriptions + `GET /api/search?q=...&entities=trait,biome` ranked
4. **Bidirectional sync** (RFC + implementation): Game ↔ DB canonical flow review. Migration plan: Fase 1 import-only → Fase 2 dual-write → Fase 3 export-only. **Cross-repo, Eduardo-sovereign gate mandatory**.
5. **A/B test bilanciamento** (research preview): 2 schema variants per Species/Trait + playtest telemetria audit metadata + ML correlation trait combos → success metrics

**Boundary risk**: Fase 3 componente 4 tocca Game. RFC-first, coordinator + Eduardo gate.

### Dimension → component mapping

| User-picked dimension | Fase 1 (now) | Fase 2 | Fase 3 |
|---|---|---|---|
| Designer-tool (2) | (audit endpoint = foundation) | bulk edit + history UI + search + undo + diff | branch/staging UI |
| Integrità (3) | validator hardening + junction coverage + schema doc + import gate | (gate enforcement in UI) | schema versioning consistency |
| Foundation future (4) | (audit endpoint + schema doc = scaffolding) | (diff infrastructure) | versioning + branch + semantic + sync |

Pattern: Fase 1 = foundation utile a tutte 3 dimensioni; Fase 2 = designer-tool visible UX; Fase 3 = unlock strategic.

## Success metrics

### Fase 1 measurable outcomes

| PR | Pre-state | Post-state target | Misura |
|---|---|---|---|
| α slug hardening | Baseline measured at PR-α kickoff: collision rate seed + Unicode-stripped count + slug-length distribution | 0 collision + Unicode preserve (or explicit fallback configured) + max-length enforced | `npm run audit:slug` benchmark script (created in PR-α) |
| β junction coverage | Junction tests N = 38 (speciesTraits 13 + speciesBiomes 6 + ecosystemBiomes 13 + ecosystemSpecies 6) | 38 → ~53 (+15 tests), gap matrix all-verde documented in PR description | Coverage diff in PR body + full suite count delta |
| γ schema doc auto-gen | Manual `modal-game-database.md` stale vs schema reality (Postgres15 doc vs Postgres16 compose drift caught example) | 0 drift, CI fail su out-of-sync, gen idempotent | CI check `schema:doc:check` (created in PR-γ) |
| δ audit endpoint | 0 read-access AuditLog table (writes-only currently) | `GET /api/audit?entity=X&entityId=Y&limit&page` 200 functional + RBAC 403 + pagination | `curl /api/audit?entity=Trait` smoke + Playwright E2E |
| ε import validator | Manual catch upstream Game schema break (no automated gate) | `--validate-only` flag exit-1 corrupt fixture + JSON machine-readable report | Test su corrupted variant of `species_catalog_53.json` |

### Aggregate Fase 1 KPI

- Test count: 107 → ~140 (+30 stimati)
- Validator edge-case coverage: pre-measure at PR-α kickoff → enumerated + targeted per `docs/research/slug-normalization-2026-05-20.md`
- CI green rate: maintain 100% (baseline 3/3 PR scorse)
- Lead-time PR: target <2h apertura→merge (mediana #115/#116/#117 = ~30min)

### Fase 2 KPI

- Designer task completion time delta (audit history navigation, bulk edit batch size N)
- Dashboard E2E coverage Playwright +20 scenari

### Fase 3 KPI

- Game runtime cache hit rate (DB live vs static)
- Version-pin adoption % builds Game
- Bidirectional sync sync-time + error rate

### Quality gates per PR (CLAUDE.md Release Standard)

1. **Step 1 Smoke**: comando + risultato atteso + risultato reale documentato in PR Test Plan
2. **Step 2 Research**: 3+ edge case documentati in `docs/research/<component>-<YYYY-MM-DD>.md`
3. **Step 3 Tuning**: 1+ metric delta before/after in commit message body

## Risk + mitigations

| Failure | Probability | Mitigation |
|---|---|---|
| PR α slugify lib break dashboard parsing | Med | Smoke E2E inclusi, fallback config flag |
| PR β junction test flakiness | Low | Use existing `taxonomy.reset()` pattern proven 46/46 verde |
| PR γ generated doc churn in git diff | Med | Pre-commit hook + stable sort + idempotent gen |
| PR δ AuditLog query slow on 100k rows | Med | Index migration in same PR + EXPLAIN ANALYZE before/after |
| PR ε validate-only false positive | High | Conservative initial mode (warn-only), --strict opt-in |
| Cross-session conflict open PR Game-Database | Low | `gh pr list` pre-check + handoff OWNING append |
| Scope creep su PR α (slug ↔ everything) | High | Hardcap 1-entity-at-time, defer to PR α2 if needed |
| Vision tail Fase 2/3 mai eseguito | Med | Time-box review post-Fase-1: decision-point Eduardo |

## Resolved decisions (autoresearch 2026-05-20, cross-repo evidence-based)

All 4 originally-open questions answered via 4 parallel research agents with read-only cross-repo scope (Game-Database + Game + codemasterdd-ai-station, skip vault/Godot-v2).

### Q1 — Slug normalization: custom regex consolidated (NOT npm lib)

**Verdict**: Lift existing robust slugify from `server/scripts/ingest/import-taxonomy.js:85-92` into new `server/utils/slug.js`. Consume from all 5 call sites (`routes/{traits,biomes,species,ecosystems}.js` + `test/utils.js`).

**Logic**: NFD normalize → `̀-ͯ` diacritic strip → lowercase → `[^a-z0-9]+ → -` → trim trailing dashes → max-length 80 (Postgres varchar index sweet-spot).

**Why not npm `slugify`**: ~10 LOC duplicated logic already proven on Game YAML round-trip; adds runtime dep weight; Cyrillic/CJK transliteration features unused (Evo-Tactics = Latin binomials + Italian common names); aligned with codemasterdd ADR-0021 + CLAUDE.md ASCII-first encoding policy.

**Cross-repo impact**: ZERO. Game has separate slugifiers (4 JS variants use `_`, 2 Python variants use `-`); none consumed by Game-Database. Import script re-slugifies at boundary — Game-side slug churn out-of-scope (A6/COOP own).

**Follow-up flagged for PR-α**: confirm Prisma `slug` column adds `@db.VarChar(80)` constraint; cross-repo slug-format ADR (`_` vs `-` Game inconsistency) is future RFC candidate, not PR-α scope.

### Q2 — Audit RBAC: open-by-default, configurable strict

**Verdict**: Default open (no role check on `GET /api/audit`), opt-in via `AUDIT_READ_ROLES=audit:read,admin` env var. Mirrors existing pattern: all 10 GET routes in Game-Database are open today, only mutations gated via `TAXONOMY_WRITE_ROLES`.

**Sensitivity assessment**: AuditLog.payload contains full entity rows on CREATE/DELETE + `req.body` partial diffs on UPDATE. No PII, no secrets, no tokens — only taxonomy data which is publicly canonical from sibling Game repo. Worst-case = low-privilege reader can resurrect tombstoned taxonomy, which is a Fase 2 feature (undo), not a leak.

**LAN/prod hardening**: `start:lan` enables `basicAuth` middleware automatically when `APP_AUTH_USER` set → audit endpoint inherits 401 wall for free.

**Cross-repo impact**: ZERO. Sibling Game has zero references to `/api/audit` (only consumes `/api/traits/glossary`). codemasterdd ground-truth principle (anti-pattern #8) favors visibility.

**Follow-up flagged**: future `POST /api/audit/:logId/revert` (Fase 2) MUST be gated with `audit:revert` role — explicit in spec.

### Q3 — Schema doc: coexist, slim manual file

**Verdict**: Coexist as complementary. PR-γ creates auto-gen `docs/schema-reference.md` (canonical schema source, CI-gated). Existing `docs/modal-game-database.md` slimmed: replace schema table (lines 15-28, ~33% content) with one-liner pointer; preserve all non-schema content (dominio/processi/sicurezza/runtime/TODO = 66%) which PR-γ does NOT emit.

**Evidence**: Git `--follow` shows only 2 commits ever (creation 2025-11-10 + URL fix 2026-04-25) → fossilized, drift-prone. Zero external references in Game or codemasterdd-ai-station; only intra-Game-Database refs in `docs/Documento_Riferimento.md:47,69` (anchor updates needed when slimming).

**Cross-repo impact**: ZERO. Game's contract dependency is `glossary.schema.json` already canonicalized in `server/schemas/glossary.schema.json`, NOT this doc.

**Naming**: keep `modal-game-database.md` filename (link stability) OR rename to `domain-overview.md` (clearer semantics) — Eduardo preference. Spec assumes keep-filename for now.

**Follow-up flagged**: PR-γ generated `schema-reference.md` should include one-line back-link to `modal-game-database.md` (avoid orphan generation). Bonus: CI could lint Postgres-version-in-prose against `docker-compose.yml` (defer to follow-up PR).

### Q4 — Import validator: STRICT tiered severity

**Verdict**: STRICT default. `--validate-only` exits 1 on `errori > 0` OR `skipReasons.schema_validation > 0`; `partial`/completeness gaps stay warn-only (informational). Opt-out: `--validate-only --warn-only`. Granular knob: `--fail-on=errors|schema|any` (default `errors,schema`).

**Phased rollout**:
- v1 (today, pre-PR-ε): Game's `evo-import-gate.yml:46-52` is already STRICT-equivalent (`errori > 0 → exit 1`), green at `1197a1f`.
- v2 (PR-ε): formalize `--validate-only` flag, elevate `schema_validation` skips to errors, fix stdout JSON pollution.
- v3 (future): tighten — promote selected `skipReasons.*` to errors once baseline drift understood.

**Evidence**:
- Game already gates: `C:/dev/Game/.github/workflows/evo-import-gate.yml` STRICT, has caught real bug (M5-#2 stdout JSON parse-break, documented in `C:/dev/Game/docs/process/2026-04-19-M5-audit-sprint-completion.md:37`, 5 phantom species + 7 orphan trait refs)
- CLAUDE.md anti-pattern #9 ("DRY-RUN smoke ≠ Apply smoke") argues against soft validators
- CLAUDE.md anti-pattern #8 ("Shallow ADOPT") favors skeptical strict default

**Latent bug to fix in PR-ε**: `import-taxonomy.js:988` prints `Repo: ...` to stdout BEFORE JSON report → consumers need `sed -n '/^{/,$p'` workaround. Emit JSON-only on stdout, progress on stderr.

**Cross-repo impact**: Risk = if Game-Database `main` currently has latent slug/schema issue masked by `noteSkip` (not `noteError`), first STRICT run fails Game CI. Mitigation = run `--validate-only` against current `main` locally before merging PR-ε, baseline `errori=0` + `schema_validation=0`.

**Follow-up flagged**:
1. Should `evo-import-sync.yml` (scheduled 6h importer) gate on `--validate-only` before full import? (Defer to PR-ε follow-up)
2. Exit-code distinction: `exit 1` (validation errors) vs `exit 2` (operational/IO errors) for CI differentiation.

### Cross-repo state observed during research

- **Game** (`C:/dev/Game`, sibling, NO-WRITE): A6/COOP sessions own its scope. evo-import-gate.yml STRICT already, evo-import-sync.yml schedule, glossary.schema.json canonical contract.
- **codemasterdd-ai-station** (`C:/dev/codemasterdd-ai-station`, governance, append-only): ADR-0011 commit attribution + ADR-0021 multi-client encoding policy bind PR-α (ASCII-first slug).
- **vault**, **Game-Godot-v2**: NOT inspected (NO-GO per session prompt).

All 4 decisions converge: continue PR plan as drafted, with PR-α/γ/ε refined per resolved answers above. NO blocker, NO architecture revision required.

## Next step

Post user-review questa spec → invoke `superpowers:writing-plans` per generare implementation plan dettagliato Fase 1 PR-α primo (sequencing α → β → γ → δ → ε).

## References

- Session PR chain: Game-Database #115 (1dda005), #116 (69af82d), #117 (b4bd1be)
- Continuity handoff: `codemasterdd-ai-station/docs/sessions/2026-05-19-continuity-handoff.md`
- CLAUDE.md Release Standard (3-step QG): `~/.claude/CLAUDE.md`
- ADR-0011 commit attribution: `codemasterdd-ai-station/docs/adr/0011-cross-agent-commit-governance.md`
- Schema reference (will replace): `docs/modal-game-database.md`
- Pattern source (PR-β): #114 (3be942c) "test: PUT ecosystems coverage (4 tests, supersedes #113)"
