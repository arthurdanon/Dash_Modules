// scripts/reset-admin.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const { hash } = require('../src/lib/auth'); // même helper que ton seed
const prisma = new PrismaClient();

(async () => {
  try {
    const username = process.env.USERNAME_ADMIN || 'admin_global';
    const password = process.env.USERNAME_PASSWORD || 'admin123';

    const u = await prisma.user.findUnique({ where: { username } });

    if (!u) {
      // (re)création si absent
      const site = await prisma.site.upsert({
        where: { name: process.env.COMPANY_NAME || 'TaskFlow' },
        update: {},
        create: { name: process.env.COMPANY_NAME || 'TaskFlow' },
      });
      const passwordHash = await hash(password);
      const { encryptPassword } = require('../src/lib/crypto');
      const { enc, iv, tag } = encryptPassword(password);

      const created = await prisma.user.create({
        data: {
          username,
          firstName: 'Admin',
          lastName: 'Global',
          role: 'ADMIN',
          passwordHash,
          passwordEnc: enc,
          passwordIv: iv,
          passwordTag: tag,
          mustChangePwd: false,
          isActive: true,
          siteId: site.id,
        },
      });
      console.log(`Admin créé: ${created.username} / ${password}`);
    } else {
      // reset du mot de passe + rôle/activation
      const passwordHash = await hash(password);
      const { encryptPassword } = require('../src/lib/crypto');
      const { enc, iv, tag } = encryptPassword(password);

      const updated = await prisma.user.update({
        where: { id: u.id },
        data: {
          role: 'ADMIN',
          isActive: true,
          passwordHash,
          passwordEnc: enc,
          passwordIv: iv,
          passwordTag: tag,
          mustChangePwd: false,
        },
      });
      console.log(`Admin réinitialisé: ${updated.username} / ${password}`);
    }
  } catch (e) {
    console.error('reset-admin error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
