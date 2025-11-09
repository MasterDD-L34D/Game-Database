const { PrismaClient, Presence, Role } = require('@prisma/client');

const prisma = new PrismaClient();

const TRAIT_STYLES = [
  { stile: 'Monolinea', pattern: 'Pieno', peso: 'Sottile', curvatura: 'Lineare' },
  { stile: 'Tratteggiato', pattern: 'Tratteggio', peso: 'Medio', curvatura: 'Lineare' },
  { stile: 'Puntinato', pattern: 'Puntinato', peso: 'Sottile', curvatura: 'Lineare' },
  { stile: 'Brush', pattern: 'Pieno', peso: 'Spesso', curvatura: 'Organico' },
  { stile: 'Calligrafico', pattern: 'Pieno', peso: 'Variabile', curvatura: 'Curvo' },
  { stile: 'Geometrico', pattern: 'Pieno', peso: 'Medio', curvatura: 'Angolare' },
  { stile: 'Organico', pattern: 'Pieno', peso: 'Medio', curvatura: 'Curvo' },
  { stile: 'DoppioTratto', pattern: 'Pieno', peso: 'Medio', curvatura: 'Lineare' },
  { stile: 'Ombreggiato', pattern: 'Hachure', peso: 'Medio', curvatura: 'Lineare' },
  { stile: 'Tecnico', pattern: 'Pieno', peso: 'Sottile', curvatura: 'Lineare' },
  { stile: 'Neon', pattern: 'Pieno', peso: 'Medio', curvatura: 'Curvo' },
  { stile: 'Sfumato', pattern: 'Gradiente', peso: 'Medio', curvatura: 'Curvo' },
  { stile: 'Angolare', pattern: 'Pieno', peso: 'Medio', curvatura: 'Angolare' },
  { stile: 'Spezzato', pattern: 'Spezzato', peso: 'Medio', curvatura: 'Angolare' },
  { stile: 'Contour', pattern: 'Contorno', peso: 'Sottile', curvatura: 'Curvo' },
  { stile: 'Ink', pattern: 'Inchiostro', peso: 'Variabile', curvatura: 'Organico' },
];
const STATI = ['Attivo', 'Bozza', 'Archiviato'];
const DEFAULT_TRAIT_CATEGORY = 'baseline';

const SLUGS = {
  TRAITS: {
    BODY_LENGTH: 'body-length',
    BODY_MASS: 'body-mass',
    DIET: 'diet',
    SOCIAL_STRUCTURE: 'social-structure',
  },
  BIOMES: {
    TEMPERATE_FOREST: 'temperate-forest-mixed',
    MONTANE_CONIFEROUS: 'montane-coniferous-forest',
    MEDITERRANEAN_SCRUB: 'mediterranean-scrub',
    COASTAL_WETLAND: 'coastal-wetland',
  },
  SPECIES: {
    EURASIAN_LYNX: 'lynx-eurasiatico',
    PEREGRINE_FALCON: 'falco-pellegrino',
    EUROPEAN_POND_TURTLE: 'emys-orbicularis',
  },
  ECOSYSTEMS: {
    BOREAL_PARK: 'parco-forestale-boreale',
    DELTA_WETLAND: 'delta-mediterraneo',
    ALPINE_CHAIN: 'catena-alpina',
  },
};

function randomDateWithinMonths(months = 6) {
  const now = Date.now();
  const past = new Date();
  past.setMonth(past.getMonth() - months);
  const ts = past.getTime() + Math.random() * (now - past.getTime());
  return new Date(ts);
}

function buildDescrizione(style) {
  return `stile=${style.stile}; pattern=${style.pattern}; peso=${style.peso}; curvatura=${style.curvatura}`;
}

