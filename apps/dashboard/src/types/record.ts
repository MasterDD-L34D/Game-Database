
export type Stile =
  | 'Monolinea' | 'Tratteggiato' | 'Puntinato' | 'Brush' | 'Calligrafico' | 'Geometrico' | 'Organico'
  | 'DoppioTratto' | 'Ombreggiato' | 'Tecnico' | 'Neon' | 'Sfumato' | 'Angolare' | 'Spezzato' | 'Contour' | 'Ink';
export type Pattern = 'Pieno' | 'Tratteggio' | 'Puntinato' | 'Gradiente' | 'Hachure' | 'Contorno' | 'Spezzato' | 'Inchiostro';
export type Peso = 'Sottile' | 'Medio' | 'Spesso' | 'Variabile';
export type Curvatura = 'Lineare' | 'Curvo' | 'Organico' | 'Angolare';
export type RecordRow = {
  id?: string;
  nome: string;
  stato: 'Attivo' | 'Bozza' | 'Archiviato';
  descrizione?: string;
  data?: string;
  stile?: Stile;
  pattern?: Pattern;
  peso?: Peso;
  curvatura?: Curvatura;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};
