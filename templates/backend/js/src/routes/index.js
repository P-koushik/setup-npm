import { Router } from 'express';
import { userRouter } from './userRoutes.js';

const apiRouter = Router();

apiRouter.use('/users', userRouter);

export { apiRouter };
