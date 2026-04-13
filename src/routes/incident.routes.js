'use strict';

const express = require('express');
const incidentController = require('../controllers/incident.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/incidents', asyncHandler(incidentController.insertIncident));

module.exports = router;
