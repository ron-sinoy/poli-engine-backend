'use strict';

function createResponse(resolve) {
  return {
    statusCode: 200,
    headers: {},
    locals: {},
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[String(name).toLowerCase()];
    },
    removeHeader(name) {
      delete this.headers[String(name).toLowerCase()];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.setHeader('content-type', 'application/json');
      this.end(JSON.stringify(payload));
      return this;
    },
    send(payload) {
      this.end(payload);
      return this;
    },
    end(payload) {
      const rawBody =
        payload === undefined || payload === null
          ? ''
          : Buffer.isBuffer(payload)
            ? payload.toString('utf8')
            : String(payload);
      const contentType = this.getHeader('content-type') || '';
      const body =
        contentType.includes('application/json') && rawBody
          ? JSON.parse(rawBody)
          : rawBody;

      resolve({
        statusCode: this.statusCode,
        headers: this.headers,
        body,
      });
    },
  };
}

function invokeApp(app, { method, url, body }) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      url,
      originalUrl: url,
      headers: {},
      body,
      app,
      socket: { remoteAddress: '127.0.0.1' },
    };

    const response = createResponse(resolve);

    app.handle(request, response, reject);
  });
}

module.exports = { invokeApp };
