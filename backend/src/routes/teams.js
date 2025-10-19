// src/routes/teams.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// CREATE TEAM
router.post('/teams', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing team name' });
    const team = await prisma.team.create({ data: { name } });
    res.status(201).json(team);
  } catch (e) { next(e); }
});

// ASSIGN MANAGER to TEAM (user must have role MANAGER or OWNER or ADMIN if tu veux)
router.patch('/teams/:id/manager', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { managerId } = req.body;
    if (!managerId) return res.status(400).json({ error: 'Missing managerId' });

    const manager = await prisma.user.findUnique({ where: { id: Number(managerId) } });
    if (!manager) return res.status(404).json({ error: 'Manager user not found' });

    if (!['MANAGER', 'OWNER', 'ADMIN'].includes(manager.role)) {
      return res.status(400).json({ error: 'User is not eligible as team manager' });
    }

    const team = await prisma.team.update({
      where: { id },
      data: { managerId: manager.id },
    });

    res.json(team);
  } catch (e) { next(e); }
});

// ADD MEMBER to TEAM
router.post('/teams/:id/members', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    const member = await prisma.teamMember.create({
      data: { teamId: id, userId: Number(userId) },
    });

    res.status(201).json(member);
  } catch (e) {
    // gère l’unicité teamId+userId
    if (e.code === 'P2002') return res.status(409).json({ error: 'User already in team' });
    next(e);
  }
});

// REMOVE MEMBER
router.delete('/teams/:teamId/members/:userId', async (req, res, next) => {
  try {
    const teamId = Number(req.params.teamId);
    const userId = Number(req.params.userId);
    const tm = await prisma.teamMember.findFirst({ where: { teamId, userId } });
    if (!tm) return res.status(404).json({ error: 'Membership not found' });

    await prisma.teamMember.delete({ where: { id: tm.id } });
    res.status(204).send();
  } catch (e) { next(e); }
});

// LIST TEAMS (avec manager + membres)
router.get('/teams', async (_req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      include: {
        manager: { select: { id: true, username: true, role: true } },
        members: { include: { user: { select: { id: true, username: true, role: true } } } },
      },
    });
    res.json(teams);
  } catch (e) { next(e); }
});

module.exports = router;