function describeClimate(zone, { temperature, precipitation, humidity, seasonality }) {
  const parts = [
    zone ? `Zona: ${zone}` : null,
    temperature ? `Temperatura: ${temperature}` : null,
    precipitation ? `Precipitazioni: ${precipitation}` : null,
    humidity ? `Umidità: ${humidity}` : null,
    seasonality ? `Stagionalità: ${seasonality}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function numericTraitValue(num, unit, source, confidence = 0.75) {
  return {
    category: DEFAULT_TRAIT_CATEGORY,
    num,
    unit,
    source,
    confidence,
    value: {
      kind: 'numeric',
      display: `${num} ${unit}`,
      unit,
    },
  };
}

function categoricalTraitValue(option, source, confidence = 0.65, extra = {}) {
  return {
    category: DEFAULT_TRAIT_CATEGORY,
    text: option,
    source,
    confidence,
    value: {
      kind: 'categorical',
      option,
      ...extra,
    },
  };
}

function textTraitValue(text, source, confidence = 0.6) {
  return {
    category: DEFAULT_TRAIT_CATEGORY,
    text,
    source,
    confidence,
    value: {
      kind: 'text',
      text,
    },
  };
}

function presenceInfo(presence, abundance, notes) {
  return { presence, abundance, notes };
}

function biomeComposition(proportion, notes) {
  return { proportion, notes };
}

function cleanData(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function ensureEntity(map, slug, entityName) {
  const entity = map[slug];
  if (!entity) {
    throw new Error(`Entity ${entityName} con slug ${slug} non trovata durante il seed.`);
  }
  return entity;
}

const TRAITS_DATA = [
  {
    slug: SLUGS.TRAITS.BODY_LENGTH,
    name: 'Lunghezza corpo',
    description: 'Lunghezza media dal muso alla base della coda per individui adulti.',
    category: 'Morfologia',
    unit: 'cm',
    dataType: 'NUMERIC',
    rangeMin: 5,
    rangeMax: 300,
  },
  {
    slug: SLUGS.TRAITS.BODY_MASS,
    name: 'Massa corporea',
    description: 'Peso medio degli adulti in condizioni ottimali.',
    category: 'Morfologia',
    unit: 'kg',
    dataType: 'NUMERIC',
    rangeMin: 0.05,
    rangeMax: 400,
  },
  {
    slug: SLUGS.TRAITS.DIET,
    name: 'Dieta prevalente',
    description: 'Categoria alimentare prevalente osservata in natura.',
    category: 'Ecologia',
    dataType: 'CATEGORICAL',
    allowedValues: ['Erbivoro', 'Carnivoro', 'Onnivoro', 'Insettivoro', 'Piscivoro'],
  },
  {
    slug: SLUGS.TRAITS.SOCIAL_STRUCTURE,
    name: 'Struttura sociale',
    description: 'Organizzazione sociale tipica rilevata in natura.',
    category: 'Comportamento',
    dataType: 'TEXT',
  },
];

const BIOMES_DATA = [
  {
    slug: SLUGS.BIOMES.TEMPERATE_FOREST,
    name: 'Foresta temperata mista',
    description: 'Boschi di latifoglie e conifere con sottobosco ricco di arbusti e muschi.',
    climate: describeClimate('Temperato umido', {
      temperature: '0–25 °C con inverni nevosi',
      precipitation: '600–1 200 mm/anno',
      humidity: '60–80%',
      seasonality: 'Forte stagionalità, picco vegetativo primaverile',
    }),
  },
  {
    slug: SLUGS.BIOMES.MONTANE_CONIFEROUS,
    name: 'Foresta montana di conifere',
    description: 'Pendii montani dominati da abeti e larici, con radure alpine.',
    climate: describeClimate('Freddo montano', {
      temperature: '-10–15 °C',
      precipitation: '900–1 500 mm/anno (neve prevalente)',
      humidity: '45–70%',
      seasonality: 'Estati brevi, inverni lunghi',
    }),
  },
  {
    slug: SLUGS.BIOMES.MEDITERRANEAN_SCRUB,
    name: 'Macchia mediterranea',
    description: 'Vegetazione arbustiva sempreverde con essenze aromatiche e garighe costiere.',
    climate: describeClimate('Mediterraneo', {
      temperature: '5–32 °C',
      precipitation: '400–700 mm/anno',
      humidity: '50–70%',
      seasonality: 'Estati secche, inverni miti e piovosi',
    }),
  },
  {
    slug: SLUGS.BIOMES.COASTAL_WETLAND,
    name: 'Zona umida costiera',
    description: 'Lagune, canneti e prati salmastri soggetti a marea e acque di transizione.',
    climate: describeClimate('Costiero temperato', {
      temperature: '2–28 °C',
      precipitation: '700–1 400 mm/anno',
      humidity: '70–95%',
      seasonality: 'Escursione termica ridotta, picchi piovosi autunnali',
    }),
  },
];

const SPECIES_DATA = [
  {
    slug: SLUGS.SPECIES.EURASIAN_LYNX,
    scientificName: 'Lynx lynx',
    commonName: 'Lince eurasiatica',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Mammalia',
    order: 'Carnivora',
    family: 'Felidae',
    genus: 'Lynx',
    epithet: 'lynx',
    status: 'NT',
    description:
      'Felino solitario dei boschi temperati e montani europei, predatore apicale di ungulati e lagomorfi.',
  },
  {
    slug: SLUGS.SPECIES.PEREGRINE_FALCON,
    scientificName: 'Falco peregrinus',
    commonName: 'Falco pellegrino',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Aves',
    order: 'Falconiformes',
    family: 'Falconidae',
    genus: 'Falco',
    epithet: 'peregrinus',
    status: 'LC',
    description:
      'Rapace cosmopolita specializzato nella caccia ad alta velocità di uccelli di medie dimensioni.',
  },
  {
    slug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    scientificName: 'Emys orbicularis',
    commonName: 'Testuggine palustre europea',
    kingdom: 'Animalia',
    phylum: 'Chordata',
    class: 'Reptilia',
    order: 'Testudines',
    family: 'Emydidae',
    genus: 'Emys',
    epithet: 'orbicularis',
    status: 'NT',
    description:
      'Rettile semiacquatico legato a canneti, stagni e zone umide con acque lente.',
  },
];

const ECOSYSTEMS_DATA = [
  {
    slug: SLUGS.ECOSYSTEMS.BOREAL_PARK,
    name: 'Parco forestale boreale',
    description: 'Mosaico di conifere, torbiere e radure nordiche con elevata copertura nevosa invernale.',
    region: 'Scandinavia meridionale',
    climate: describeClimate('Sub-boreale', {
      temperature: '-15–18 °C',
      precipitation: '500–900 mm/anno',
      humidity: '55–75%',
      seasonality: 'Inverni lunghi e nevosi, estati fresche',
    }),
  },
  {
    slug: SLUGS.ECOSYSTEMS.DELTA_WETLAND,
    name: 'Delta mediterraneo',
    description:
      'Delta fluviale con canneti e lagune salmastre fondamentali per uccelli acquatici migratori.',
    region: 'Bacino del Mediterraneo occidentale',
    climate: describeClimate('Mediterraneo costiero', {
      temperature: '4–30 °C',
      precipitation: '500–850 mm/anno',
      humidity: '65–95%',
      seasonality: 'Estati calde, inverni miti con piogge concentrate',
    }),
  },
  {
    slug: SLUGS.ECOSYSTEMS.ALPINE_CHAIN,
    name: 'Catena alpina',
    description: 'Alta montagna con gradiente altitudinale marcato, pareti rocciose e praterie alpine.',
    region: 'Arco alpino centrale',
    climate: describeClimate('Alpino', {
      temperature: '-20–12 °C',
      precipitation: '800–1 600 mm/anno',
      humidity: '40–70%',
      seasonality: 'Nevi perenni oltre i 2 500 m, disgelo tardo primaverile',
    }),
  },
];

const SPECIES_TRAITS = [
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    traitSlug: SLUGS.TRAITS.BODY_LENGTH,
    data: numericTraitValue(95, 'cm', 'Monitoraggio faunistico Alpi 2022', 0.8),
  },
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    traitSlug: SLUGS.TRAITS.BODY_MASS,
    data: numericTraitValue(23.5, 'kg', 'ISPRA Carnivori 2021', 0.7),
  },
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    traitSlug: SLUGS.TRAITS.DIET,
    data: categoricalTraitValue('Carnivoro', 'Analisi dieta predatori alpini 2020', 0.75, {
      mainPrey: ['Capriolo', 'Lepre variabile'],
    }),
  },
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    traitSlug: SLUGS.TRAITS.SOCIAL_STRUCTURE,
    data: textTraitValue(
      'Territoriale solitaria, coppie solo nel periodo riproduttivo.',
      'ISPRA etologia 2019',
      0.6,
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    traitSlug: SLUGS.TRAITS.BODY_LENGTH,
    data: numericTraitValue(43, 'cm', 'Atlante rapaci europei 2020', 0.78),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    traitSlug: SLUGS.TRAITS.BODY_MASS,
    data: numericTraitValue(0.95, 'kg', 'Euring database 2021', 0.72),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    traitSlug: SLUGS.TRAITS.DIET,
    data: categoricalTraitValue('Carnivoro', 'Monitoraggio colonie rupestri 2022', 0.7, {
      mainPrey: ['Columba livia', 'Sturnus vulgaris'],
    }),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    traitSlug: SLUGS.TRAITS.SOCIAL_STRUCTURE,
    data: textTraitValue('Coppie stabili su siti rupestri, giovani erratici.', 'BirdLife Italia 2021', 0.55),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    traitSlug: SLUGS.TRAITS.BODY_LENGTH,
    data: numericTraitValue(20, 'cm', 'Progetto Zone Umide 2019', 0.76),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    traitSlug: SLUGS.TRAITS.BODY_MASS,
    data: numericTraitValue(1.5, 'kg', 'Monitoraggio erpetofauna 2020', 0.7),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    traitSlug: SLUGS.TRAITS.DIET,
    data: categoricalTraitValue('Onnivoro', 'Studio alimentazione Emys 2018', 0.68, {
      mainPrey: ['Macroinvertebrati', 'Vegetazione acquatica'],
    }),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    traitSlug: SLUGS.TRAITS.SOCIAL_STRUCTURE,
    data: textTraitValue('Aggregazioni in aree di basking, territorialità ridotta.', 'Erpetologia italiana 2017', 0.58),
  },
];

const SPECIES_BIOMES = [
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    biomeSlug: SLUGS.BIOMES.TEMPERATE_FOREST,
    ...presenceInfo(
      Presence.resident,
      0.65,
      'Densità maggiore nelle valli boscate con abbondanza di ungulati.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    biomeSlug: SLUGS.BIOMES.MONTANE_CONIFEROUS,
    ...presenceInfo(
      Presence.migrant,
      0.3,
      'Utilizzo stagionale di versanti montani per la caccia estiva.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    biomeSlug: SLUGS.BIOMES.MONTANE_CONIFEROUS,
    ...presenceInfo(
      Presence.resident,
      0.4,
      'Nidifica su pareti rocciose contigue a boschi radi.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    biomeSlug: SLUGS.BIOMES.MEDITERRANEAN_SCRUB,
    ...presenceInfo(
      Presence.migrant,
      0.25,
      'Individui giovani e svernanti lungo le coste mediterranee.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    biomeSlug: SLUGS.BIOMES.COASTAL_WETLAND,
    ...presenceInfo(
      Presence.introduced,
      0.1,
      'Reintroduzioni urbane e presenze costiere in crescita.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    biomeSlug: SLUGS.BIOMES.COASTAL_WETLAND,
    ...presenceInfo(
      Presence.resident,
      0.7,
      'Popolazioni stabili in canali e lagune con acque lente.',
    ),
  },
  {
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    biomeSlug: SLUGS.BIOMES.MEDITERRANEAN_SCRUB,
    ...presenceInfo(
      Presence.migrant,
      0.15,
      'Spostamenti stagionali verso dune e ambienti retrodunali per ovodeposizione.',
    ),
  },
];

const ECOSYSTEM_BIOMES = [
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.BOREAL_PARK,
    biomeSlug: SLUGS.BIOMES.TEMPERATE_FOREST,
    ...biomeComposition(0.55, 'Foreste miste di conifere e betulle su suoli podzolici.'),
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.BOREAL_PARK,
    biomeSlug: SLUGS.BIOMES.MONTANE_CONIFEROUS,
    ...biomeComposition(0.3, 'Versanti montani con lariceti e praterie subalpine.'),
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.DELTA_WETLAND,
    biomeSlug: SLUGS.BIOMES.COASTAL_WETLAND,
    ...biomeComposition(0.7, 'Lagune salmastre e canneti permanenti.'),
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.DELTA_WETLAND,
    biomeSlug: SLUGS.BIOMES.MEDITERRANEAN_SCRUB,
    ...biomeComposition(0.2, 'Fasce di vegetazione mediterranea attorno agli specchi d’acqua.'),
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.ALPINE_CHAIN,
    biomeSlug: SLUGS.BIOMES.MONTANE_CONIFEROUS,
    ...biomeComposition(0.5, 'Conifere montane fino al limite del bosco.'),
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.ALPINE_CHAIN,
    biomeSlug: SLUGS.BIOMES.TEMPERATE_FOREST,
    ...biomeComposition(0.3, 'Boschi misti montani nelle valli e nei fondovalle.'),
  },
];

const ECOSYSTEM_SPECIES = [
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.BOREAL_PARK,
    speciesSlug: SLUGS.SPECIES.EURASIAN_LYNX,
    role: Role.keystone,
    abundance: 0.45,
    notes: 'Predatore apicale che regola le popolazioni di ungulati.',
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.BOREAL_PARK,
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    role: Role.dominant,
    abundance: 0.2,
    notes: 'Rapace notato lungo le pareti rocciose e le zone riparie.',
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.DELTA_WETLAND,
    speciesSlug: SLUGS.SPECIES.EUROPEAN_POND_TURTLE,
    role: Role.engineer,
    abundance: 0.6,
    notes: 'Specie ingegnere che crea tane e microhabitat nelle aree umide.',
  },
  {
    ecosystemSlug: SLUGS.ECOSYSTEMS.ALPINE_CHAIN,
    speciesSlug: SLUGS.SPECIES.PEREGRINE_FALCON,
    role: Role.common,
    abundance: 0.35,
    notes: 'Presenza regolare sulle creste alpine e nelle vallate aperte.',
  },
];

async function seedRecords() {
  await prisma.record.deleteMany({});
  const data = Array.from({ length: 200 }).map((_, i) => {
    const style = TRAIT_STYLES[i % TRAIT_STYLES.length];
    const stato = STATI[i % STATI.length];
    return {
      nome: `${style.stile} ${style.peso} ${style.pattern} #${i + 1}`,
      stato,
      descrizione: buildDescrizione(style),
      data: randomDateWithinMonths(6),
      stile: style.stile,
      pattern: style.pattern,
      peso: style.peso,
      curvatura: style.curvatura,
      createdBy: 'seed',
      updatedBy: 'seed',
    };
  });
  await prisma.record.createMany({ data });
  return data.length;
}

