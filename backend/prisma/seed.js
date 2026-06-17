const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@kesshairdbeauty.com' },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Kess',
      email: 'admin@kesshairdbeauty.com',
      passwordHash: hash,
      role: 'admin',
    },
  });

  const branch = await prisma.branch.upsert({
    where: { code: 'BOTANY' },
    update: {},
    create: { name: 'Kess Hair & Beauty — Botany', code: 'BOTANY', address: 'Botany, Auckland' },
  });

  await prisma.employee.upsert({
    where: { pin: '1234' },
    update: { status: 'active' },
    create: {
      employeeNumber: 'KHB001',
      firstName: 'Staff',
      lastName: 'Member',
      pin: '1234',
      branchId: branch.id,
      status: 'active',
    },
  });

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
