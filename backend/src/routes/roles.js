// src/routes/roles.js
const { Router } = require('express');
const { RoleName } = require('@prisma/client');
const { requireAuth } = require('../mw/auth');

const r = Router();

// Rôles figés issus de l'enum Prisma: ["ADMIN", "OWNER", "MANAGER", "USER"]
const FIXED_ROLES = Object.values(RoleName);

// GET /api/roles -> liste des rôles figés
r.get('/roles', requireAuth, (_req, res) => {
  res.json(FIXED_ROLES);
});

// (optionnel) GET /api/roles/:name -> vérifier l'existence d'un rôle
r.get('/roles/:name', requireAuth, (req, res) => {
  const name = String(req.params.name || '').toUpperCase();
  if (FIXED_ROLES.includes(name)) return res.json({ name });
  return res.status(404).json({ error: 'Unknown role' });
});

// Toute opération de création/édition/suppression est interdite
const blocked = (_req, res) =>
  res.status(403).json({
    error:
      'Role CRUD disabled. Roles are fixed: ADMIN, OWNER, MANAGER, USER.',
  });

r.post('/roles', requireAuth, blocked);
r.patch('/roles/:id', requireAuth, blocked);
r.delete('/roles/:id', requireAuth, blocked);

module.exports = r;
