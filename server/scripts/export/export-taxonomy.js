'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { resolveReleasedVersion, snapshotToMaster } = require('../../utils/versionRead');
const { normalizeSlug } = require('../../utils/slug');
const { PATHS, MODEL_GAP, SPECIES_PROVENANCE_KEYS, TRAIT_REF_MAPPED_FIELDS, renderGlossary, renderReference, renderSpecies } = require('./export-shapes');

const prisma = new PrismaClient();
const args = process.argv.slice(2);

function parseFlagFromArgs(argv, name, def) {
  const prefix = `--${name}=`;
  const inlineIdx = argv.findIndex((a) => typeof a === 'string' && a.startsWith(prefix));
  if (inlineIdx >= 0) {
    return argv[inlineIdx].slice(prefix.length);
  }
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return def;
  const next = argv[index + 1];
  if (next && !next.startsWith('--')) return next;
  return true;
}

function arg(name, def) {
  return parseFlagFromArgs(args, name, def);
}

// Sort object keys recursively so semantically-equal JSON values compare
// equal regardless of key insertion order (Codex P2 on PR #187: slot_profile
// from Game files vs DB rows would otherwise false-flag as divergent).
// Array order stays significant by design (lists are order-sensitive data).
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function deepEqual(a, b) {
  try {
    return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
  } catch {
    return false;
  }
}

