# Research — Import validator STRICT + stdout JSON pollution fix

**Date**: 2026-05-20
**Component**: `server/scripts/ingest/import-taxonomy.js` (PR-ε)
**Author**: parallel-#2 session (Ryzen)
**Spec reference**: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-ε + Q4 resolved (STRICT tiered)

## Goal

Document the `--validate-only` flag design, the tiered STRICT exit-code policy, the stdout JSON pollution fix, and the 4+ edge case scenarios catalogued.

## Changes summary

### 1. New CLI flags

| Flag | Default | Description |
|---|---|---|
| `--validate-only` | unset | Implies `--dry-run`, no DB writes. Triggers exit-code policy. |
| `--warn-only` | unset | With `--validate-only`, never exit 1 (report-only mode). |
| `--fail-on=<list>` | `errors,schema` | Comma list: `errors` / `schema` / `any`. Granular control. |

### 2. Exit-code policy (pure function `computeExitCode(summary, opts)`)

| Conditions | Exit code |
|---|---|
| Not validate-only mode | 0 (legacy behavior preserved) |
| validate-only + warn-only | 0 (report-only) |
| validate-only + fail-on includes `errors` + `summary.errori > 0` | 1 |
| validate-only + fail-on includes `schema` + any domain has `motivi_scarto.schema_validation > 0` | 1 |
| validate-only + fail-on=`any` + (errori > 0 OR schema > 0) | 1 |
| validate-only + all checks pass | 0 |
| Unhandled exception | 2 (operational/IO failure, distinct from validation failure) |

### 3. Stdout JSON pollution fix (latent bug from Game gate)

**Pre-PR-ε**: `import-taxonomy.js:984` printed `console.log("Repo: ${repoRoot}...")` BEFORE the JSON summary. Game's `evo-import-gate.yml:35-40` documented `sed -n '/^{/,$p'` workaround. M5-#2 incident (5 phantom species + 7 orphan trait refs) was caught by audit, not by gate, because gate had to discard leading line.

**Post-PR-ε**:
- All progress/Repo lines → `console.error()` (stderr)
- JSON summary alone → `console.log()` (stdout)
- Game's `sed` workaround no longer needed; can simplify gate-yml in follow-up PR

## Edge case scenarios investigated

### Scenario 1 — STRICT default + clean repo

Run `npm run evo:import --repo /path --validate-only` on healthy Game repo: 0 errori, 0 schema_validation skips, possibly some partial completeness. Exit 0. JSON report on stdout. Progress on stderr.

**Coverage**: `importValidator.test.js` test "exit-code 0 when validateOnly + 0 errors + 0 schema skips".

### Scenario 2 — STRICT default + dirty data

Repo has corrupted trait yaml that fails ajv schema validation. `noteSkip(..., 'schema_validation')` increments `motivi_scarto.schema_validation`. Exit code = 1, helpful stderr message `validate-only: exit 1 (errori=0, fail-on=errors,schema)`.

**Coverage**: "exit-code 1 when validateOnly + schema_validation > 0".

### Scenario 3 — Granular `--fail-on=errors` (Game-side gradual hardening)

Game's `evo-import-gate.yml` currently gates only on `errori`. Setting `--fail-on=errors` opts out of schema-strict mode → matches existing Game CI behavior during PR-ε rollout. After Game baseline is verified-green, can switch to `--fail-on=errors,schema` (default) or `--fail-on=any`.

**Coverage**: "exit-code 0 when fail-on=errors only and only schema skips present" + "exit-code 1 when fail-on=errors only and errori > 0".

### Scenario 4 — Warn-only escape hatch

`--warn-only` neutralizes all fail conditions. Useful for nightly batch reports that should NEVER block downstream automation. Designer can `npm run evo:import -- --repo path --validate-only --warn-only` to see report JSON without exit-code pressure.

**Coverage**: "exit-code 0 when warnOnly even with errors".

### Scenario 5 — Operational error distinction (exit code 2)

Unhandled throw (e.g. ENOENT on repoRoot, DB connection failure, malformed JSON config file) → exit code 2 (distinct from validation exit 1). Allows CI to distinguish "fix your data" (1) vs "infrastructure failure" (2). Suggested follow-up: `--fail-on` flag could grow `--fail-on=infra` for that bucket; defer.

## QG (CLAUDE.md Release Standard)

- **Step 1 Smoke**:
  - 16/16 `importValidator.test.js` verde (computeExitCode pure-function tests)
  - Full server suite 165 → 181 verde (+16)
  - Module exports verified (`require()` without running main → exports `{ computeExitCode }`)
- **Step 2 Research**: this document, 5 scenarios
- **Step 3 Tuning**: stdout pollution fix → Game can drop `sed -n '/^{/,$p'` workaround (defer to follow-up PR). validate-only mode reuses dryRun code path → zero perf regression. computeExitCode O(N) on dettaglio domains (4 fixed) → constant.

## Cross-repo coordination

### Game `evo-import-gate.yml` impact (READ-ONLY analysis, NO writes)

Game's `evo-import-gate.yml:46-52` currently:
```yaml
- name: Validate
  run: |
    node ../Game-Database/server/scripts/ingest/import-taxonomy.js \
      --repo . --dry-run \
      | sed -n '/^{/,$p' | tee report.json
    errori=$(jq '.errori' report.json)
    if [ "$errori" -gt 0 ]; then exit 1; fi
```

Post-PR-ε, Game can simplify to (FUTURE follow-up RFC, NOT this PR):
```yaml
- name: Validate
  run: |
    node ../Game-Database/server/scripts/ingest/import-taxonomy.js \
      --repo . --validate-only --fail-on=errors > report.json
    # No sed pipe needed (stdout is pure JSON).
    # Exit code 1 if errori > 0; exit code 2 on IO/infra failure.
```

This PR does NOT modify Game. The follow-up Game-side simplification is RFC-gated per spec cross-repo policy.

### Backward compatibility

- Without `--validate-only`: behavior unchanged (exit 0 unless unhandled throw)
- Without `--warn-only` / `--fail-on`: defaults to `errors,schema` STRICT
- Existing `--dry-run` flag unchanged (validate-only implies it but doesn't replace it)

## Open follow-ups (out-of-scope for PR-ε)

1. **Game `evo-import-gate.yml` simplification** (RFC-gated cross-repo touch): drop `sed` workaround, adopt `--validate-only --fail-on=errors`. Phase to `--fail-on=errors,schema` once Game baseline confirmed.
2. **`evo-import-sync.yml` pre-gate**: run `--validate-only` before the actual import to abort early instead of creating a broken PR. Defer.
3. **`--fail-on=infra` bucket**: distinguish IO/DB errors from data errors at exit-code level. Defer.
4. **Range-of-files filter**: `--only-domain=traits` to narrow scope of validate-only run. Defer.
5. **Promote `motivi_scarto.<reason>` to error level if N > threshold**: today only `schema_validation` triggers strict; tier `bioma_non_normalizzabile` etc. once baseline understood.

## References

- Spec: `docs/superpowers/specs/2026-05-20-game-database-value-roadmap-design.md` PR-ε + Q4
- Anti-pattern catalog: `~/.claude/CLAUDE.md` #2 (stdout buffered) and #9 (DRY-RUN smoke ≠ -Apply smoke)
- Game gate: `C:/dev/Game/.github/workflows/evo-import-gate.yml` (read-only, NOT modified by this PR)
- Past coverage: PR-α `7ed9dd6` slug consolidation (consumed by import-taxonomy.js)
