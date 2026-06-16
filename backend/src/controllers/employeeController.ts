import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';

const prisma = new PrismaClient();

export async function listEmployees(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.user?.role === 'manager' ? req.user.branchId : undefined;
  const where = branchId ? { branchId } : {};

  const employees = await prisma.employee.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  res.json(employees);
}

export async function getEmployee(req: Request, res: Response): Promise<void> {
  const employee = await prisma.employee.findUnique({
    where: { id: Number(req.params.id) },
    include: { branch: true },
  });
  if (!employee) { res.status(404).json({ error: 'Employee not found' }); return; }
  res.json(employee);
}

export async function createEmployee(req: Request, res: Response): Promise<void> {
  const { employeeNumber, firstName, lastName, email, phone, pin, branchId, scheduledStartTime, scheduledHours } = req.body;
  try {
    const employee = await prisma.employee.create({
      data: {
        employeeNumber, firstName, lastName, email, phone, pin,
        branchId: Number(branchId),
        scheduledStartTime: scheduledStartTime || null,
        scheduledHours: scheduledHours ? Number(scheduledHours) : null,
      },
    });
    res.status(201).json(employee);
  } catch {
    res.status(400).json({ error: 'Employee number or PIN already exists' });
  }
}

export async function updateEmployee(req: Request, res: Response): Promise<void> {
  const { firstName, lastName, email, phone, pin, branchId, status, scheduledStartTime, scheduledHours } = req.body;
  try {
    const employee = await prisma.employee.update({
      where: { id: Number(req.params.id) },
      data: {
        firstName, lastName, email, phone, pin,
        branchId: branchId ? Number(branchId) : undefined,
        status,
        scheduledStartTime: scheduledStartTime ?? undefined,
        scheduledHours: scheduledHours != null ? Number(scheduledHours) : undefined,
      },
    });
    res.json(employee);
  } catch {
    res.status(400).json({ error: 'Update failed' });
  }
}

export async function transferEmployee(req: Request, res: Response): Promise<void> {
  const { branchId } = req.body;
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { branchId: Number(branchId) },
  });
  res.json(employee);
}

export async function createManager(req: Request, res: Response): Promise<void> {
  const bcrypt = await import('bcryptjs');
  const { firstName, lastName, email, password } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role: 'manager',
      },
    });
    res.status(201).json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role });
  } catch {
    res.status(400).json({ error: 'Email already exists' });
  }
}

export async function listManagers(_req: Request, res: Response): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { role: 'manager' },
    select: { id: true, firstName: true, lastName: true, email: true, managedBranch: { select: { id: true, name: true } } },
    orderBy: { firstName: 'asc' },
  });
  res.json(managers);
}
