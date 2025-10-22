// backend/src/mw/validate.js
const { ZodError } = require('zod');

/**
 * validate({ params?, query?, body? })
 * - Parse et remplace req.params / req.query / req.body avec la version typée Zod
 * - En cas d'erreur, renvoie 400 avec un message lisible
 */
function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query)  req.query  = schemas.query.parse(req.query);
      if (schemas.body)   req.body   = schemas.body.parse(req.body);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.issues?.map(i => i.message).join(', ') || 'Invalid request';
        return res.status(400).json({ error: msg });
      }
      next(e);
    }
  };
}

module.exports = { validate };