async function upsertBySlug(model, items) {
  const map = {};
  for (const item of items) {
    const { slug, ...rest } = item;
    const cleanRest = cleanData(rest);
    const created = await model.upsert({
      where: { slug },
      update: cleanRest,
      create: cleanData({ slug, ...rest }),
    });
    map[slug] = created;
  }
  return map;
}

async function upsertSpeciesTraits(speciesMap, traitMap) {
  for (const entry of SPECIES_TRAITS) {
    const species = ensureEntity(speciesMap, entry.speciesSlug, 'Specie');
    const trait = ensureEntity(traitMap, entry.traitSlug, 'Trait');
    const data = cleanData({ ...entry.data });
    const category = data.category ?? DEFAULT_TRAIT_CATEGORY;
    await prisma.speciesTrait.upsert({
      where: {
        speciesId_traitId_category: {
          speciesId: species.id,
          traitId: trait.id,
          category,
        },
      },
      update: data,
      create: {
        speciesId: species.id,
        traitId: trait.id,
        ...data,
      },
    });
  }
}

async function upsertSpeciesBiomes(speciesMap, biomeMap) {
  for (const entry of SPECIES_BIOMES) {
    const species = ensureEntity(speciesMap, entry.speciesSlug, 'Specie');
    const biome = ensureEntity(biomeMap, entry.biomeSlug, 'Bioma');
    const data = cleanData({ ...entry });
    delete data.speciesSlug;
    delete data.biomeSlug;
    await prisma.speciesBiome.upsert({
      where: {
        speciesId_biomeId: {
          speciesId: species.id,
          biomeId: biome.id,
        },
      },
      update: data,
      create: {
        speciesId: species.id,
        biomeId: biome.id,
        ...data,
      },
    });
  }
}

