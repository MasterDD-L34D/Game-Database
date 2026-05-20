# Schema Reference

**Auto-generated** from `server/prisma/schema.prisma` by
`server/scripts/generate-schema-doc.js`. Do **not** edit by hand —
changes will be overwritten next time `npm run schema:doc` runs
(also gated in CI via `npm run schema:doc:check`).

For dominio/runtime/operational context (not schema), see
[`modal-game-database.md`](./modal-game-database.md).

> Generator entry: `server/scripts/generate-schema-doc.js`
> Source schema: `server/prisma/schema.prisma`
> Models: 10 · Enums: 9

## Table of contents

- [Models](#models)
  - [Record](#record)
  - [AuditLog](#auditlog)
  - [Trait](#trait)
  - [Biome](#biome)
  - [Species](#species)
  - [SpeciesTrait](#speciestrait)
  - [SpeciesBiome](#speciesbiome)
  - [Ecosystem](#ecosystem)
  - [EcosystemBiome](#ecosystembiome)
  - [EcosystemSpecies](#ecosystemspecies)
- [Enums](#enums)
  - [RecordStato](#recordstato)
  - [Stile](#stile)
  - [Pattern](#pattern)
  - [Peso](#peso)
  - [Curvatura](#curvatura)
  - [AuditAction](#auditaction)
  - [TraitDataType](#traitdatatype)
  - [Presence](#presence)
  - [Role](#role)

## Models

### Record

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `nome` | `String` | — |
| `stato` | `RecordStato` | — |
| `descrizione` | `String?` | — |
| `data` | `DateTime?` | @db.Date |
| `stile` | `Stile?` | — |
| `pattern` | `Pattern?` | — |
| `peso` | `Peso?` | — |
| `curvatura` | `Curvatura?` | — |
| `createdBy` | `String?` | — |
| `updatedBy` | `String?` | — |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

**Block directives**

- `@@index([nome])`
- `@@index([stato])`
- `@@index([stile])`
- `@@index([pattern])`
- `@@index([peso])`
- `@@index([curvatura])`

### AuditLog

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `entity` | `String` | — |
| `entityId` | `String` | — |
| `action` | `AuditAction` | — |
| `user` | `String?` | — |
| `payload` | `Json?` | — |
| `createdAt` | `DateTime` | @default(now()) |

**Block directives**

- `@@index([entity, entityId])`
- `@@index([createdAt])`
- `@@index([entity, entityId, createdAt(sort: Desc)], name: "AuditLog_entity_entityId_createdAt_desc_idx")`

### Trait

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `slug` | `String` | @unique |
| `name` | `String` | — |
| `description` | `String?` | — |
| `category` | `String?` | — |
| `unit` | `String?` | — |
| `dataType` | `TraitDataType` | — |
| `allowedValues` | `Json?` | — |
| `rangeMin` | `Float?` | — |
| `rangeMax` | `Float?` | — |
| `tier` | `String?` | — |
| `familyType` | `String?` | — |
| `energyMaintenance` | `String?` | — |
| `slotProfile` | `Json?` | — |
| `usageTags` | `Json?` | — |
| `synergies` | `Json?` | — |
| `conflicts` | `Json?` | — |
| `environmentalRequirements` | `Json?` | — |
| `inducedMutation` | `String?` | — |
| `functionalUse` | `String?` | — |
| `selectiveDrive` | `String?` | — |
| `weakness` | `String?` | — |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

**Relations**

- `speciesValues`: `SpeciesTrait[]`

### Biome

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `slug` | `String` | @unique |
| `name` | `String` | — |
| `description` | `String?` | — |
| `climate` | `String?` | — |
| `parentId` | `String?` | — |
| `summary` | `String?` | — |
| `climateTags` | `Json?` | — |
| `hazard` | `Json?` | — |
| `ecology` | `Json?` | — |
| `roleTemplates` | `Json?` | — |
| `sizeMin` | `Int?` | — |
| `sizeMax` | `Int?` | — |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

**Relations**

- `parent`: `Biome?` — @relation("BiomeChildren", fields: [parentId], references: [id])
- `children`: `Biome[]` — @relation("BiomeChildren")
- `species`: `SpeciesBiome[]`
- `ecosystems`: `EcosystemBiome[]`

### Species

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `slug` | `String` | @unique |
| `scientificName` | `String` | — |
| `commonName` | `String?` | — |
| `kingdom` | `String?` | — |
| `phylum` | `String?` | — |
| `class` | `String?` | — |
| `order` | `String?` | — |
| `family` | `String?` | — |
| `genus` | `String?` | — |
| `epithet` | `String?` | — |
| `status` | `String?` | — |
| `description` | `String?` | — |
| `displayName` | `String?` | — |
| `trophicRole` | `String?` | — |
| `functionalTags` | `Json?` | — |
| `flags` | `Json?` | — |
| `balance` | `Json?` | — |
| `playableUnit` | `Boolean?` | — |
| `morphotype` | `String?` | — |
| `vcCoefficients` | `Json?` | — |
| `spawnRules` | `Json?` | — |
| `environmentAffinity` | `Json?` | — |
| `jobsBias` | `Json?` | — |
| `telemetry` | `Json?` | — |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

**Relations**

- `traits`: `SpeciesTrait[]`
- `biomes`: `SpeciesBiome[]`
- `ecosystems`: `EcosystemSpecies[]`

**Block directives**

- `@@index([scientificName])`
- `@@index([commonName])`

### SpeciesTrait

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `speciesId` | `String` | — |
| `traitId` | `String` | — |
| `value` | `Json?` | — |
| `num` | `Float?` | — |
| `bool` | `Boolean?` | — |
| `text` | `String?` | — |
| `category` | `String?` | — |
| `unit` | `String?` | — |
| `source` | `String?` | — |
| `confidence` | `Float?` | — |

**Relations**

- `species`: `Species` — @relation(fields: [speciesId], references: [id])
- `trait`: `Trait` — @relation(fields: [traitId], references: [id])

**Block directives**

- `@@unique([speciesId, traitId, category])`
- `@@index([traitId])`

### SpeciesBiome

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `speciesId` | `String` | — |
| `biomeId` | `String` | — |
| `presence` | `Presence` | — |
| `abundance` | `Float?` | — |
| `notes` | `String?` | — |

**Relations**

- `species`: `Species` — @relation(fields: [speciesId], references: [id])
- `biome`: `Biome` — @relation(fields: [biomeId], references: [id])

**Block directives**

- `@@unique([speciesId, biomeId])`
- `@@index([biomeId])`

### Ecosystem

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `slug` | `String` | @unique |
| `name` | `String` | — |
| `description` | `String?` | — |
| `region` | `String?` | — |
| `climate` | `String?` | — |
| `createdAt` | `DateTime` | @default(now()) |
| `updatedAt` | `DateTime` | @updatedAt |

**Relations**

- `biomes`: `EcosystemBiome[]`
- `species`: `EcosystemSpecies[]`

### EcosystemBiome

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `ecosystemId` | `String` | — |
| `biomeId` | `String` | — |
| `proportion` | `Float?` | — |
| `notes` | `String?` | — |

**Relations**

- `ecosystem`: `Ecosystem` — @relation(fields: [ecosystemId], references: [id])
- `biome`: `Biome` — @relation(fields: [biomeId], references: [id])

**Block directives**

- `@@unique([ecosystemId, biomeId])`

### EcosystemSpecies

| Field | Type | Modifiers |
| --- | --- | --- |
| `id` | `String` | @id @default(cuid()) |
| `ecosystemId` | `String` | — |
| `speciesId` | `String` | — |
| `role` | `Role` | — |
| `abundance` | `Float?` | — |
| `notes` | `String?` | — |

**Relations**

- `ecosystem`: `Ecosystem` — @relation(fields: [ecosystemId], references: [id])
- `species`: `Species` — @relation(fields: [speciesId], references: [id])

**Block directives**

- `@@unique([ecosystemId, speciesId, role])`

## Enums

### RecordStato

- `Attivo`
- `Bozza`
- `Archiviato`

### Stile

- `Monolinea`
- `Tratteggiato`
- `Puntinato`
- `Brush`
- `Calligrafico`
- `Geometrico`
- `Organico`
- `DoppioTratto`
- `Ombreggiato`
- `Tecnico`
- `Neon`
- `Sfumato`
- `Angolare`
- `Spezzato`
- `Contour`
- `Ink`

### Pattern

- `Pieno`
- `Tratteggio`
- `Puntinato`
- `Gradiente`
- `Hachure`
- `Contorno`
- `Spezzato`
- `Inchiostro`

### Peso

- `Sottile`
- `Medio`
- `Spesso`
- `Variabile`

### Curvatura

- `Lineare`
- `Curvo`
- `Organico`
- `Angolare`

### AuditAction

- `CREATE`
- `UPDATE`
- `DELETE`

### TraitDataType

- `BOOLEAN`
- `NUMERIC`
- `CATEGORICAL`
- `TEXT`

### Presence

- `resident`
- `migrant`
- `introduced`
- `endemic`
- `unknown`

### Role

- `keystone`
- `dominant`
- `engineer`
- `common`
- `invasive`
- `other`
