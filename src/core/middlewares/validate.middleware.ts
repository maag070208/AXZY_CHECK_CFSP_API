import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError";
import { logger } from "../utils/logger";

export const validate =
  (schema: any) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.issues.map(
          (err) => `${err.path.join(".")}: ${err.message}`,
        );
        logger.warn("Validation error:", { errors, path: req.path });
        return next(new AppError("Error de validación", 400, errors));
      }
      return next(new AppError("Error interno durante la validación", 500));
    }
  };
