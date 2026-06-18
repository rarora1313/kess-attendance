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

  // Existing test staff
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

  // Shashi — Hashika Nilakshi Samaranayake (b. 25 Jan 1984)
  await prisma.employee.upsert({
    where: { pin: '2501' },
    update: { status: 'active' },
    create: {
      employeeNumber: 'KHB002',
      firstName: 'Shashi',
      lastName: 'Samaranayake',
      pin: '2501',
      branchId: branch.id,
      status: 'active',
    },
  });

  // Hezal — Nimesha Hezal Don Rigobert (b. 6 Jan 1992)
  await prisma.employee.upsert({
    where: { pin: '0601' },
    update: { status: 'active' },
    create: {
      employeeNumber: 'KHB003',
      firstName: 'Hezal',
      lastName: 'Rigobert',
      pin: '0601',
      branchId: branch.id,
      status: 'active',
    },
  });

  // Dev — Davinder Pal Singh (b. 4 Feb 1985)
  await prisma.employee.upsert({
    where: { pin: '0402' },
    update: { status: 'active' },
    create: {
      employeeNumber: 'KHB004',
      firstName: 'Dev',
      lastName: 'Singh',
      pin: '0402',
      branchId: branch.id,
      status: 'active',
    },
  });

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
