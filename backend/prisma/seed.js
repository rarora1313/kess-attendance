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

  // Shashi — Hashika Nilakshi Samaranayake (b. 25 Jan 1984) PIN: 2501
  await prisma.employee.upsert({
    where: { employeeNumber: 'KHB002' },
    update: { pin: '2501', status: 'active' },
    create: {
      employeeNumber: 'KHB002',
      firstName: 'Shashi',
      lastName: 'Samaranayake',
      pin: '2501',
      branchId: branch.id,
      status: 'active',
    },
  });

  // Hezal — Nimesha Hezal Don Rigobert (b. 6 Jan 1992) PIN: 0601
  await prisma.employee.upsert({
    where: { employeeNumber: 'KHB003' },
    update: { pin: '0601', status: 'active' },
    create: {
      employeeNumber: 'KHB003',
      firstName: 'Hezal',
      lastName: 'Rigobert',
      pin: '0601',
      branchId: branch.id,
      status: 'active',
    },
  });

  // Dev — Davinder Pal Singh (b. 4 Feb 1985) PIN: 0402
  await prisma.employee.upsert({
    where: { employeeNumber: 'KHB004' },
    update: { pin: '0402', status: 'active' },
    create: {
      employeeNumber: 'KHB004',
      firstName: 'Dev',
      lastName: 'Singh',
      pin: '0402',
      branchId: branch.id,
      status: 'active',
    },
  });

  // Fix existing records that were saved with wrong UTC date instead of NZ date
  await prisma.$executeRaw`
    UPDATE "Attendance"
    SET "attendanceDate" = TO_CHAR(
      ("clockIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland',
      'YYYY-MM-DD'
    )
    WHERE "attendanceDate" != TO_CHAR(
      ("clockIn" AT TIME ZONE 'UTC') AT TIME ZONE 'Pacific/Auckland',
      'YYYY-MM-DD'
    )
  `;
  console.log('Fixed attendance dates to NZ timezone.');

  // Close any open sessions from previous days (missed sign-outs)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
  const closed = await prisma.attendance.updateMany({
    where: { clockOut: null, attendanceDate: { lt: today } },
    data: { clockOut: new Date(), totalHours: 0 },
  });
  if (closed.count > 0) console.log(`Closed ${closed.count} missed sign-out(s) — admin should correct hours.`);

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
