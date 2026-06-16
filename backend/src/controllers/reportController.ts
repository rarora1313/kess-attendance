import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export async function getAttendanceSummary(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager' ? req.user.branchId : req.query.branchId ? Number(req.query.branchId) : undefined;
  const { startDate, endDate } = req.query as Record<string, string>;

  const records = await prisma.attendance.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      attendanceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      branch: { select: { name: true } },
    },
  });

  // Group by employee
  const byEmployee: Record<number, { name: string; employeeNumber: string; totalHours: number; shifts: number }> = {};
  for (const r of records) {
    const key = r.employeeId;
    if (!byEmployee[key]) {
      byEmployee[key] = {
        name: `${r.employee.firstName} ${r.employee.lastName}`,
        employeeNumber: r.employee.employeeNumber,
        totalHours: 0,
        shifts: 0,
      };
    }
    byEmployee[key].totalHours += r.totalHours ?? 0;
    byEmployee[key].shifts += 1;
  }

  res.json(Object.values(byEmployee).sort((a, b) => a.name.localeCompare(b.name)));
}

export async function exportPayroll(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager' ? req.user.branchId : req.query.branchId ? Number(req.query.branchId) : undefined;
  const { startDate, endDate } = req.query as Record<string, string>;

  const records = await prisma.attendance.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      attendanceDate: { gte: startDate, lte: endDate },
      clockOut: { not: null },
    },
    include: {
      employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
      branch: { select: { name: true } },
    },
    orderBy: [{ employee: { firstName: 'asc' } }, { attendanceDate: 'asc' }],
  });

  const rows = [
    ['Employee Number', 'Employee Name', 'Branch', 'Date', 'Clock In', 'Clock Out', 'Break (min)', 'Total Hours'],
    ...records.map(r => [
      r.employee.employeeNumber,
      `${r.employee.firstName} ${r.employee.lastName}`,
      r.branch.name,
      r.attendanceDate,
      r.clockIn.toISOString(),
      r.clockOut?.toISOString() ?? '',
      r.totalBreakMinutes,
      r.totalHours?.toFixed(2) ?? '',
    ]),
  ];

  const csv = rows.map(row => row.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=payroll_${startDate}_${endDate}.csv`);
  res.send(csv);
}

export async function getDashboardStats(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager' ? req.user.branchId : req.query.branchId ? Number(req.query.branchId) : undefined;
  const today = new Date().toISOString().slice(0, 10);

  const [totalEmployees, presentToday, onBreakToday, pendingTimesheets, totalBranches] = await Promise.all([
    prisma.employee.count({ where: { status: 'active', ...(branchId ? { branchId } : {}) } }),
    prisma.attendance.count({ where: { attendanceDate: today, clockOut: null, ...(branchId ? { branchId } : {}) } }),
    prisma.attendance.count({
      where: {
        attendanceDate: today,
        clockOut: null,
        breaks: { some: { breakEnd: null } },
        ...(branchId ? { branchId } : {}),
      },
    }),
    prisma.timesheet.count({ where: { status: 'submitted', ...(branchId ? { employee: { branchId } } : {}) } }),
    branchId ? 1 : prisma.branch.count({ where: { active: true } }),
  ]);

  res.json({
    totalEmployees,
    presentToday,
    absentToday: totalEmployees - presentToday,
    onBreakToday,
    pendingTimesheets,
    totalBranches,
  });
}
