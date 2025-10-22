// backend/src/mw/error.js
const { logger } = require('./logger');

module.exports = function errorHandler(err, _req, res, _next) {
  const status = err.status || err.statusCode || 500;

  // Log propre
  const out = {
    status,
    code: err.code,
    message: err.message || 'Internal error',
    meta: err.meta,
  };
  if (status >= 500) logger.error(out); else logger.warn(out);

  // Mapping Prisma (exemples)
  if (err.code === 'P2002') return res.status(409).json({ error: 'Unique constraint violation' });
  if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });

  return res.status(status).json({ error: out.message });
};
