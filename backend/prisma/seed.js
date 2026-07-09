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

  // One-time correction: add missed breaks for Shashi (30min) and Dev (1hr)
  // Find their most recent completed shift with no break logged (within last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const shashiRecord = await prisma.attendance.findFirst({
    where: {
      employee: { employeeNumber: 'KHB002' },
      clockOut: { not: null },
      totalBreakMinutes: 0,
      attendanceDate: { gte: sevenDaysAgo },
    },
    orderBy: { clockIn: 'desc' },
  });
  if (shashiRecord) {
    await prisma.attendance.update({
      where: { id: shashiRecord.id },
      data: {
        totalBreakMinutes: 30,
        totalHours: Math.max(0, parseFloat(((shashiRecord.totalHours ?? 0) - 0.5).toFixed(2))),
      },
    });
    console.log('Corrected Shashi break: 30 min on', shashiRecord.attendanceDate);
  }

  const devRecord = await prisma.attendance.findFirst({
    where: {
      employee: { employeeNumber: 'KHB004' },
      clockOut: { not: null },
      totalBreakMinutes: 0,
      attendanceDate: { gte: sevenDaysAgo },
    },
    orderBy: { clockIn: 'desc' },
  });
  if (devRecord) {
    await prisma.attendance.update({
      where: { id: devRecord.id },
      data: {
        totalBreakMinutes: 60,
        totalHours: Math.max(0, parseFloat(((devRecord.totalHours ?? 0) - 1).toFixed(2))),
      },
    });
    console.log('Corrected Dev break: 60 min on', devRecord.attendanceDate);
  }

  // Correction: Hezal Tuesday 8 July 2026 — 9 AM to 6 PM (9 hrs), NZ time (UTC+12)
  const hezalTuesday = await prisma.attendance.findFirst({
    where: { employee: { employeeNumber: 'KHB003' }, attendanceDate: '2026-07-08' },
    orderBy: { clockIn: 'desc' },
  });
  if (hezalTuesday) {
    await prisma.attendance.update({
      where: { id: hezalTuesday.id },
      data: {
        clockIn:  new Date('2026-07-07T21:00:00.000Z'), // 9 AM NZST
        clockOut: new Date('2026-07-08T06:00:00.000Z'), // 6 PM NZST
        totalHours: 9,
      },
    });
    console.log('Corrected Hezal 8 July: 9 AM–6 PM, 9h');
  } else {
    const hezalBranch = await prisma.employee.findFirst({ where: { employeeNumber: 'KHB003' } });
    if (hezalBranch) {
      await prisma.attendance.create({
        data: {
          employeeId: hezalBranch.id,
          branchId: hezalBranch.branchId,
          attendanceDate: '2026-07-08',
          clockIn:  new Date('2026-07-07T21:00:00.000Z'),
          clockOut: new Date('2026-07-08T06:00:00.000Z'),
          totalHours: 9,
          totalBreakMinutes: 0,
        },
      });
      console.log('Created Hezal 8 July: 9 AM–6 PM, 9h');
    }
  }

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
