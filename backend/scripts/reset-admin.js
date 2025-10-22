// scripts/reset-admin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { hash } = require('../src/lib/auth');

const prisma = new PrismaClient();

(async () => {
  try {
    const company  = process.env.COMPANY_NAME      || 'TaskFlow';
    const username = process.env.USERNAME_ADMIN    || 'admin_global';
    const password = process.env.USERNAME_PASSWORD || 'admin123';
    const email    = process.env.ADMIN_EMAIL       || `${username}@example.com`;

    // Rôles (idempotent)
    const roles = [
      { name: 'ADMIN',   isAdmin: true,  isOwner: false, isManager: false },
      { name: 'OWNER',   isAdmin: false, isOwner: true,  isManager: false },
      { name: 'MANAGER', isAdmin: false, isOwner: false, isManager: true  },
      { name: 'USER',    isAdmin: false, isOwner: false, isManager: false },
    ];
    for (const r of roles) {
      await prisma.coreRole.upsert({
        where: { name: r.name },
        update: r,
        create: r,
      });
    }
    const adminRole = await prisma.coreRole.findUnique({ where: { name: 'ADMIN' } });

    // Setting + Site (idempotent)
    const setting = await prisma.coreSetting.upsert({
      where: { name: company },
      update: {},
      create: {
        name: company,
        availableModules: { stock: true },
      },
    });

    const site = await prisma.coreSite.upsert({
      where: { name: company },
      update: { settingId: setting.id },
      create: { name: company, settingId: setting.id },
    });

    // Admin (reset/create)
    const u = await prisma.coreUser.findUnique({ where: { username } });
    const passwordHash = await hash(password);

    if (!u) {
      const created = await prisma.coreUser.create({
        data: {
          username,
          email,
          firstName: 'Admin',
          lastName: 'Global',
          roleId: adminRole.id,
          passwordHash,
          mustChangePwd: false,
          isActive: true,
          primarySiteId: site.id,
          memberships: {
            create: { siteId: site.id, isManager: true },
          },
        },
      });
      console.log(`Admin créé: ${created.username} / ${password}`);
    } else {
      await prisma.coreUser.update({
        where: { id: u.id },
        data: {
          roleId: adminRole.id,
          isActive: true,
          passwordHash,
          mustChangePwd: false,
          primarySiteId: site.id,
          tokenVersion: { increment: 1 },
        },
      });
      await prisma.coreSiteMember.upsert({
        where: { siteId_userId: { siteId: site.id, userId: u.id } },
        update: { isManager: true },
        create: { siteId: site.id, userId: u.id, isManager: true },
      });
      console.log(`Admin réinitialisé: ${username} / ${password}`);
    }
  } catch (e) {
    console.error('reset-admin error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
