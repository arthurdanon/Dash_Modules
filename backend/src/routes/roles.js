const { Router } = require('express');
const { PrismaClient } = require('@prisma/client');
const { requireAuth, requireAdmin } = require('../mw/auth');
const prisma = new PrismaClient();
const r = Router();

const RESERVED_ROLE_NAMES = ['ADMIN', 'MANAGER'];

// Créer un rôle (ADMIN ou MANAGER)
// - ADMIN: peut choisir isAdmin/isManager
// - MANAGER: forcé à isAdmin=false, isManager=false
r.post('/roles', requireAuth, async (req, res) => {
  const me = req.me;
  if (!me?.role?.isAdmin && !me?.role?.isManager) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let { name, isAdmin = false, isManager = false } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  name = name.trim();

  // managers ne peuvent pas créer des rôles “puissants”
  if (me.role.isManager && !me.role.isAdmin) {
    isAdmin = false;
    isManager = false;
  }

  // empêcher de créer des doublons protégés
  if (RESERVED_ROLE_NAMES.includes(name.toUpperCase())) {
    return res.status(409).json({ error: `Role ${name} is reserved` });
  }

  try {
    const role = await prisma.role.create({ data: { name, isAdmin, isManager } });
    res.json(role);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Role name already exists' });
    console.error('create role', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Lister les rôles (auth)
r.get('/roles', requireAuth, async (_req, res) => {
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  res.json(roles);
});

// Modifier (ADMIN only)
r.patch('/roles/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, isAdmin, isManager } = req.body;

  const current = await prisma.role.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: 'Not found' });
  if (RESERVED_ROLE_NAMES.includes(current.name.toUpperCase())) {
    // autoriser rename / flags ? on bloque pour éviter de casser les règles
    return res.status(403).json({ error: 'Reserved role cannot be modified' });
  }

  const data = {};
  if (typeof name === 'string' && name.trim()) {
    if (RESERVED_ROLE_NAMES.includes(name.trim().toUpperCase()))
      return res.status(409).json({ error: 'Target name is reserved' });
    data.name = name.trim();
  }
  if (typeof isAdmin === 'boolean')  data.isAdmin = isAdmin;
  if (typeof isManager === 'boolean') data.isManager = isManager;

  const role = await prisma.role.update({ where: { id }, data });
  res.json(role);
});

// Supprimer (ADMIN ou MANAGER) — mais interdit pour ADMIN/MANAGER et si utilisé
r.delete('/roles/:id', requireAuth, async (req, res) => {
  const me = req.me;
  if (!me?.role?.isAdmin && !me?.role?.isManager) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { id } = req.params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) return res.status(404).json({ error: 'Not found' });

  if (RESERVED_ROLE_NAMES.includes(role.name.toUpperCase())) {
    return res.status(403).json({ error: 'Cannot delete reserved roles' });
  }

  const inUse = await prisma.user.count({ where: { roleId: id } });
  if (inUse > 0) return res.status(409).json({ error: 'Role in use by users' });

  await prisma.role.delete({ where: { id } });
  res.json({ ok: true });
});

// POST /api/roles (ADMIN ou MANAGER) → crée toujours un rôle "user simple"
r.post('/roles', requireAuth, async (req, res) => {
  const me = req.me;
  if (!me?.role?.isAdmin && !me?.role?.isManager) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  let { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });
  name = name.trim();

  if (RESERVED_ROLE_NAMES.includes(name.toUpperCase())) {
    return res.status(409).json({ error: `Role ${name} is reserved` });
  }

  try {
    const role = await prisma.role.create({
      data: { name, isAdmin: false, isManager: false }, // <- forcé
    });
    res.json(role);
  } catch (e) {
    if (e.code === 'P2002') return res.status(409).json({ error: 'Role name already exists' });
    console.error('create role', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = r;
