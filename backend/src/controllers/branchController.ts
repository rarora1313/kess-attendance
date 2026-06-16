import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function listBranches(_req: Request, res: Response): Promise<void> {
  const branches = await prisma.branch.findMany({
    include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(branches);
}

export async function getBranch(req: Request, res: Response): Promise<void> {
  const branch = await prisma.branch.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      employees: { where: { status: 'active' } },
    },
  });
  if (!branch) { res.status(404).json({ error: 'Branch not found' }); return; }
  res.json(branch);
}

export async function createBranch(req: Request, res: Response): Promise<void> {
  const { name, code, address, managerId } = req.body;
  try {
    const branch = await prisma.branch.create({
      data: { name, code, address, managerId: managerId ? Number(managerId) : undefined },
    });
    res.status(201).json(branch);
  } catch {
    res.status(400).json({ error: 'Branch code already exists or invalid manager' });
  }
}

export async function updateBranch(req: Request, res: Response): Promise<void> {
  const { name, code, address, managerId, active } = req.body;
  try {
    const branch = await prisma.branch.update({
      where: { id: Number(req.params.id) },
      data: { name, code, address, managerId: managerId ? Number(managerId) : undefined, active },
    });
    res.json(branch);
  } catch {
    res.status(400).json({ error: 'Update failed' });
  }
}
