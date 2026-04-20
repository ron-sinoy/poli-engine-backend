'use strict';

const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { notFoundHandler } = require('./middleware/notFoundHandler');

function createApp(dependencies = {}) {
  const app = express();
  
  // Allows tests and future modules to inject shared clients without global mocks.
  app.locals.dependencies = dependencies;

  app.use(express.json());
  app.use(cors());
  app.use(routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
