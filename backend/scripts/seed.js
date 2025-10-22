// scripts/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { hash } = require('../src/lib/auth');

const prisma = new PrismaClient();

(async () => {
  try {
    const company  = process.env.COMPANY_NAME     || 'TaskFlow';
    const username = process.env.USERNAME_ADMIN   || 'admin_global';
    const password = process.env.USERNAME_PASSWORD|| 'admin123';
    const email    = process.env.ADMIN_EMAIL      || `${username}@example.com`; //admin_global@example.com

    // 1) Rôles (fixes)
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

    // 2) CoreSetting (limites + modules — utilise les defaults si présents)
    const setting = await prisma.coreSetting.upsert({
      where: { name: company },
      update: {},
      create: {
        name: company,
        // optionnel: ne définir que ce que ton schema accepte (sinon laisser les defaults)
        availableModules: { stock: true },
      },
    });

    // 3) Site par défaut (lié au setting)
    const site = await prisma.coreSite.upsert({
      where: { name: company },
      update: { settingId: setting.id },
      create: { name: company, settingId: setting.id },
    });

    // 4) Admin user (hash only, pas de passwordEnc/*)
    const passwordHash = await hash(password);
    const existing = await prisma.coreUser.findUnique({ where: { username } });

    if (!existing) {
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
          // l’admin est aussi membre du site par défaut (manager=true par commodité)
          memberships: {
            create: { siteId: site.id, isManager: true },
          },
        },
      });
      console.log(`Seed ➜ admin créé: ${created.username} / ${password}`);
    } else {
      await prisma.coreUser.update({
        where: { id: existing.id },
        data: {
          roleId: adminRole.id,
          isActive: true,
          passwordHash,
          mustChangePwd: false,
          primarySiteId: site.id,
          tokenVersion: { increment: 1 },
        },
      });
      // s’assurer de la membership au site
      await prisma.coreSiteMember.upsert({
        where: { siteId_userId: { siteId: site.id, userId: existing.id } },
        update: { isManager: true },
        create: { siteId: site.id, userId: existing.id, isManager: true },
      });
      console.log(`Seed ➜ admin réinitialisé: ${existing.username} / ${password}`);
    }

    console.log(`Seed terminé. Site="${site.name}" Setting="${setting.name}"`);
  } catch (e) {
    console.error('seed error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
