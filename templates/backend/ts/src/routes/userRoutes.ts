import { Router } from 'express';
import { createUser, listUsers } from '../controllers/userController.js';

const userRouter = Router();

userRouter.get('/', listUsers);
userRouter.post('/', createUser);

export { userRouter };
