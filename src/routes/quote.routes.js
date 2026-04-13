'use strict';

const express = require('express');
const quoteController = require('../controllers/quote.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/quotes', asyncHandler(quoteController.insertQuote));

module.exports = router;
