'use strict';

const express = require('express');
const versionController = require('../controllers/version.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.get('/getVersion', asyncHandler(versionController.getVersion));
router.post('/updateVersion', asyncHandler(versionController.updateVersion));

module.exports = router;
