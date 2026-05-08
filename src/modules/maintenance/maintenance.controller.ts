import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as maintenanceService from "./maintenance.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { createAuditLog } from "../audit/audit.service";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await maintenanceService.getDataTableMaintenances(req.body);
  return res.status(200).json(createTResult(result));
});

export const createMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { title, category, description, media, latitude, longitude, categoryId, typeId, clientId } = req.body;
  const guardId = res.locals.user?.id;

  if (!guardId) {
    throw new AppError("Usuario no autenticado", 401);
  }
  
  const mediaFiles = media || [];

  const result = await maintenanceService.createMaintenance({
    guardId: guardId as string,
    title,
    categoryId: categoryId as string,
    typeId: typeId as string,
    category,
    description,
    media: mediaFiles.length > 0 ? mediaFiles : undefined,
    latitude: latitude ? Number(latitude) : undefined,
    longitude: longitude ? Number(longitude) : undefined,
    clientId: clientId as string
  });

  await createAuditLog({
    userId: guardId as string,
    module: "MAINTENANCE",
    action: "CREATE",
    resourceId: result.id,
    details: { title, clientId }
  });

  return res.status(201).json(createTResult(result));
});

export const getMaintenances = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, guardId, category, title } = req.query;

  const filters: any = {};
  if (startDate) filters.startDate = new Date(String(startDate));
  if (endDate) filters.endDate = new Date(String(endDate));
  if (guardId) filters.guardId = guardId as string;
  if (category) filters.category = String(category);
  if (title) filters.title = String(title);

  const result = await maintenanceService.getMaintenances(filters);
  return res.status(200).json(createTResult(result));
});

export const resolveMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = res.locals.user?.id;

  if (!userId) {
    throw new AppError("Usuario no autenticado", 401);
  }

  const result = await maintenanceService.resolveMaintenance(id, userId as string);

  await createAuditLog({
    userId: userId as string,
    module: "MAINTENANCE",
    action: "RESOLVE",
    resourceId: id
  });

  return res.status(200).json(createTResult(result));
});

export const getPendingCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await maintenanceService.getPendingMaintenancesCount();
  return res.status(200).json(createTResult({ count }));
});

export const deleteMaintenance = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const maintenance = await maintenanceService.getMaintenanceById(id);
  if (!maintenance) {
    throw new AppError("Mantenimiento no encontrado", 404);
  }

  await maintenanceService.deleteMaintenance(id);

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "MAINTENANCE",
    action: "DELETE",
    resourceId: id
  });

  return res.status(200).json(createTResult(true));
});

export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key } = req.query;

  if (!key) {
    throw new AppError("Falta el key del archivo", 400);
  }

  const maintenance = await maintenanceService.getMaintenanceById(id);
  if (!maintenance || !maintenance.media) {
    throw new AppError("Mantenimiento o media no encontrada", 404);
  }

  const media = maintenance.media as any[];
  const updatedMedia = media.filter((m: any) => {
    if (!m) return false;
    const mKey = m.key || (typeof m.url === 'string' ? m.url.split('/').pop() : null);
    return mKey !== String(key);
  });

  await maintenanceService.updateMaintenanceMedia(id, updatedMedia);
  return res.status(200).json(createTResult(true));
});
