import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../errors/AppError';
import { createTResult } from '../mappers/tresult.mapper';
import { env } from '../config/env.config';

export const errorMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode, message, errors } = err;

  if (!(err instanceof AppError)) {
    statusCode = 500;
    message = env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;

    // Handle Prisma/DB errors
    if (err.code?.startsWith('P') || err.message?.includes('prisma')) {
      statusCode = 400;
      message = env.NODE_ENV === 'production' 
        ? 'Error de base de datos' 
        : `Error de base de datos: ${err.message.split('\n').pop() || err.message}`;
    }
  }

  // Log error
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${message}`);
  }

  const response = createTResult(null, [message, ...(errors || [])]);
  
  res.status(statusCode).json(response);
};
