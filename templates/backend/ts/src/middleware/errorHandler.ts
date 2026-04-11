import type { NextFunction, Request, Response } from 'express';

type HttpError = Error & {
  statusCode?: number;
};

export function errorHandler(
  error: HttpError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: message
  });
}
