import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const PHOTOS_DIR = path.join(__dirname, '../../uploads/photos');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

function savePhoto(base64: string, filename: string): string | null {
  try {
    const data = base64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(path.join(PHOTOS_DIR, filename), Buffer.from(data, 'base64'));
    return `/uploads/photos/${filename}`;
  } catch {
    return null;
  }
}

// ── Kiosk (no auth required, employee identified by PIN) ─────────────────────

export async function kioskAction(req: Request, res: Response): Promise<void> {
  const { pin, action, branchId, photo } = req.body;
  // action: "clockIn" | "breakStart" | "breakEnd" | "clockOut"

  const employee = await prisma.employee.findUnique({ where: { pin } });
  if (!employee || employee.status !== 'active') {
    res.status(404).json({ error: 'Employee not found or inactive' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  let attendance = await prisma.attendance.findFirst({
    where: { employeeId: employee.id, attendanceDate: today, clockOut: null },
    include: { breaks: { where: { breakEnd: null } } },
    orderBy: { clockIn: 'desc' },
  });

  switch (action) {
    case 'clockIn': {
      if (attendance) { res.status(400).json({ error: 'Already clocked in' }); return; }
      attendance = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          branchId: Number(branchId) || employee.branchId,
          attendanceDate: today,
          clockIn: new Date(),
        },
        include: { breaks: true },
      });
      if (photo) {
        const photoPath = savePhoto(photo, `${attendance.id}_in_${Date.now()}.jpg`);
        if (photoPath) {
          await prisma.attendance.update({
            where: { id: attendance.id },
            data: { clockInPhoto: photoPath },
          });
        }
      }
      break;
    }
    case 'breakStart': {
      if (!attendance) { res.status(400).json({ error: 'Not clocked in' }); return; }
      if (attendance.breaks.length > 0) { res.status(400).json({ error: 'Break already in progress' }); return; }
      await prisma.break.create({ data: { attendanceId: attendance.id, breakStart: new Date() } });
      break;
    }
    case 'breakEnd': {
      if (!attendance) { res.status(400).json({ error: 'Not clocked in' }); return; }
      const openBreak = attendance.breaks[0];
      if (!openBreak) { res.status(400).json({ error: 'No break in progress' }); return; }
      const now = new Date();
      const duration = Math.round((now.getTime() - openBreak.breakStart.getTime()) / 60000);
      await prisma.break.update({
        where: { id: openBreak.id },
        data: { breakEnd: now, durationMinutes: duration },
      });
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: { totalBreakMinutes: { increment: duration } },
      });
      break;
    }
    case 'clockOut': {
      if (!attendance) { res.status(400).json({ error: 'Not clocked in' }); return; }
      const now = new Date();
      const hoursWorked =
        (now.getTime() - attendance.clockIn.getTime()) / 3600000 - attendance.totalBreakMinutes / 60;
      const updateData: any = {
        clockOut: now,
        totalHours: Math.max(0, parseFloat(hoursWorked.toFixed(2))),
      };
      if (photo) {
        const photoPath = savePhoto(photo, `${attendance.id}_out_${Date.now()}.jpg`);
        if (photoPath) updateData.clockOutPhoto = photoPath;
      }
      await prisma.attendance.update({ where: { id: attendance.id }, data: updateData });
      break;
    }
    default:
      res.status(400).json({ error: 'Invalid action' }); return;
  }

  // Return totalHours on clockOut so kiosk can pre-fill the timesheet form
  let totalHours: number | null = null;
  if (action === 'clockOut' && attendance) {
    const updated = await prisma.attendance.findUnique({ where: { id: attendance.id } });
    totalHours = updated?.totalHours ?? null;
  }

  res.json({
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName },
    action,
    totalHours,
  });
}

export async function getEmployeeStatus(req: Request, res: Response): Promise<void> {
  const { pin } = req.query;
  const employee = await prisma.employee.findUnique({ where: { pin: String(pin) } });
  if (!employee) { res.status(404).json({ error: 'Not found' }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const attendance = await prisma.attendance.findFirst({
    where: { employeeId: employee.id, attendanceDate: today, clockOut: null },
    include: { breaks: { where: { breakEnd: null } } },
  });

  res.json({
    employee: { firstName: employee.firstName, lastName: employee.lastName },
    clockedIn: !!attendance,
    onBreak: attendance ? attendance.breaks.length > 0 : false,
    clockInTime: attendance?.clockIn,
  });
}

// ── Manager / Admin views ────────────────────────────────────────────────────

export async function listAttendance(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager'
    ? req.user.branchId
    : req.query.branchId ? Number(req.query.branchId) : undefined;
  const date = req.query.date as string | undefined;
  const today = new Date().toISOString().slice(0, 10);

  const records = await prisma.attendance.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(date ? { attendanceDate: date } : {}),
    },
    include: {
      employee: {
        select: {
          firstName: true, lastName: true, employeeNumber: true,
          scheduledStartTime: true, scheduledHours: true,
        },
      },
      branch: { select: { name: true } },
      breaks: true,
    },
    orderBy: { clockIn: 'desc' },
  });

  // Compute flags for each record
  const enriched = records.map(r => {
    // Late detection (>14 min grace)
    let isLate = false;
    let lateByMinutes = 0;
    if (r.employee.scheduledStartTime) {
      const [sh, sm] = r.employee.scheduledStartTime.split(':').map(Number);
      const scheduledMinutes = sh * 60 + sm;
      const clockInMinutes   = new Date(r.clockIn).getHours() * 60 + new Date(r.clockIn).getMinutes();
      lateByMinutes = clockInMinutes - scheduledMinutes;
      isLate = lateByMinutes > 14;
    }

    // Overtime detection (>30 min grace)
    let isOvertime = false;
    let overtimeHours = 0;
    if (r.totalHours != null && r.employee.scheduledHours != null) {
      overtimeHours = parseFloat((r.totalHours - r.employee.scheduledHours).toFixed(2));
      isOvertime = overtimeHours > 0.5;
    }

    // Missing sign-out: open session from a previous day
    const isMissingSignout = !r.clockOut && r.attendanceDate < today;

    return { ...r, isLate, lateByMinutes, isOvertime, overtimeHours, isMissingSignout };
  });

  res.json(enriched);
}

export async function correctAttendance(req: Request, res: Response): Promise<void> {
  const { clockIn, clockOut, totalHours } = req.body;
  const updated = await prisma.attendance.update({
    where: { id: Number(req.params.id) },
    data: {
      ...(clockIn ? { clockIn: new Date(clockIn) } : {}),
      ...(clockOut ? { clockOut: new Date(clockOut) } : {}),
      ...(totalHours !== undefined ? { totalHours: Number(totalHours) } : {}),
    },
  });
  res.json(updated);
}
