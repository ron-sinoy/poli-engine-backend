'use strict';

require('dotenv').config();

const { createApp } = require('./app');
const { config } = require('./config');

const app = createApp();

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Backend listening on http://localhost:${config.port}, nodeEnv:${config.nodeEnv} :)`);
});