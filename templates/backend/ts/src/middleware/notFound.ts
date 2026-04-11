import type { NextFunction, Request, Response } from 'express';

type HttpError = Error & {
  statusCode?: number;
};

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error: HttpError = new Error(
    `Route not found: ${req.method} ${req.originalUrl}`
  );
  error.statusCode = 404;
  next(error);
}
