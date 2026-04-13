'use strict';

const express = require('express');
const partyController = require('../controllers/party.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/party', asyncHandler(partyController.insertParty));

module.exports = router;
