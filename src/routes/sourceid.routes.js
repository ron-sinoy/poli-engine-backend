'use strict';

const express = require('express');
const sourceidController = require('../controllers/sourceid.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/sourceids', asyncHandler(sourceidController.loadSourceids));
router.post('/sourceids', asyncHandler(sourceidController.insertSourceid));

module.exports = router;
