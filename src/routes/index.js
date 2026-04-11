'use strict';

const express = require('express');
const versionRoutes = require('./version.routes');

const router = express.Router();

router.get('/health', (request, response) => {
  response.json({ ok: true });
});

router.use(versionRoutes);

module.exports = router;
