// backend/src/server.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// === Nouvelle config centralisée & sécurité ===
const env = require('./config/env'); // <- parse & valide les variables (Zod)
const { helmet: secureHelmet, cors: makeCors, globalLimiter } = require('./config/security');
const { httpLogger } = require('./mw/logger');
const errorHandler = require('./mw/error');

// ##########################CONST ROUTES####################################################
// ---------- ROUTES HEALTH ----------
const healthRoutes = require('./routes/health'); // /api/healthz, /api/readyz

// ---------- ROUTES AUTH ----------
const authRoutes = require('./routes/AuthRoutes');

// ---------- ROUTES ADMIN ----------
const AdminSiteRoutes  = require('./routes/AdminRoutes/AdminSites');
const AdminUserRoutes  = require('./routes/AdminRoutes/AdminUsers');
const AdminteamsRoutes = require('./routes/AdminRoutes/AdminTeams');

// ---------- ROUTES PUBLIC (lecture) ----------
const siteRoutes  = require('./routes/GeneralRoutes/GeneralSites');
const roleRoutes  = require('./routes/GeneralRoutes/GeneralRoles');
const teamsRoutes = require('./routes/GeneralRoutes/GeneralTeams');

// ---------- ROUTES SETTINGS (endpoints renommés) ----------
const settingsRoutes = require('./routes/SettingsRoutes/settings.routes');
// ##########################CONST ROUTES####################################################

const app = express();

// ---------- TOGGLES ----------
const SWAGGER_ON     = String(process.env.SWAGGER || '').trim().toUpperCase() === 'ON';
const CORS_ON        = String(process.env.CORS || '').trim().toUpperCase() === 'ON';
const TRUST_PROXY_ON = String(process.env.TRUST_PROXY || '').trim().toUpperCase() === 'ON';

// Local sans proxy => OFF ; derrière Traefik/NGINX en prod => ON
app.set('trust proxy', TRUST_PROXY_ON);

// ---------- LOG HTTP (pino) ----------
app.use(httpLogger);

// ---------- SÉCURITÉ & PARSING ----------
app.use(secureHelmet());                       // Helmet
app.use(express.json({ limit: '1mb' }));       // JSON body
app.use(cookieParser());                       // Cookies
app.use(compression());                        // Gzip

// ---------- CORS (activable via env) ----------
if (CORS_ON) {
  // Aide caches/proxies à bien gérer l'origine
  app.use((req, res, next) => { res.header('Vary', 'Origin'); next(); });
  app.use(makeCors()); // prend ses origines autorisées via env.CORS_ORIGINS (config/env.js)
}

// ---------- RATE LIMIT GLOBAL (basique) ----------
app.use(globalLimiter());

// ---------- HEALTHCHECK ----------
app.use('/api', healthRoutes); // GET /api/healthz, GET /api/readyz

// ---------- Swagger ON/OFF ----------
if (SWAGGER_ON) {
  try {
    require('./docs')(app); // UI sur /api/docs
  } catch {
    console.warn('Swagger activé mais fichiers manquants (src/docs).');
  }
} else {
  app.use('/api/docs', (_req, res) => res.status(403).send('API docs disabled (SWAGGER=OFF)'));
}

// ---------- RATE LIMIT ciblé AUTH (après CORS, avant /auth) ----------
app.use('/api/auth', rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

// ##########################APP ROUTES####################################################
// ---------- ROUTES AUTH----------
app.use('/api/auth', authRoutes);

// ---------- ROUTES ADMIN----------
app.use('/api/admin', AdminSiteRoutes);
app.use('/api/admin', AdminUserRoutes);
app.use('/api/admin', AdminteamsRoutes);

// ---------- ROUTES PUBLIC----------
app.use('/api', siteRoutes);
app.use('/api', roleRoutes);
app.use('/api', teamsRoutes);

// ---------- ROUTES SETTINGS (admin-only, endpoints clairs) ----------
app.use('/api/settings', settingsRoutes);
//   ➜ GET    /api/settings/settings-list
//   ➜ PATCH  /api/settings/settings/:id
//   ➜ PATCH  /api/settings/settings-sites/:siteId/modules
// ##########################APP ROUTES####################################################

// ---------- 404 JSON ----------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// ---------- HANDLER ERREURS GLOBAL ----------
app.use(errorHandler);

// ---------- START ----------
const port = Number(env.PORT || 4000);
console.log(
  `[config] PORT=${port} SWAGGER=${SWAGGER_ON ? 'ON' : 'OFF'} CORS=${CORS_ON ? 'ON' : 'OFF'} TRUST_PROXY=${TRUST_PROXY_ON ? 'ON' : 'OFF'}`
);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
