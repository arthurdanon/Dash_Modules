// backend/src/config/security.js
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const env = require('./env');

function makeCors() {
  const allowed = (env.CORS_ORIGINS || `${env.APP_URL}`).split(',').map(s => s.trim());
  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);           // outils locaux (curl, tests)
      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  });
}

function makeGlobalLimiter() {
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  });
}

module.exports = {
  helmet: () => helmet({ crossOriginEmbedderPolicy: false }),
  cors: makeCors,
  globalLimiter: makeGlobalLimiter,
};
