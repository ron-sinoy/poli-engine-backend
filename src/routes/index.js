'use strict';

const express = require('express');
const cacheRoutes = require('./cache.routes');
const incidentRoutes = require('./incident.routes');
const partyRoutes = require('./party.routes');
const personRoutes = require('./person.routes');
const quoteRoutes = require('./quote.routes');
const sourceidRoutes = require('./sourceid.routes');
const threadRoutes = require('./thread.routes');
const versionRoutes = require('./version.routes');

const router = express.Router();

router.get('/health', (request, response) => {
  response.json({ ok: true });
});

router.use(cacheRoutes);
router.use(incidentRoutes);
router.use(partyRoutes);
router.use(personRoutes);
router.use(quoteRoutes);
router.use(sourceidRoutes);
router.use(threadRoutes);
router.use(versionRoutes);

module.exports = router;