async function upsertEcosystemBiomes(ecosystemMap, biomeMap) {
  for (const entry of ECOSYSTEM_BIOMES) {
    const ecosystem = ensureEntity(ecosystemMap, entry.ecosystemSlug, 'Ecosistema');
    const biome = ensureEntity(biomeMap, entry.biomeSlug, 'Bioma');
    const data = cleanData({ ...entry });
    delete data.ecosystemSlug;
    delete data.biomeSlug;
    await prisma.ecosystemBiome.upsert({
      where: {
        ecosystemId_biomeId: {
          ecosystemId: ecosystem.id,
          biomeId: biome.id,
        },
      },
      update: data,
      create: {
        ecosystemId: ecosystem.id,
        biomeId: biome.id,
        ...data,
      },
    });
  }
}

async function upsertEcosystemSpecies(ecosystemMap, speciesMap) {
  for (const entry of ECOSYSTEM_SPECIES) {
    const ecosystem = ensureEntity(ecosystemMap, entry.ecosystemSlug, 'Ecosistema');
    const species = ensureEntity(speciesMap, entry.speciesSlug, 'Specie');
    const data = cleanData({ ...entry });
    delete data.ecosystemSlug;
    delete data.speciesSlug;
    await prisma.ecosystemSpecies.upsert({
      where: {
        ecosystemId_speciesId_role: {
          ecosystemId: ecosystem.id,
          speciesId: species.id,
          role: data.role,
        },
      },
      update: data,
      create: {
        ecosystemId: ecosystem.id,
        speciesId: species.id,
        ...data,
      },
    });
  }
}