async function exportTaxonomy() {
  const versionTag = arg('version', null);
  const outDir = arg('out', null);
  const diffRoot = arg('diff', null);
  const reportPath = arg('report', null);

  if (!versionTag) {
    console.error('Error: --version <tag> is required');
    process.exit(1);
  }

  const generatedAt = new Date().toISOString();

  let version;
  try {
    version = await resolveReleasedVersion(versionTag);
  } catch (err) {
    console.error(`Error resolving version: ${err.message}`);
    process.exit(1);
  }

  const traitVersions = await prisma.traitVersion.findMany({ where: { versionId: version.id } });
  const traits = traitVersions.map(row => snapshotToMaster('trait', row));
  const speciesVersions = await prisma.speciesVersion.findMany({ where: { versionId: version.id } });
  const species = speciesVersions.map(row => snapshotToMaster('species', row));
  const updatedAt = version.releasedAt ? new Date(version.releasedAt).toISOString() : null;

  let templateGl1 = null;
  let templateRef = null;
  let templateGlCore = null;
  const templateSpeciesFiles = {};

  // Load Game templates whenever we diff (Codex P1 on #224): a report-only run
  // (--diff/--report without --out) must compare the SAME template-faithful
  // output that --out would ship, so fidelity numbers do not change with --out.
  if (diffRoot) {
    try {
      const gl1FullPath = path.resolve(diffRoot, PATHS.TRAIT_GLOSSARY);
      if (fs.existsSync(gl1FullPath)) {
        templateGl1 = JSON.parse(fs.readFileSync(gl1FullPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }

    try {
      const refFullPath = path.resolve(diffRoot, PATHS.TRAIT_REFERENCE);
      if (fs.existsSync(refFullPath)) {
        templateRef = JSON.parse(fs.readFileSync(refFullPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }

    try {
      const glCoreFullPath = path.resolve(diffRoot, PATHS.CORE_GLOSSARY);
      if (fs.existsSync(glCoreFullPath)) {
        templateGlCore = JSON.parse(fs.readFileSync(glCoreFullPath, 'utf8'));
      }
    } catch (e) {
      // ignore
    }

    try {
      const speciesDir = path.resolve(diffRoot, PATHS.SPECIES_DIR);
      if (fs.existsSync(speciesDir)) {
        const files = fs.readdirSync(speciesDir);
        for (const f of files) {
          if (f.endsWith('.json') && f !== 'index.json') {
            const slug = f.slice(0, -5);
            try {
              templateSpeciesFiles[slug] = JSON.parse(fs.readFileSync(path.join(speciesDir, f), 'utf8'));
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const glossary1 = renderGlossary(traits.filter(t => !t.sourceFiles || t.sourceFiles.length === 0 || t.sourceFiles.includes('pack_glossary')), updatedAt, '1.0', templateGl1);
  const reference = renderReference(traits.filter(t => !t.sourceFiles || t.sourceFiles.length === 0 || t.sourceFiles.includes('pack_reference')), templateRef);
  const glossaryCore = renderGlossary(traits.filter(t => !t.sourceFiles || t.sourceFiles.length === 0 || t.sourceFiles.includes('core_glossary')), updatedAt, '2.0', templateGlCore);

  const exportedFiles = {
    [PATHS.TRAIT_GLOSSARY]: glossary1,
    [PATHS.TRAIT_REFERENCE]: reference,
    [PATHS.CORE_GLOSSARY]: glossaryCore,
  };

  // Per-file species export only. The species index.json (a generated summary:
  // schema_version / generated_at / total_species / species[]) is regenerated
  // downstream by Game's tooling, like species-canonical-index.json -- it is NOT
  // a direct DB export target (RFC #4 S-Q3, refined 2026-06-17).
  const speciesProvenance = { generatedFrom: `Game-Database ${version.tag}`, generatedAt };
  for (const s of species) {
    if (s.sourceFiles && s.sourceFiles.includes('species_catalog_file')) {
      exportedFiles[`${PATHS.SPECIES_DIR}/${s.slug}.json`] = renderSpecies(s, templateSpeciesFiles[s.slug], speciesProvenance);
    }
  }

  if (outDir) {
    for (const [relPath, content] of Object.entries(exportedFiles)) {
      const fullPath = path.resolve(outDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, JSON.stringify(content, null, 2) + '\n');
    }
  }

  const report = {
    version: version.tag,
    generatedAt,
    targets: {},
    fieldInventory: {
      traitReference: {
        mapped: TRAIT_REF_MAPPED_FIELDS,
        modelGap: MODEL_GAP,
      },
      speciesFile: {
        mapped: ["role_trofico","functional_tags","vc","spawn_rules","environment_affinity","jobs_bias","playable_unit","display_name","flags","balance","telemetry","morphotype","biomes"],
        modelGap: MODEL_GAP,
      },
    },
  };

  if (diffRoot) {
    for (const [relPath, expContent] of Object.entries(exportedFiles)) {
      const targetReport = {
        counts: { matching: 0, divergent: 0, exported_only: 0, game_only_model_gap: 0, game_only_unexpected: 0, header_drift: 0 },
        perField: {},
        sampleDivergent: [],
      };

      const isSpeciesTarget = relPath.startsWith(`${PATHS.SPECIES_DIR}/`);

      const fullPath = path.resolve(diffRoot, relPath);
      let gameContent = null;
      try {
        if (fs.existsSync(fullPath)) {
          gameContent = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        }
      } catch (err) {
        console.error(`Error reading or parsing ${fullPath}: ${err.message}`);
      }

      if (gameContent) {
        // Compare headers
        for (const key of ['schema_version', 'sources', 'trait_glossary', 'updated_at']) {
          const expVal = expContent[key];
          const gameVal = gameContent[key];
          if (expVal !== undefined || gameVal !== undefined) {
            if (!deepEqual(expVal, gameVal)) {
               targetReport.counts.header_drift++;
            }
          }
        }

        // Compare records. Per-file species are a single root object; traits are
        // keyed by slug under .traits.
        let expTraits, gameTraits;
        if (isSpeciesTarget) {
          expTraits = { __root__: expContent };
          gameTraits = { __root__: gameContent };
        } else {
          expTraits = expContent.traits || {};
          gameTraits = gameContent.traits || {};
        }
        const allSlugs = new Set([...Object.keys(expTraits), ...Object.keys(gameTraits)]);

        for (const slug of allSlugs) {
          const expFields = expTraits[slug] || {};
          const gameFields = gameTraits[slug] || {};
          const allFields = new Set([...Object.keys(expFields), ...Object.keys(gameFields)]);

          for (const field of allFields) {
            // RFC #4 S2-Q1: the provenance marker VALUE is volatile (release tag
            // + timestamp). When both sides carry it, never classify -- a stale
            // Game marker must not count as divergent. But a marker key MISSING
            // from the Game file falls through to exported_only so a removed or
            // never-landed marker stays visible to the S2 gate (Codex P2 on #221).
            if (isSpeciesTarget && SPECIES_PROVENANCE_KEYS.includes(field)
                && expFields[field] != null && gameFields[field] != null) {
              continue;
            }
            let classification;
            const expVal = expFields[field];
            const gameVal = gameFields[field];

            const isAbsent = (val) => val === undefined || val === null || (Array.isArray(val) && val.length === 0);
            
            const expAbsent = isAbsent(expVal);
            const gameAbsent = isAbsent(gameVal);

            if (expAbsent && gameAbsent) {
              // Both sides absent -> no count
              continue;
            }

            if (!expAbsent && !gameAbsent) {
              let sortedExp = expVal;
              let sortedGame = gameVal;
              if (field === 'biomes' && Array.isArray(expVal) && Array.isArray(gameVal)) {
                // Same canonical slug normalizer the importer + exporter use, so
                // accented biome names compare equal (Codex P2 on #223).
                sortedExp = [...expVal].map((b) => normalizeSlug(b)).sort();
                sortedGame = [...gameVal].map((b) => normalizeSlug(b)).sort();
              }
              if (deepEqual(sortedExp, sortedGame)) {
                classification = 'matching';
              } else {
                classification = 'divergent';
                if (targetReport.sampleDivergent.length < 10) {
                  targetReport.sampleDivergent.push({ slug, field, db: expVal, game: gameVal });
                }
              }
            } else if (!expAbsent && gameAbsent) {
              classification = 'exported_only';
            } else if (expAbsent && !gameAbsent) {
              if (MODEL_GAP.includes(field)) {
                classification = 'game_only_model_gap';
              } else {
                classification = 'game_only_unexpected';
                if (targetReport.sampleDivergent.length < 10 && classification === 'game_only_unexpected') {
                  // Not strictly divergent, but useful as finding
                  targetReport.sampleDivergent.push({ slug, field, db: expVal, game: gameVal });
                }
              }
            }

            if (classification) {
              targetReport.counts[classification]++;
              if (!targetReport.perField[field]) targetReport.perField[field] = { matching: 0, divergent: 0, exported_only: 0, game_only_model_gap: 0, game_only_unexpected: 0 };
              targetReport.perField[field][classification]++;
            }
          }
        }
      } else {
        // Codex P2 on PR #187: a missing/unparsable target must not leave the
        // report silently empty -- flag it and count every exported field as
        // exported_only so the gap is visible in the fidelity numbers.
        targetReport.targetMissing = true;
        let expTraits;
        if (isSpeciesTarget) {
          expTraits = { __root__: expContent };
        } else {
          expTraits = expContent.traits || {};
        }
        for (const fields of Object.values(expTraits)) {
          for (const field of Object.keys(fields)) {
            targetReport.counts.exported_only++;
            if (!targetReport.perField[field]) targetReport.perField[field] = { matching: 0, divergent: 0, exported_only: 0, game_only_model_gap: 0, game_only_unexpected: 0 };
            targetReport.perField[field].exported_only++;
          }
        }
      }
      report.targets[relPath] = targetReport;
    }
  }

  if (reportPath) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  } else if (diffRoot) {
    console.log(`Fidelity Report for version: ${version.tag}`);
    for (const [relPath, data] of Object.entries(report.targets)) {
      console.log(`\nTarget: ${relPath}`);
      console.table(data.counts);
    }
  }

  process.exitCode = 0;
}

if (require.main === module) {
  exportTaxonomy().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  }).finally(async () => {
    await prisma.$disconnect();
  });
}

module.exports = { exportTaxonomy, deepEqual };
