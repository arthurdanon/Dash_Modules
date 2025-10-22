// backend/src/server.js
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// ##########################CONST ROUTES####################################################
// ---------- ROUTES AUTH----------
const authRoutes = require('./routes/AuthRoutes');
// ---------- ROUTES ADMIN----------
const AdminSiteRoutes = require('./routes/AdminRoutes/AdminSites');
const AdminUserRoutes = require('./routes/AdminRoutes/AdminUsers');
const AdminteamsRoutes = require('./routes/AdminRoutes/AdminTeams');
// ---------- ROUTES PUBLIC----------
const siteRoutes = require('./routes/GeneralRoutes/GeneralSites');
const roleRoutes = require('./routes/GeneralRoutes/GeneralRoles'); //mise a jour 
const teamsRoutes = require('./routes/GeneralRoutes/GeneralTeams');
// ---------- ROUTES SETTINGS----------
const settingsRoutes = require('./routes/SettingsRoutes/settings');
// ##########################CONST ROUTES####################################################


const app = express();

// ---------- TOGGLES ----------
const SWAGGER_ON     = String(process.env.SWAGGER || '').trim().toUpperCase() === 'ON';
const CORS_ON        = String(process.env.CORS || '').trim().toUpperCase() === 'ON';
const TRUST_PROXY_ON = String(process.env.TRUST_PROXY || '').trim().toUpperCase() === 'ON';

// Local sans proxy => OFF ; derrière Traefik/NGINX en prod => ON
app.set('trust proxy', TRUST_PROXY_ON);

// ---------- MIDDLEWARES GLOBAUX ----------
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ---------- CORS (activable via env) ----------
if (CORS_ON) {
  const allowed = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const corsOptions = {
    origin(origin, cb) {
      // autorise aussi curl/postman (sans Origin)
      if (!origin || allowed.includes(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // optionsSuccessStatus: 204, // (optionnel) si 204 pose souci
  };

  // aide caches/proxies
  app.use((req, res, next) => { res.header('Vary', 'Origin'); next(); });

  // suffit pour gérer les preflights OPTIONS sur Express 5
  app.use(cors(corsOptions));
}

// ---------- HEALTHCHECK ----------
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

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

// ---------- RATE LIMIT (après CORS, avant /auth) ----------
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
// ---------- ROUTES SETTINGS----------
app.use('/api/settings', settingsRoutes);
// ##########################APP ROUTES####################################################


// ---------- 404 JSON ----------
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not Found' }));

// ---------- HANDLER ERREURS ----------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  const msg = (process.env.NODE_ENV === 'production') ? 'Internal Server Error' : (err.message || 'Internal Error');
  res.status(status).json({ error: msg });
});

// ---------- START ----------
const port = Number(process.env.PORT || 4000);
console.log(`[config] SWAGGER=${SWAGGER_ON ? 'ON' : 'OFF'} CORS=${CORS_ON ? 'ON' : 'OFF'} TRUST_PROXY=${TRUST_PROXY_ON ? 'ON' : 'OFF'}`);
app.listen(port, () => console.log(`API on http://localhost:${port}`));
