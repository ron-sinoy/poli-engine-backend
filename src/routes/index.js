'use strict';

const express = require('express');
const cacheRoutes = require('./cache.routes');
const partyRoutes = require('./party.routes');
const threadRoutes = require('./thread.routes');
const versionRoutes = require('./version.routes');

const router = express.Router();

router.get('/health', (request, response) => {
  response.json({ ok: true });
});

router.use(cacheRoutes);
router.use(partyRoutes);
router.use(threadRoutes);
router.use(versionRoutes);

module.exports = router;
