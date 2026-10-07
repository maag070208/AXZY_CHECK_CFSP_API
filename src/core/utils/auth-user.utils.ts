import { Response } from "express";
import { AuthenticatedUser } from "@src/core/types/auth.types";

/**
 * Id del usuario autenticado para auditoría.
 *
 * Es defensivo a propósito: si el middleware no dejó usuario (p. ej. un test que
 * no manda el header), devuelve `"SYSTEM"` y `createAuditLog` lo resuelve contra
 * un admin real, en vez de reventar el request leyendo `.id` de `undefined`.
 */
export const getAuthUserId = (res: Response): string =>
  (res.locals.user as AuthenticatedUser | undefined)?.id ?? "SYSTEM";
