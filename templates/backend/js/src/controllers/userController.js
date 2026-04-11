import { User } from '../models/User.js';

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ data: users });
  } catch (error) {
    next(error);
  }
}

export async function createUser(req, res, next) {
  try {
    const { name, email } = req.body;

    const user = await User.create({
      name,
      email
    });

    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
}
