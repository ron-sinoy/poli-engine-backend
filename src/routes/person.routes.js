'use strict';

const express = require('express');
const personController = require('../controllers/person.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/persons', asyncHandler(personController.insertPerson));
router.get('/politicians/trending', asyncHandler(personController.getTrendingPoliticians));

module.exports = router;
