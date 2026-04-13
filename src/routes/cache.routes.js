'use strict';

const express = require('express');
const cacheController = require('../controllers/cache.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/cache', asyncHandler(cacheController.getCache));

module.exports = router;
