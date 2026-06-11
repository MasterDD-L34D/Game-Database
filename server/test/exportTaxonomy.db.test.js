const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const prisma = require('../db/prisma');
const { PATHS } = require('../scripts/export/export-shapes');
const { deepEqual } = require('../scripts/export/export-taxonomy');

const TAG = 'v1.0.0';

test('exportTaxonomy', async (t) => {
  let tmpOutDir;
  let tmpDiffDir;
  
  t.beforeEach(() => {
    tmpOutDir = fs.mkdtempSync(path.join(__dirname, 'export-out-'));
    tmpDiffDir = fs.mkdtempSync(path.join(__dirname, 'export-diff-'));
  });

  t.afterEach(() => {
    if (tmpOutDir && fs.existsSync(tmpOutDir)) {
      fs.rmSync(tmpOutDir, { recursive: true, force: true });
    }
    if (tmpDiffDir && fs.existsSync(tmpDiffDir)) {
      fs.rmSync(tmpDiffDir, { recursive: true, force: true });
    }
  });

  await t.test('run exporter and verify output files', async () => {
    execSync(`node ../scripts/export/export-taxonomy.js --version ${TAG} --out ${tmpOutDir}`, { cwd: __dirname });

    const gl1Path = path.join(tmpOutDir, PATHS.TRAIT_GLOSSARY);
    const gl2Path = path.join(tmpOutDir, PATHS.CORE_GLOSSARY);
    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);

    assert.ok(fs.existsSync(gl1Path));
    assert.ok(fs.existsSync(gl2Path));
    assert.ok(fs.existsSync(refPath));

    const gl1 = JSON.parse(fs.readFileSync(gl1Path, 'utf8'));
    const gl2 = JSON.parse(fs.readFileSync(gl2Path, 'utf8'));
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

    assert.equal(gl1.schema_version, '1.0');
    assert.ok(gl1.updated_at);
    assert.ok(gl1.traits);
    
    assert.equal(gl2.schema_version, '2.0');
    assert.ok(gl2.updated_at);
    assert.ok(gl2.traits);

    assert.equal(ref.schema_version, '2.0');
    assert.ok(ref.traits);

    // b. assert every exported slug has the 4 i18n keys in both glossaries
    const gl1Keys = Object.keys(gl1.traits);
    assert.ok(gl1Keys.length > 0);
    
    for (const slug of gl1Keys) {
      const g1t = gl1.traits[slug];
      const g2t = gl2.traits[slug];
      
      assert.ok('label_it' in g1t);
      assert.ok('label_en' in g1t);
      assert.ok('description_it' in g1t);
      assert.ok('description_en' in g1t);

      assert.ok('label_it' in g2t);
      assert.ok('label_en' in g2t);
      assert.ok('description_it' in g2t);
      assert.ok('description_en' in g2t);
    }
  });

  await t.test('round-trip with importer', async () => {
    execSync(`node ../scripts/export/export-taxonomy.js --version ${TAG} --out ${tmpOutDir}`, { cwd: __dirname });
    
    const importOutput = execSync(`node ../scripts/ingest/import-taxonomy.js --repo ${tmpOutDir} --validate-only`, { cwd: __dirname }).toString();
    
    try {
      const report = JSON.parse(importOutput);
      assert.equal(report.errori, 0);
    } catch (e) {
      assert.fail('Importer output could not be parsed as JSON: ' + importOutput);
    }
  });

  await t.test('diff reporting classes', async () => {
    execSync(`node ../scripts/export/export-taxonomy.js --version ${TAG} --out ${tmpOutDir}`, { cwd: __dirname });

    const gl1Path = path.join(tmpOutDir, PATHS.TRAIT_GLOSSARY);
    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);

    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
    
    const slugs = Object.keys(ref.traits);
    const s1 = slugs[0];
    const s2 = slugs[1];

    // Create a mock diff directory
    fs.mkdirSync(path.dirname(path.join(tmpDiffDir, PATHS.TRAIT_REFERENCE)), { recursive: true });
    
    const mockRef = {
      schema_version: '2.0',
      trait_glossary: 'diff_drift', // header_drift
      traits: {
        [s1]: {
          ...ref.traits[s1], // matching (should match on non-overridden fields)
          label: ref.traits[s1].label ? ref.traits[s1].label + '_divergent' : 'divergent', // divergent guaranteed
          slot: 'mock_slot', // game_only_model_gap
          unexpected_field: 'mock', // game_only_unexpected
        },
        [s2]: {
          ...ref.traits[s2]
        }
      }
    };
    
    // Add exported_only by not including the 3rd slug or s3 etc if exist, but s2 exists here and matches.
    // wait, we can just delete a key to ensure matching works if some fields match.

    fs.writeFileSync(path.join(tmpDiffDir, PATHS.TRAIT_REFERENCE), JSON.stringify(mockRef));

    const reportFile = path.join(tmpDiffDir, 'report.json');
    execSync(`node ../scripts/export/export-taxonomy.js --version ${TAG} --diff ${tmpDiffDir} --report ${reportFile}`, { cwd: __dirname });

    assert.ok(fs.existsSync(reportFile));
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    const refReport = report.targets[PATHS.TRAIT_REFERENCE];
    assert.ok(refReport);
    
    assert.ok(refReport.counts.header_drift >= 1);
    assert.ok(refReport.counts.matching >= 1);
    assert.ok(refReport.counts.divergent >= 1);
    assert.ok(refReport.counts.game_only_model_gap >= 1);
    assert.ok(refReport.counts.game_only_unexpected >= 1);
    assert.ok(refReport.counts.exported_only >= 1);

    // Codex P2 fix: targets absent from the diff root must be flagged, not
    // silently reported as all-zero counts. The two glossary targets were
    // never written into tmpDiffDir, so both must carry targetMissing with
    // every exported field counted as exported_only.
    for (const missingPath of [PATHS.TRAIT_GLOSSARY, PATHS.CORE_GLOSSARY]) {
      const missingReport = report.targets[missingPath];
      assert.ok(missingReport);
      assert.equal(missingReport.targetMissing, true);
      assert.ok(missingReport.counts.exported_only >= 1);
      assert.equal(missingReport.counts.matching, 0);
    }
  });

  await t.test('deepEqual is key-order independent (Codex P2)', () => {
    // Same object, different key insertion order -> matching, not divergent.
    assert.equal(deepEqual({ core: 'sensoriale', complementare: 'analitico' },
                           { complementare: 'analitico', core: 'sensoriale' }), true);
    // Nested objects normalize too.
    assert.equal(deepEqual({ a: { x: 1, y: [1, 2] }, b: null },
                           { b: null, a: { y: [1, 2], x: 1 } }), true);
    // Negative control: real differences still diverge.
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
    // Array order stays significant by design.
    assert.equal(deepEqual([1, 2], [2, 1]), false);
  });
});

test.after(async () => {
  await prisma.$disconnect();
});
