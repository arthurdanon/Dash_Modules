// backend/src/mw/logger.js
const pino = require('pino');
const pinoHttp = require('pino-http');
const { randomUUID } = require('crypto');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : {
    target: 'pino-pretty',
    options: { colorize: true, translateTime: 'SYS:standard' },
  },
});

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers['x-request-id'] || randomUUID(),
});

module.exports = { logger, httpLogger };
