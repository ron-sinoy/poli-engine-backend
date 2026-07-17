'use strict';

const express = require('express');
const incidentController = require('../controllers/incident.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/incidents', asyncHandler(incidentController.insertIncident));
router.get('/breaking-news', asyncHandler(incidentController.loadBreakingNews));
router.post('/waitinglists', asyncHandler(incidentController.insertWaitingList));
router.post('/waitinglists/match', asyncHandler(incidentController.matchWaitingListIncidents));
router.post('/waitinglists/update', asyncHandler(incidentController.updateWaitingListStatus));
router.get(
  '/content_waiting-list_incidents',
  asyncHandler(incidentController.loadContentWaitingListIncidents)
);

module.exports = router;
