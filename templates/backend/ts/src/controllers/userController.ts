import type { NextFunction, Request, Response } from 'express';
import { User } from '../models/User.js';

export async function listUsers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ data: users });
  } catch (error) {
    next(error);
  }
}

export async function createUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, email } = req.body as { name: string; email: string };

    const user = await User.create({
      name,
      email
    });

    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}
