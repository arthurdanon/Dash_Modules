const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

module.exports = (app) => {
  // charge le fichier YAML
  const spec = YAML.load(path.join(__dirname, 'openapi.yaml'));
  // sert la doc
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }));
};
