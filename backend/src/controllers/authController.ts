import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { managedBranch: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, branchId: user.managedBranch?.id },
    process.env.JWT_SECRET as string,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      branchId: user.managedBranch?.id,
    },
  });
}

export async function getMe(req: Request & { user?: { id: number } }, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, managedBranch: true },
  });
  res.json(user);
}
