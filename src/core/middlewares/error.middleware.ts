import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AppError } from '../errors/AppError';
import { createTResult } from '../mappers/tresult.mapper';
import { env } from '../config/env.config';

/** Error con metadatos que agrega el middleware centralizado. */
type TErrorWithMeta = Error & {
  statusCode?: number;
  code?: string;
  errors?: string[] & { versionMismatch?: boolean };
};

export const errorMiddleware = (
  err: TErrorWithMeta,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode = 500, message, errors } = err;

  if (!(err instanceof AppError)) {
    statusCode = 500;
    message = env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message;

    // Handle Prisma/DB errors
    if (err.code === 'P2025') {
      // Registro requerido no encontrado (update/delete sobre algo inexistente).
      statusCode = 404;
      message = 'Registro no encontrado';
    } else if (err.code === 'P2002') {
      // Violación de restricción única → conflicto.
      statusCode = 409;
      message = 'El registro ya existe (valor duplicado)';
    } else if (err.code?.startsWith('P') || err.message?.includes('prisma')) {
      statusCode = 400;
      message = env.NODE_ENV === 'production' 
        ? 'Error de base de datos' 
        : `Error de base de datos: ${err.message.split('\n').pop() || err.message}`;
    } else if (err.name === 'MulterError') {
      // Errores de subida de archivos (peso máximo, campo inesperado, etc.).
      statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      message = err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el tamaño máximo permitido (50 MB)'
        : `Error al subir el archivo: ${err.message}`;
    }
  }

  // Log error
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} - ${message}`);
  }

  let responseData = null;
  if (err instanceof AppError && errors && errors.versionMismatch) {
    responseData = errors;
    errors = []; // Limpiar para que no se duplique en mensajes
  }

  const response = createTResult(responseData, [message, ...(errors || [])]);
  
  res.status(statusCode).json(response);
};
