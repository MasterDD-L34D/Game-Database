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

  await t.test('map keys equal sourceKey when present and fall back to slug when null', async () => {
    // We already have a database with v1.0.0 traits. Let's find one and ensure it's exported
    // correctly. The exact logic for verifying the map keys depends on what the exporter did
    // to the database, but we can verify that if we modify a trait's sourceKey, it changes
    // the exported map key.
    
    // Create a temporary mock version 
    const mockTag = 'v-sourcekey-test';
    const taxonomyVersion = await prisma.taxonomyVersion.create({
      data: {
        tag: mockTag,
        status: 'released',
      }
    });

    const mockTrait1 = await prisma.trait.create({
      data: {
        slug: 'mock-trait-one',
        sourceKey: 'mock_trait_1',
        name: 'Mock Trait One',
        dataType: 'TEXT',
      }
    });
    const mockTrait2 = await prisma.trait.create({
      data: {
        slug: 'mock-trait-two',
        sourceKey: null,
        name: 'Mock Trait Two',
        dataType: 'TEXT',
      }
    });

    await prisma.traitVersion.createMany({
      data: [
        {
          versionId: taxonomyVersion.id,
          traitId: mockTrait1.id,
          slug: mockTrait1.slug,
          sourceKey: mockTrait1.sourceKey,
          name: mockTrait1.name,
          dataType: mockTrait1.dataType,
        },
        {
          versionId: taxonomyVersion.id,
          traitId: mockTrait2.id,
          slug: mockTrait2.slug,
          sourceKey: mockTrait2.sourceKey,
          name: mockTrait2.name,
          dataType: mockTrait2.dataType,
        }
      ]
    });

    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${tmpOutDir}`, { cwd: __dirname });

    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

    assert.ok('mock_trait_1' in ref.traits);
    assert.equal('mock-trait-one' in ref.traits, false);

    assert.ok('mock-trait-two' in ref.traits);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTrait1.id }});
    await prisma.trait.delete({ where: { id: mockTrait2.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
  });

  await t.test('membership filter trait only in pack_reference is absent from both glossary targets', async () => {
    const mockTag = 'v-membership-test';
    const taxonomyVersion = await prisma.taxonomyVersion.create({
      data: { tag: mockTag, status: 'released' }
    });

    const mockTraitRef = await prisma.trait.create({
      data: { slug: 'mock-trait-ref', sourceFiles: ['pack_reference'], name: 'Ref Only', dataType: 'TEXT' }
    });
    const mockTraitAll = await prisma.trait.create({
      data: { slug: 'mock-trait-all', sourceFiles: null, name: 'All Only', dataType: 'TEXT' }
    });

    await prisma.traitVersion.createMany({
      data: [
        { versionId: taxonomyVersion.id, traitId: mockTraitRef.id, slug: mockTraitRef.slug, sourceFiles: mockTraitRef.sourceFiles, name: mockTraitRef.name, dataType: mockTraitRef.dataType },
        { versionId: taxonomyVersion.id, traitId: mockTraitAll.id, slug: mockTraitAll.slug, sourceFiles: mockTraitAll.sourceFiles, name: mockTraitAll.name, dataType: mockTraitAll.dataType }
      ]
    });

    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${tmpOutDir}`, { cwd: __dirname });

    const gl1Path = path.join(tmpOutDir, PATHS.TRAIT_GLOSSARY);
    const gl2Path = path.join(tmpOutDir, PATHS.CORE_GLOSSARY);
    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);

    const gl1 = JSON.parse(fs.readFileSync(gl1Path, 'utf8'));
    const gl2 = JSON.parse(fs.readFileSync(gl2Path, 'utf8'));
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

    // ref has both
    assert.ok('mock-trait-ref' in ref.traits);
    assert.ok('mock-trait-all' in ref.traits);

    // glossaries only have all
    assert.equal('mock-trait-ref' in gl1.traits, false);
    assert.ok('mock-trait-all' in gl1.traits);
    assert.equal('mock-trait-ref' in gl2.traits, false);
    assert.ok('mock-trait-all' in gl2.traits);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTraitRef.id }});
    await prisma.trait.delete({ where: { id: mockTraitAll.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
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

  await t.test('differ treats [] as absent', async () => {
    const mockTag = 'v-absent-test';
    const taxonomyVersion = await prisma.taxonomyVersion.create({
      data: { tag: mockTag, status: 'released' }
    });

    const mockTrait = await prisma.trait.create({
      data: { slug: 'mock-trait', name: 'Mock Trait', dataType: 'TEXT', usageTags: [] } // Empty array in DB
    });

    await prisma.traitVersion.create({
      data: { versionId: taxonomyVersion.id, traitId: mockTrait.id, slug: mockTrait.slug, name: mockTrait.name, dataType: mockTrait.dataType, usageTags: [] }
    });

    // We only care about TRAIT_REFERENCE
    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${tmpOutDir}`, { cwd: __dirname });

    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);
    
    fs.mkdirSync(path.dirname(path.join(tmpDiffDir, PATHS.TRAIT_REFERENCE)), { recursive: true });
    
    // Game target has no usage_tags for this trait (undefined/absent)
    const mockRef = {
      schema_version: '2.0',
      traits: {
        'mock-trait': {
          label: 'Mock Trait'
          // no usage_tags
        }
      }
    };

    fs.writeFileSync(path.join(tmpDiffDir, PATHS.TRAIT_REFERENCE), JSON.stringify(mockRef));

    const reportFile = path.join(tmpDiffDir, 'report.json');
    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --diff ${tmpDiffDir} --report ${reportFile}`, { cwd: __dirname });

    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const refReport = report.targets[PATHS.TRAIT_REFERENCE];
    
    // The usageTags [] from DB and undefined from Game should NOT count as exported_only
    // wait, we can verify that there's no game_only_unexpected, exported_only, or divergent for usage_tags
    assert.ok(refReport.perField['usage_tags'] === undefined);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTrait.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
  });
});

test.after(async () => {
  await prisma.$disconnect();
});
