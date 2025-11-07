const express = require('express');
const cors = require('cors');
const auth = require('./middleware/auth');
const user = require('./middleware/user');

const recordsRouter = require('./routes/records');
const traitsRouter = require('./routes/traits');
const biomesRouter = require('./routes/biomes');
const speciesRouter = require('./routes/species');
const ecosystemsRouter = require('./routes/ecosystems');

function createApp() {
  const app = express();
  app.use(cors({
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
  }));
  app.use(express.json());

  app.use('/api', auth, user);
  app.use('/api/records', recordsRouter);
  app.use('/api/traits', traitsRouter);
  app.use('/api/biomes', biomesRouter);
  app.use('/api/species', speciesRouter);
  app.use('/api/ecosystems', ecosystemsRouter);

  return app;
}

module.exports = createApp;
