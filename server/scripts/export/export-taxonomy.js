'use strict';

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { resolveReleasedVersion, snapshotToMaster } = require('../../utils/versionRead');
const { PATHS, MODEL_GAP, TRAIT_REF_MAPPED_FIELDS, renderGlossary, renderReference } = require('./export-shapes');

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

function deepEqual(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
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
  const updatedAt = version.releasedAt ? new Date(version.releasedAt).toISOString() : null;

  const glossary1 = renderGlossary(traits, updatedAt, '1.0');
  const reference = renderReference(traits);
  const glossaryCore = renderGlossary(traits, updatedAt, '2.0');

  const exportedFiles = {
    [PATHS.TRAIT_GLOSSARY]: glossary1,
    [PATHS.TRAIT_REFERENCE]: reference,
    [PATHS.CORE_GLOSSARY]: glossaryCore,
  };

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
    },
  };

  if (diffRoot) {
    for (const [relPath, expContent] of Object.entries(exportedFiles)) {
      const targetReport = {
        counts: { matching: 0, divergent: 0, exported_only: 0, game_only_model_gap: 0, game_only_unexpected: 0, header_drift: 0 },
        perField: {},
        sampleDivergent: [],
      };

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

        // Compare traits
        const expTraits = expContent.traits || {};
        const gameTraits = gameContent.traits || {};
        const allSlugs = new Set([...Object.keys(expTraits), ...Object.keys(gameTraits)]);

        for (const slug of allSlugs) {
          const expFields = expTraits[slug] || {};
          const gameFields = gameTraits[slug] || {};
          const allFields = new Set([...Object.keys(expFields), ...Object.keys(gameFields)]);

          for (const field of allFields) {
            let classification;
            const expVal = expFields[field];
            const gameVal = gameFields[field];

            if (expVal !== undefined && gameVal !== undefined) {
              if (deepEqual(expVal, gameVal)) {
                classification = 'matching';
              } else {
                classification = 'divergent';
                if (targetReport.sampleDivergent.length < 10) {
                  targetReport.sampleDivergent.push({ slug, field, db: expVal, game: gameVal });
                }
              }
            } else if (expVal !== undefined && gameVal === undefined) {
              classification = 'exported_only';
            } else if (expVal === undefined && gameVal !== undefined) {
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

module.exports = { exportTaxonomy };
