'use strict';

const { config } = require('../config');

function errorHandler(error, request, response, next) {
  const statusCode = error.statusCode || 500;
  const body = {
    error: statusCode === 500 ? 'Internal server error' : error.message,
  };

  if (error.details !== undefined) {
    body.details = error.details;
  }

  if (config.nodeEnv !== 'production' && statusCode === 500) {
    body.message = error.message;
  }

  response.status(statusCode).json(body);
}

module.exports = { errorHandler };
