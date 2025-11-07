
const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');
const user = require('./middleware/user');

const recordsRouter = require('./routes/records');
const traitsRouter = require('./routes/traits');
const biomesRouter = require('./routes/biomes');
const speciesRouter = require('./routes/species');
const ecosystemsRouter = require('./routes/ecosystems');

const app = express();
app.use(cors({ origin: true, credentials: false, allowedHeaders: ['Content-Type', 'Authorization', 'X-User'] }));
app.use(express.json());

// Applica auth + contesto utente a tutte le API
app.use('/api', auth, user);
app.use('/api/records', recordsRouter);
app.use('/api/traits', traitsRouter);
app.use('/api/biomes', biomesRouter);
app.use('/api/species', speciesRouter);
app.use('/api/ecosystems', ecosystemsRouter);

const port = process.env.PORT || 3333;
app.listen(port, () => console.log(`API server http://localhost:${port}`));
