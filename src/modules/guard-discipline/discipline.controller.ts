import { AuthenticatedUser } from "@src/core/types/auth.types";
import { Request, Response } from "express";
import * as disciplineService from "./discipline.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createAuditLog } from "../audit/audit.service";

/** Módulo usado en la bitácora de auditoría. */
const AUDIT_MODULE = "GUARD_DISCIPLINE";

// ── Categories ──
export const getPaginatedCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.getPaginatedCategories(req.body);
  res.status(200).json(createTResult(data));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.createCategory(req.body);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "CREATE_CATEGORY",
    resourceId: data.id,
    details: { name: data.name },
  });
  res.status(201).json(createTResult(data));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.updateCategory(req.params.id, req.body);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "UPDATE_CATEGORY",
    resourceId: data.id,
    details: { name: data.name },
  });
  res.status(200).json(createTResult(data));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  await disciplineService.deleteCategory(req.params.id);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "DELETE_CATEGORY",
    resourceId: req.params.id,
  });
  res.status(200).json(createTResult(true));
});

// ── Types ──
export const getPaginatedTypes = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.getPaginatedTypes(req.body);
  res.status(200).json(createTResult(data));
});

export const createType = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.createType(req.body);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "CREATE_TYPE",
    resourceId: data.id,
    details: { name: data.name },
  });
  res.status(201).json(createTResult(data));
});

export const updateType = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.updateType(req.params.id, req.body);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "UPDATE_TYPE",
    resourceId: data.id,
    details: { name: data.name },
  });
  res.status(200).json(createTResult(data));
});

export const deleteType = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  await disciplineService.deleteType(req.params.id);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "DELETE_TYPE",
    resourceId: req.params.id,
  });
  res.status(200).json(createTResult(true));
});

// ── Discipline Records ──
export const getPaginatedDisciplines = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.getPaginatedDisciplines(req.body, user.id, user.role, user.clientId ?? null);
  res.status(200).json(createTResult(data));
});

export const createDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.createDiscipline(req.body, user.id);
  res.status(201).json(createTResult(data));
});

export const resolveDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.resolveDiscipline(req.params.id, req.body);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "RESOLVE",
    resourceId: data.id,
    details: { status: data.status },
  });
  res.status(200).json(createTResult(data));
});

export const removeDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as AuthenticatedUser;
  const data = await disciplineService.deleteDiscipline(req.params.id);
  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "DELETE",
    resourceId: data.id,
  });
  res.status(200).json(createTResult(data));
});
