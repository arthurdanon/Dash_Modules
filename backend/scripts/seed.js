require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const { hash } = require('../src/lib/auth');
const { encryptPassword } = require('../src/lib/crypto');
const prisma = new PrismaClient();

(async () => {
  // Rôles par défaut
  const roles = [
    { name: 'ADMIN',   isAdmin: true,  isManager: false },
    { name: 'MANAGER', isAdmin: false, isManager: true  },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: r,
      create: r,
    });
  }

  const site = await prisma.site.upsert({
    where: { name: process.env.COMPANY_NAME },
    update: {},
    create: { name: process.env.COMPANY_NAME }
  });

  // Admin global
  const username = process.env.USERNAME_ADMIN;
  const plainPwd = process.env.USERNAME_PASSWORD;
  const { enc, iv, tag } = encryptPassword(plainPwd);

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' }});

  const exists = await prisma.user.findUnique({ where: { username }});
  if (!exists) {
    await prisma.user.create({
      data: {
        roleId: adminRole.id,
        firstName: 'Admin',
        lastName: 'Global',
        username,
        passwordHash: await hash(plainPwd),
        passwordEnc: enc, passwordIv: iv, passwordTag: tag,
        mustChangePwd: false
      }
    });
  }

  console.log('Seed done. Login:', username, '/', plainPwd, ' Site:', site.name);
  await prisma.$disconnect();
})();
