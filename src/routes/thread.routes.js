'use strict';

const express = require('express');
const threadController = require('../controllers/thread.controller');
const { asyncHandler } = require('../middleware/asyncHandler');

const router = express.Router();

router.post('/threads', asyncHandler(threadController.insertThread));
router.get('/threadsList', asyncHandler(threadController.loadThreadsList));
router.get('/threads/:id', asyncHandler(threadController.getThreadById));

module.exports = router;
