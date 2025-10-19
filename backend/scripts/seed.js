// scripts/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient, RoleName } = require('@prisma/client');
const { hash } = require('../src/lib/auth');
const { encryptPassword } = require('../src/lib/crypto');

const prisma = new PrismaClient();

(async () => {
  try {
    // --- ENV & helpers ---
    const COMPANY_NAME = process.env.COMPANY_NAME || 'TaskFlow';
    const ADMIN_USERNAME = process.env.USERNAME_ADMIN || 'admin_global';
    const ADMIN_PASSWORD = process.env.USERNAME_PASSWORD || 'admin123';

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      throw new Error('USERNAME_ADMIN et USERNAME_PASSWORD doivent être définis dans .env');
    }

    // --- Site par défaut ---
    const site = await prisma.site.upsert({
      where: { name: COMPANY_NAME },
      update: {},
      create: { name: COMPANY_NAME },
    });

    // --- Vérifie l’état des ADMINs ---
    const adminCount = await prisma.user.count({ where: { role: RoleName.ADMIN } });

    // (A) Si aucun ADMIN -> créer un ADMIN bootstrap
    if (adminCount === 0) {
      const { enc, iv, tag } = encryptPassword(ADMIN_PASSWORD);
      const passwordHash = await hash(ADMIN_PASSWORD);

      await prisma.user.create({
        data: {
          username: ADMIN_USERNAME,
          firstName: 'Admin',
          lastName: 'Global',
          role: RoleName.ADMIN,
          passwordHash,
          passwordEnc: enc,
          passwordIv: iv,
          passwordTag: tag,
          mustChangePwd: false,
          siteId: site.id,
        },
      });

      console.log(`Seed: ADMIN '${ADMIN_USERNAME}' créé pour le site '${site.name}'.`);
      console.log(`        Login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
      return;
    }

    // (B) Si un ADMIN existe déjà :
    //     - si l'utilisateur ADMIN_USERNAME existe mais n'est pas ADMIN -> promotion en ADMIN
    //     - sinon, ne rien faire (on respecte "un seul ADMIN" côté API/usage)
    const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });

    if (existing && existing.role !== RoleName.ADMIN) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: RoleName.ADMIN },
      });
      console.log(`Seed: utilisateur '${ADMIN_USERNAME}' promu en ADMIN (un ADMIN existait déjà).`);
    } else {
      console.log('Seed: ADMIN déjà présent, aucune création supplémentaire.');
    }

    console.log(`Site par défaut: ${site.name}`);
  } catch (e) {
    console.error('Seed error:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
