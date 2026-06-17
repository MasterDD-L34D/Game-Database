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

  await t.test('key-order-preserving export with --diff template', async () => {
    const mockTag = 'v-key-order-test';
    const taxonomyVersion = await prisma.taxonomyVersion.create({
      data: { tag: mockTag, status: 'released' }
    });

    const mockTraitA = await prisma.trait.create({
      data: { slug: 'mock-trait-a', sourceKey: 'a_trait', name: 'Trait A', dataType: 'TEXT', description: 'Desc A' }
    });
    const mockTraitB = await prisma.trait.create({
      data: { slug: 'mock-trait-b', sourceKey: 'b_trait', name: 'Trait B', dataType: 'TEXT', description: 'Desc B' }
    });
    const mockTraitC = await prisma.trait.create({
      data: { slug: 'mock-trait-c', sourceKey: 'c_trait', name: 'Trait C', dataType: 'TEXT', description: 'Desc C' }
    });

    await prisma.traitVersion.createMany({
      data: [
        { versionId: taxonomyVersion.id, traitId: mockTraitA.id, slug: mockTraitA.slug, sourceKey: mockTraitA.sourceKey, name: mockTraitA.name, dataType: mockTraitA.dataType, description: mockTraitA.description },
        { versionId: taxonomyVersion.id, traitId: mockTraitB.id, slug: mockTraitB.slug, sourceKey: mockTraitB.sourceKey, name: mockTraitB.name, dataType: mockTraitB.dataType, description: mockTraitB.description },
        { versionId: taxonomyVersion.id, traitId: mockTraitC.id, slug: mockTraitC.slug, sourceKey: mockTraitC.sourceKey, name: mockTraitC.name, dataType: mockTraitC.dataType, description: mockTraitC.description }
      ]
    });

    // Create a template where "C" comes before "B", "A" is absent, and the fields in "C" are reordered: description_it before label_it
    const mockGlossary = {
      schema_version: '1.0',
      traits: {
        'c_trait': {
          description_it: 'Template Desc C',
          label_it: 'Template Trait C'
        },
        'b_trait': {
          label_it: 'Template Trait B',
          description_it: 'Template Desc B'
        },
        // Stale template key absent from the DB snapshot, including a
        // prototype-name collision (Codex P2 on #207): must be DROPPED via
        // Object.hasOwn, never built from Object.prototype.
        'stale_gone': { label_it: 'Stale' },
        'constructor': { label_it: 'Proto' }
      }
    };

    fs.mkdirSync(path.dirname(path.join(tmpDiffDir, PATHS.TRAIT_GLOSSARY)), { recursive: true });
    fs.writeFileSync(path.join(tmpDiffDir, PATHS.TRAIT_GLOSSARY), JSON.stringify(mockGlossary));

    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${tmpOutDir} --diff ${tmpDiffDir}`, { cwd: __dirname });

    const gl1Path = path.join(tmpOutDir, PATHS.TRAIT_GLOSSARY);
    const gl1 = JSON.parse(fs.readFileSync(gl1Path, 'utf8'));

    const keys = Object.keys(gl1.traits);
    
    // Check that keys are ordered "C", "B", "A"
    assert.deepEqual(keys.filter(k => ['a_trait', 'b_trait', 'c_trait'].includes(k)), ['c_trait', 'b_trait', 'a_trait']);

    // Check that inside "C", description_it comes before label_it
    const cKeys = Object.keys(gl1.traits['c_trait']);
    const descIdx = cKeys.indexOf('description_it');
    const labelIdx = cKeys.indexOf('label_it');
    assert.ok(descIdx !== -1 && labelIdx !== -1);
    assert.ok(descIdx < labelIdx, `Expected description_it (${descIdx}) to be before label_it (${labelIdx}) in c_trait`);
    
    // Values should be from DB
    assert.equal(gl1.traits['c_trait'].label_it, 'Trait C');

    // Stale/proto template keys not in the DB must be dropped (Codex P2 #207)
    assert.equal('stale_gone' in gl1.traits, false);
    assert.equal(Object.hasOwn(gl1.traits, 'constructor'), false);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTraitA.id }});
    await prisma.trait.delete({ where: { id: mockTraitB.id }});
    await prisma.trait.delete({ where: { id: mockTraitC.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
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
          slot: 'mock_slot', // game_only_unexpected (MODEL_GAP is empty since the sourceExtras cycle)
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
    // MODEL_GAP is empty since the sourceExtras cycle (slot/sinergie_pi now
    // round-trip): the class stays wired for future gaps but counts 0, and
    // the slot fixture above lands in game_only_unexpected instead (>= 2
    // with unexpected_field).
    assert.equal(refReport.counts.game_only_model_gap, 0);
    assert.ok(refReport.counts.game_only_unexpected >= 2);
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
      data: { slug: 'mock-trait-ref', sourceFiles: ['pack_reference'], name: 'Ref Only', dataType: 'TEXT', sourceExtras: { sinergie_pi: { some_rule: 1 }, slot: ['x'] } }
    });
    const mockTraitAll = await prisma.trait.create({
      data: { slug: 'mock-trait-all', sourceFiles: null, name: 'All Only', dataType: 'TEXT' }
    });
    // Junction-created stub (fix for Codex P2 on Game#2745): species_link
    // membership must be excluded from EVERY export target.
    const mockTraitStub = await prisma.trait.create({
      data: { slug: 'mock-trait-stub', sourceFiles: ['species_link'], name: 'Stub Only', dataType: 'TEXT' }
    });

    await prisma.traitVersion.createMany({
      data: [
        { versionId: taxonomyVersion.id, traitId: mockTraitRef.id, slug: mockTraitRef.slug, sourceFiles: mockTraitRef.sourceFiles, name: mockTraitRef.name, dataType: mockTraitRef.dataType, sourceExtras: mockTraitRef.sourceExtras },
        { versionId: taxonomyVersion.id, traitId: mockTraitAll.id, slug: mockTraitAll.slug, sourceFiles: mockTraitAll.sourceFiles, name: mockTraitAll.name, dataType: mockTraitAll.dataType },
        { versionId: taxonomyVersion.id, traitId: mockTraitStub.id, slug: mockTraitStub.slug, sourceFiles: mockTraitStub.sourceFiles, name: mockTraitStub.name, dataType: mockTraitStub.dataType }
      ]
    });

    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${tmpOutDir}`, { cwd: __dirname });

    const gl1Path = path.join(tmpOutDir, PATHS.TRAIT_GLOSSARY);
    const gl2Path = path.join(tmpOutDir, PATHS.CORE_GLOSSARY);
    const refPath = path.join(tmpOutDir, PATHS.TRAIT_REFERENCE);

    const gl1 = JSON.parse(fs.readFileSync(gl1Path, 'utf8'));
    const gl2 = JSON.parse(fs.readFileSync(gl2Path, 'utf8'));
    const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));

    // ref has both, and exports sourceExtras verbatim for the ref trait
    assert.ok('mock-trait-ref' in ref.traits);
    assert.deepEqual(ref.traits['mock-trait-ref'].sinergie_pi, { some_rule: 1 });
    assert.deepEqual(ref.traits['mock-trait-ref'].slot, ['x']);
    assert.ok('mock-trait-all' in ref.traits);

    // glossaries only have all
    assert.equal('mock-trait-ref' in gl1.traits, false);
    assert.ok('mock-trait-all' in gl1.traits);
    assert.equal('mock-trait-ref' in gl2.traits, false);
    assert.ok('mock-trait-all' in gl2.traits);

    // species_link stub excluded from EVERY target
    assert.equal('mock-trait-stub' in gl1.traits, false);
    assert.equal('mock-trait-stub' in gl2.traits, false);
    assert.equal('mock-trait-stub' in ref.traits, false);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTraitRef.id }});
    await prisma.trait.delete({ where: { id: mockTraitAll.id }});
    await prisma.trait.delete({ where: { id: mockTraitStub.id }});
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

  
  await t.test('species export and fidelity report', async () => {
    const mockTag = 'v-species-test';
    const taxonomyVersion = await prisma.taxonomyVersion.create({
      data: { tag: mockTag, status: 'released' }
    });

    const mockSpecies = await prisma.species.create({
      data: {
        slug: 'mock-species',
        scientificName: 'Mockus testus',
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: 'Mammalia',
        order: 'Carnivora',
        family: 'Felidae',
        genus: 'Mockus',
        epithet: 'testus',
        displayName: 'Mock Species',
        trophicRole: 'predator',
        description: 'A very cool mock species.',
        flags: ['fast'],
      }
    });

    await prisma.speciesVersion.create({
      data: {
        versionId: taxonomyVersion.id,
        speciesId: mockSpecies.id,
        slug: mockSpecies.slug,
        scientificName: mockSpecies.scientificName,
        sourceFiles: ['species_catalog_file'],
        kingdom: mockSpecies.kingdom,
        phylum: mockSpecies.phylum,
        class: mockSpecies.class,
        order: mockSpecies.order,
        family: mockSpecies.family,
        genus: mockSpecies.genus,
        epithet: mockSpecies.epithet,
        displayName: mockSpecies.displayName,
        trophicRole: mockSpecies.trophicRole,
        description: mockSpecies.description,
        flags: mockSpecies.flags,
        biomeSlugs: ['forest', 'desert'],
        sourceExtras: { path: 'a/b/c', receipt: 'r1' }
      }
    });

    // 1. Test basic output (no diff)
    const testOutDir = path.join(__dirname, '.tmp_out_species');
    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --out ${testOutDir}`, { cwd: __dirname });

    const speciesFile = path.join(testOutDir, 'packs/evo_tactics_pack/docs/catalog/species/mock-species.json');

    assert.ok(fs.existsSync(speciesFile));

    const sData = JSON.parse(fs.readFileSync(speciesFile, 'utf8'));
    assert.equal(sData.id, 'mock-species');
    assert.equal(sData.description, undefined); // Excluded (non-exported, S-Q2)
    assert.equal(sData.display_name, 'Mock Species'); // Mapped
    assert.equal(sData.role_trofico, 'predator'); // Mapped
    assert.deepEqual(sData.flags, ['fast']); // Passthrough
    assert.deepEqual(sData.biomes, ['desert', 'forest']); // Set-sorted
    assert.equal(sData.path, 'a/b/c'); // Spread sourceExtras
    // RFC #4 S2-Q1: top-level provenance marker, first key, carrying the release tag.
    assert.equal(Object.keys(sData)[0], '_generated_from');
    assert.equal(sData._generated_from, `Game-Database ${mockTag}`);
    assert.ok(typeof sData.generated_at === 'string' && sData.generated_at.length > 0);
    // index.json is NOT exported (generated summary, regenerated downstream -- RFC #4 S-Q3).

    // 2. Test fidelity diff
    const testDiffDir = path.join(__dirname, '.tmp_diff_species');
    const diffSpeciesDir = path.join(testDiffDir, 'packs/evo_tactics_pack/docs/catalog/species');
    fs.mkdirSync(diffSpeciesDir, { recursive: true });

    // Provide a game target that misses 'description' (expected model gap)
    // and has 'biomes' in a different order (should match, set semantics).
    const gameSpeciesData = {
      // Exercises both marker paths (RFC #4 S2-Q1, Codex P2 on #221): a stale
      // `_generated_from` present on BOTH sides must be ignored (volatile value,
      // no divergent), while a marker key ABSENT from the Game file must surface
      // as exported_only so a removed/never-landed marker is not hidden.
      _generated_from: 'Game-Database v0.0.0-stale',
      // generated_at intentionally omitted -> exported_only
      description: 'Some game-authored text',
      display_name: 'Mock Species',
      role_trofico: 'predator',
      flags: ['fast'],
      biomes: ['FOREST', 'DESERT'], // reversed + caps -> normalizes to match DB ['desert','forest']
      path: 'a/b/c',
      receipt: 'r1'
    };
    fs.writeFileSync(path.join(diffSpeciesDir, 'mock-species.json'), JSON.stringify(gameSpeciesData));

    const reportPath = path.join(testDiffDir, 'report.json');
    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --diff ${testDiffDir} --report ${reportPath}`, { cwd: __dirname });

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    
    // Check per-file report
    const fileReport = report.targets['packs/evo_tactics_pack/docs/catalog/species/mock-species.json'];
    assert.ok(fileReport, 'Missing species file report');
    assert.equal(fileReport.perField['description']?.game_only_model_gap, 1);
    assert.equal(fileReport.perField['biomes'].matching, 1); // Order insensitive
    assert.equal(fileReport.counts.divergent, 0);
    assert.equal(fileReport.counts.game_only_unexpected, 0);
    // RFC #4 S2-Q1 (Codex P2 on #221): volatile marker value ignored, absence reported.
    // _generated_from present on both sides (stale value) -> never classified, so the
    // divergent=0 asserted above holds despite DB and Game carrying different tags.
    assert.equal(fileReport.perField['_generated_from'], undefined);
    // generated_at absent from the Game file -> surfaced as exported_only.
    assert.equal(fileReport.perField['generated_at']?.exported_only, 1);

    // 3. Test round-trip with importer. The testOutDir export now carries the
    // RFC #4 S2-Q1 provenance marker; normalizeSpecies reads only known fields,
    // so the marker is dropped (never reaches Ajv) and validate-only stays clean.
    const importOutput = execSync(`node ../scripts/ingest/import-taxonomy.js --repo ${testOutDir} --validate-only`, { cwd: __dirname }).toString();
    try {
      const importReport = JSON.parse(importOutput);
      assert.equal(importReport.errori, 0);
      // Guard vs vacuous pass (L-041): a path mismatch would import 0 files and
      // report errori:0 trivially. Assert the exported species was actually read.
      assert.ok(importReport.totali_letti > 0, `importer read 0 records (vacuous pass): ${importOutput}`);
    } catch (e) {
      assert.fail('Importer output could not be parsed as JSON: ' + importOutput);
    }

    // Cleanup
    await prisma.speciesVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.species.delete({ where: { id: mockSpecies.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
    fs.rmSync(testOutDir, { recursive: true, force: true });
    fs.rmSync(testDiffDir, { recursive: true, force: true });
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

    // Negative control (triage P2 on #194): NON-empty array vs absent must
    // still count as exported_only -- only empty arrays equal absence.
    const filledTrait = await prisma.trait.create({
      data: { slug: 'mock-trait-filled', name: 'Mock Trait Filled', dataType: 'TEXT', usageTags: ['scout'] }
    });
    await prisma.traitVersion.create({
      data: { versionId: taxonomyVersion.id, traitId: filledTrait.id, slug: filledTrait.slug, name: filledTrait.name, dataType: filledTrait.dataType, usageTags: ['scout'] }
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
        },
        'mock-trait-filled': {
          label: 'Mock Trait Filled'
          // no usage_tags either -- but DB has a NON-empty array here
        }
      }
    };

    fs.writeFileSync(path.join(tmpDiffDir, PATHS.TRAIT_REFERENCE), JSON.stringify(mockRef));

    const reportFile = path.join(tmpDiffDir, 'report.json');
    execSync(`node ../scripts/export/export-taxonomy.js --version ${mockTag} --diff ${tmpDiffDir} --report ${reportFile}`, { cwd: __dirname });

    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    const refReport = report.targets[PATHS.TRAIT_REFERENCE];
    
    // Empty array [] in DB vs absent in Game must NOT be counted at all for
    // mock-trait; the NON-empty array on mock-trait-filled MUST be counted as
    // exported_only (negative control: only emptiness equals absence).
    assert.ok(refReport.perField['usage_tags'] !== undefined, 'usage_tags must be counted for the filled trait');
    assert.equal(refReport.perField['usage_tags'].exported_only, 1);
    assert.equal(refReport.perField['usage_tags'].divergent, 0);

    await prisma.traitVersion.deleteMany({ where: { versionId: taxonomyVersion.id }});
    await prisma.trait.delete({ where: { id: mockTrait.id }});
    await prisma.trait.delete({ where: { id: filledTrait.id }});
    await prisma.taxonomyVersion.delete({ where: { id: taxonomyVersion.id }});
  });

  await t.test('species ingestion merges multiple sources and preserves sourceExtras', async () => {
    // Let's create a temporary mock directory structure with two files defining the same species.
    const testRepo = path.join(__dirname, '.tmp_import_repo');
    const catalogDir = path.join(testRepo, 'packs/evo_tactics_pack/docs/catalog');
    fs.mkdirSync(path.join(catalogDir, 'species'), { recursive: true });

    // Rich per-file source (docs/catalog/species/*.json -> 'species_catalog_file')
    fs.writeFileSync(path.join(catalogDir, 'species/merge-test.json'), JSON.stringify({
      slug: 'merge-test',
      scientific_name: 'Merge testus',
      derived_from_environment: { traits: ['t1'] }
    }));

    // Light catalog_data source (catalog_data.json -> 'catalog_data')
    fs.writeFileSync(path.join(catalogDir, 'catalog_data.json'), JSON.stringify({
      species: [
        {
           slug: 'merge-test',
           scientific_name: 'Merge testus',
           display_name: 'Merged Light'
        }
      ]
    }));

    // Import it (validate-only first)
    const importOutput = execSync(`node ../scripts/ingest/import-taxonomy.js --repo ${testRepo} --validate-only`, { cwd: __dirname }).toString();
    let report;
    try {
      report = JSON.parse(importOutput);
    } catch (e) {
      assert.fail('validate-only output is not JSON: ' + importOutput);
    }
    assert.equal(report.errori, 0);
    assert.ok(report.totali_letti > 0, 'importer must read the merge-test species (vacuous-pass guard, L-041)');
    
    execSync(`node ../scripts/ingest/import-taxonomy.js --repo ${testRepo}`, { cwd: __dirname });
    
    const dbSp = await prisma.species.findUnique({ where: { slug: 'merge-test' }});
    assert.ok(dbSp);
    assert.deepEqual(dbSp.sourceFiles.sort(), ['catalog_data', 'species_catalog_file']);
    assert.ok(dbSp.sourceExtras);
    assert.ok(dbSp.sourceExtras.derived_from_environment);
    assert.equal(dbSp.displayName, 'Merged Light');
    
    // cleanup (delete junction rows first -- FK constraints on speciesId)
    await prisma.speciesTrait.deleteMany({ where: { speciesId: dbSp.id } });
    await prisma.speciesBiome.deleteMany({ where: { speciesId: dbSp.id } });
    await prisma.ecosystemSpecies.deleteMany({ where: { speciesId: dbSp.id } });
    await prisma.species.delete({ where: { id: dbSp.id }});
    fs.rmSync(testRepo, { recursive: true, force: true });
  });


});

test.after(async () => {
  await prisma.$disconnect();
});
