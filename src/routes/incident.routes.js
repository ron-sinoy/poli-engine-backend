'use strict';

const express = require('express');
const incidentController = require('../controllers/incident.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/incidents', asyncHandler(incidentController.insertIncident));
router.post('/waitinglists', asyncHandler(incidentController.insertWaitingList));
router.get(
  '/vector_waiting_list_incidents',
  asyncHandler(incidentController.loadVectorWaitingListIncidents)
);
router.get(
  '/content_waiting-list_incidents',
  asyncHandler(incidentController.loadContentWaitingListIncidents)
);

module.exports = router;