async function main() {
  const recordsCount = await seedRecords();
  const traitMap = await upsertBySlug(prisma.trait, TRAITS_DATA);
  const biomeMap = await upsertBySlug(prisma.biome, BIOMES_DATA);
  const speciesMap = await upsertBySlug(prisma.species, SPECIES_DATA);
  const ecosystemMap = await upsertBySlug(prisma.ecosystem, ECOSYSTEMS_DATA);
  await upsertSpeciesTraits(speciesMap, traitMap);
  await upsertSpeciesBiomes(speciesMap, biomeMap);
  await upsertEcosystemBiomes(ecosystemMap, biomeMap);
  await upsertEcosystemSpecies(ecosystemMap, speciesMap);
  const summary = {
    records: recordsCount,
    traits: Object.keys(traitMap).length,
    biomes: Object.keys(biomeMap).length,
    species: Object.keys(speciesMap).length,
    ecosystems: Object.keys(ecosystemMap).length,
    speciesBiomes: SPECIES_BIOMES.length,
    ecosystemBiomes: ECOSYSTEM_BIOMES.length,
    ecosystemSpecies: ECOSYSTEM_SPECIES.length,
  };
  console.log(
    `Seed completato: ${summary.records} record, ${summary.traits} trait, ${summary.biomes} biomi, ${summary.species} specie e ${summary.ecosystems} ecosistemi.`,
  );
  console.log(
    `Relazioni: ${summary.speciesBiomes} specie↔biomi, ${summary.ecosystemBiomes} ecosistemi↔biomi, ${summary.ecosystemSpecies} ecosistemi↔specie.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
