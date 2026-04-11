'use strict';

function notFoundHandler(request, response) {
  response.status(404).json({ error: 'Not found' });
}

module.exports = { notFoundHandler };
