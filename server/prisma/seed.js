
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TRAIT_STYLES = [
  { stile: 'Monolinea',    pattern: 'Pieno',       peso: 'Sottile',  curvatura: 'Lineare' },
  { stile: 'Tratteggiato', pattern: 'Tratteggio',  peso: 'Medio',    curvatura: 'Lineare' },
  { stile: 'Puntinato',    pattern: 'Puntinato',   peso: 'Sottile',  curvatura: 'Lineare' },
  { stile: 'Brush',        pattern: 'Pieno',       peso: 'Spesso',   curvatura: 'Organico' },
  { stile: 'Calligrafico', pattern: 'Pieno',       peso: 'Variabile',curvatura: 'Curvo' },
  { stile: 'Geometrico',   pattern: 'Pieno',       peso: 'Medio',    curvatura: 'Angolare' },
  { stile: 'Organico',     pattern: 'Pieno',       peso: 'Medio',    curvatura: 'Curvo' },
  { stile: 'DoppioTratto', pattern: 'Pieno',       peso: 'Medio',    curvatura: 'Lineare' },
  { stile: 'Ombreggiato',  pattern: 'Hachure',     peso: 'Medio',    curvatura: 'Lineare' },
  { stile: 'Tecnico',      pattern: 'Pieno',       peso: 'Sottile',  curvatura: 'Lineare' },
  { stile: 'Neon',         pattern: 'Pieno',       peso: 'Medio',    curvatura: 'Curvo' },
  { stile: 'Sfumato',      pattern: 'Gradiente',   peso: 'Medio',    curvatura: 'Curvo' },
  { stile: 'Angolare',     pattern: 'Pieno',       peso: 'Medio',    curvatura: 'Angolare' },
  { stile: 'Spezzato',     pattern: 'Spezzato',    peso: 'Medio',    curvatura: 'Angolare' },
  { stile: 'Contour',      pattern: 'Contorno',    peso: 'Sottile',  curvatura: 'Curvo' },
  { stile: 'Ink',          pattern: 'Inchiostro',  peso: 'Variabile',curvatura: 'Organico' },
];
const STATI = ['Attivo', 'Bozza', 'Archiviato'];

function randomDateWithinMonths(months = 6) {
  const now = Date.now();
  const past = new Date(); past.setMonth(past.getMonth() - months);
  const ts = past.getTime() + Math.random() * (now - past.getTime());
  return new Date(ts);
}
function buildDescrizione(s) { return `stile=${s.stile}; pattern=${s.pattern}; peso=${s.peso}; curvatura=${s.curvatura}`; }

async function main() {
  await prisma.record.deleteMany({});
  const data = Array.from({ length: 200 }).map((_, i) => {
    const s = TRAIT_STYLES[i % TRAIT_STYLES.length];
    const stato = STATI[i % STATI.length];
    return {
      nome: `${s.stile} ${s.peso} ${s.pattern} #${i + 1}`,
      stato,
      descrizione: buildDescrizione(s),
      data: randomDateWithinMonths(6),
      stile: s.stile,
      pattern: s.pattern,
      peso: s.peso,
      curvatura: s.curvatura,
      createdBy: 'seed',
      updatedBy: 'seed',
    };
  });
  await prisma.record.createMany({ data });
  console.log(`Seed completato: ${data.length} record`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
