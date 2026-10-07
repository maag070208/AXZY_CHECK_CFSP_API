import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as recurringService from "./recurring.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AuthenticatedUser } from "@src/core/types/auth.types";
import { ROLE_CLIENT } from "@src/core/config/constants";

/**
 * Alcance por cliente para las consultas:
 * - `undefined` → sin restricción (ADMIN y roles internos).
 * - `string`    → sólo ese cliente (usuario RESDN con cliente asignado).
 * - `null`      → usuario de cliente sin cliente: no debe ver nada.
 */
const clientScopeOf = (res: Response): string | null | undefined => {
  const user = res.locals.user as AuthenticatedUser | undefined;
  if (user?.role !== ROLE_CLIENT) return undefined;
  return user.clientId ?? null;
};

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await recurringService.getRecurringDataTable(req.body);
  return res.status(200).json(createTResult(result));
});

export const postRecurring = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const result = await recurringService.createRecurring(req.body, user.id);
  return res.status(201).json(createTResult(result));
});

export const putRecurring = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = res.locals.user;
    const result = await recurringService.updateRecurring(id, req.body, user.id);
    return res.status(200).json(createTResult(result));
});

export const deleteRecurring = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;
  const result = await recurringService.deleteRecurring(id, user.id);
  return res.status(200).json(createTResult(result));
});

export const getRecurring = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await recurringService.getRecurringById(id);
    return res.status(200).json(createTResult(result));
});

export const getRecurringByGuard = asyncHandler(async (req: Request, res: Response) => {
    const { guardId } = req.params;
    const scope = clientScopeOf(res);
    const result = await recurringService.getRecurringByGuard(guardId, scope);
    return res.status(200).json(createTResult(result));
});

export const getAllRecurring = asyncHandler(async (req: Request, res: Response) => {
    const scope = clientScopeOf(res);
    const result = await recurringService.getAllRecurring(scope);
    return res.status(200).json(createTResult(result));
});

