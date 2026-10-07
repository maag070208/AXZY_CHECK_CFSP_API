import rateLimit from "express-rate-limit";
import { Request } from "express";
import { env } from "@src/core/config/env.config";
import {
  AUTH_RATE_LIMIT_MAX_REQUESTS,
  AUTH_RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_TEST_HEADER,
} from "@src/core/config/constants";

/**
 * Rate limiting de la API.
 *
 * IMPORTANTE — por qué no se aplica en pruebas: la suite lanza cientos de
 * peticiones desde 127.0.0.1 y se auto-bloquearía. Para poder probar el límite
 * de verdad, un test puede pedir explícitamente que se aplique enviando la
 * cabecera `x-force-rate-limit: true`; en cualquier otro entorno NUNCA se salta.
 */
const shouldSkip = (req: Request): boolean =>
  env.NODE_ENV === "test" && req.headers[RATE_LIMIT_TEST_HEADER] !== "true";

/** Respuesta con el sobre `TResult` que usa el resto de la API. */
const overLimitResponse = (mensaje: string) => ({
  success: false,
  data: null,
  messages: [mensaje],
});

/**
 * Límite estricto para el inicio de sesión: frena la fuerza bruta de
 * credenciales (10 intentos por IP cada 15 minutos).
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  limit: AUTH_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
  handler: (_req, res) => {
    res
      .status(429)
      .json(
        overLimitResponse(
          "Demasiados intentos de inicio de sesión. Espera unos minutos e intenta de nuevo.",
        ),
      );
  },
});

/**
 * Fábrica expuesta para poder montar el limitador con otros parámetros en
 * pruebas o en futuras rutas sensibles.
 */
export const createRateLimiter = (options: {
  windowMs: number;
  limit: number;
  message: string;
  skip?: (req: Request) => boolean;
}) =>
  rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skip: options.skip ?? shouldSkip,
    handler: (_req, res) => {
      res.status(429).json(overLimitResponse(options.message));
    },
  });
