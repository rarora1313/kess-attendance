import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export async function listTimesheets(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager' ? req.user.branchId : undefined;
  const { status, employeeId } = req.query;

  const timesheets = await prisma.timesheet.findMany({
    where: {
      ...(branchId ? { employee: { branchId } } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(employeeId ? { employeeId: Number(employeeId) } : {}),
    },
    include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, branch: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(timesheets);
}

export async function createTimesheet(req: Request, res: Response): Promise<void> {
  const { employeeId, date, taskName, description, hoursWorked, status } = req.body;
  const ts = await prisma.timesheet.create({
    data: {
      employeeId: Number(employeeId),
      date,
      taskName,
      description,
      hoursWorked: Number(hoursWorked),
      status: status ?? 'draft',
    },
  });
  res.status(201).json(ts);
}

// Public kiosk endpoint — employee submits their own timesheet via PIN
export async function kioskSubmitTimesheet(req: Request, res: Response): Promise<void> {
  const { pin, taskName, hoursWorked, description, date } = req.body;

  const employee = await prisma.employee.findUnique({ where: { pin } });
  if (!employee || employee.status !== 'active') {
    res.status(404).json({ error: 'Employee not found' });
    return;
  }

  const ts = await prisma.timesheet.create({
    data: {
      employeeId: employee.id,
      date: date ?? new Date().toISOString().slice(0, 10),
      taskName,
      description,
      hoursWorked: Number(hoursWorked),
      status: 'submitted',
    },
  });
  res.status(201).json(ts);
}

export async function updateTimesheetStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = req.body;
  const allowed = req.user?.role === 'admin'
    ? ['draft', 'submitted', 'approved', 'rejected']
    : ['approved', 'rejected'];

  if (!allowed.includes(status)) {
    res.status(403).json({ error: 'Cannot set that status' }); return;
  }

  const ts = await prisma.timesheet.update({
    where: { id: Number(req.params.id) },
    data: { status },
  });
  res.json(ts);
}
