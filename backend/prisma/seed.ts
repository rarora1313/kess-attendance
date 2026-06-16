import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Admin user
  await prisma.user.upsert({
    where: { email: 'admin@kesshairdbeauty.com' },
    update: {},
    create: {
      firstName: 'Admin',
      lastName: 'Kess',
      email: 'admin@kesshairdbeauty.com',
      passwordHash: await bcrypt.hash('admin123', 10),
      role: 'admin',
    },
  });

  // Botany branch
  const botany = await prisma.branch.upsert({
    where: { code: 'BOTANY' },
    update: {},
    create: { name: 'Kess Hair & Beauty — Botany', code: 'BOTANY', address: 'Botany, Auckland' },
  });

  // Sample staff member — upsert by PIN so re-runs don't conflict
  await prisma.employee.upsert({
    where: { pin: '1234' },
    update: { employeeNumber: 'KHB001', firstName: 'Staff', lastName: 'Member', branchId: botany.id, status: 'active' },
    create: {
      employeeNumber: 'KHB001',
      firstName: 'Staff',
      lastName: 'Member',
      pin: '1234',
      branchId: botany.id,
      status: 'active',
    },
  });

  console.log('Seed complete.');
  console.log('Admin login: admin@kesshairdbeauty.com / admin123');
  console.log('Branch: Kess Hair & Beauty — Botany');
}

main().catch(console.error).finally(() => prisma.$disconnect());
