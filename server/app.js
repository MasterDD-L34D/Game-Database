const path = require('path');
const express = require('express');
const cors = require('cors');
const user = require('./middleware/user');
const basicAuth = require('./middleware/basicAuth');

const recordsRouter = require('./routes/records');
const traitsRouter = require('./routes/traits');
const biomesRouter = require('./routes/biomes');
const speciesRouter = require('./routes/species');
const speciesTraitsRouter = require('./routes/speciesTraits');
const speciesBiomesRouter = require('./routes/speciesBiomes');
const ecosystemBiomesRouter = require('./routes/ecosystemBiomes');
const ecosystemSpeciesRouter = require('./routes/ecosystemSpecies');
const ecosystemsRouter = require('./routes/ecosystems');
const dashboardRouter = require('./routes/dashboard');

function createApp() {
  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: false,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-User',
        'X-User-Email',
        'X-Roles',
        'X-User-Roles',
      ],
    }),
  );
  app.use(express.json());

  const healthPayload = { status: 'ok' };

  app.get('/health', (req, res) => {
    res.json(healthPayload);
  });

  app.get('/api', (req, res) => {
    res.json(healthPayload);
  });

  app.get('/api/health', (req, res) => {
    res.json(healthPayload);
  });

  app.use(basicAuth);
  app.use('/api', user);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/traits', traitsRouter);
  app.use('/api/biomes', biomesRouter);
  app.use('/api/species-traits', speciesTraitsRouter);
  app.use('/api/species-biomes', speciesBiomesRouter);
  app.use('/api/species', speciesRouter);
  app.use('/api/ecosystem-biomes', ecosystemBiomesRouter);
  app.use('/api/ecosystem-species', ecosystemSpeciesRouter);
  app.use('/api/ecosystems', ecosystemsRouter);

  if (process.env.SERVE_DASHBOARD === '1') {
    const dashboardDist = path.resolve(__dirname, '..', 'apps', 'dashboard', 'dist');
    app.use(express.static(dashboardDist));
    app.get(/^\/(?!api\/|health$).*/, (req, res) => {
      res.sendFile(path.join(dashboardDist, 'index.html'));
    });
  }

  return app;
}

module.exports = createApp;
