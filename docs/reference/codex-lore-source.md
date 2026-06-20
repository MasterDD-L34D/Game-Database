# Codex lore source -- lives in Game, not in the DB

Le voci codex A.L.I.E.N.A. (lore narrativa per specie) NON sono nel
Game-Database. Vivono in **Game** (`data/codex/*.yaml`), prodotte da una
pipeline procedurale generate-data-then-narrate con review-gate umano (HITL).

- **SoT del metodo** (Game): `docs/guide/procedural-lore-generation.md` --
  standard di settore (Wildermyth, Caves of Qud, grammar-constrained LLM
  decoding, HITL review-gate) + architettura + workflow autoriale.
- **Boundary import**: il Game-Database importa taxonomy (trait / species /
  biome) da Game build-time, unidirezionale Game -> DB. Le voci CODEX restano
  file-side in Game; il DB NON e' SoT per la lore.
- **Se in futuro serve la lore nel DB**: e' una decisione di scope separata
  (RFC), non un default. La sorgente canonica resta Game.
