'use strict';

const express = require('express');
const threadRoutes = require('./thread.routes');
const versionRoutes = require('./version.routes');

const router = express.Router();

router.get('/health', (request, response) => {
  response.json({ ok: true });
});

router.use(threadRoutes);
router.use(versionRoutes);

module.exports = router;
