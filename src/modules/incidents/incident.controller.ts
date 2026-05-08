import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import { StorageService } from "../storage/storage.service";
import * as incidentService from "./incident.service";
import { logger } from "@src/core/utils/logger";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { createAuditLog } from "../audit/audit.service";

const storageService = new StorageService();

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await incidentService.getDataTableIncidents(req.body);
  return res.status(200).json(createTResult(result));
});

export const createIncident = asyncHandler(async (req: Request, res: Response) => {
  const {
    title,
    categoryId,
    typeId,
    description,
    media,
    latitude,
    longitude,
    clientId,
  } = req.body;
  const guardId = res.locals.user?.id;

  if (!guardId) {
    throw new AppError("Usuario no autenticado", 401);
  }
  logger.debug("Creating incident with body:", req.body);
  const mediaFiles = media || [];

  const result = await incidentService.createIncident({
    guardId: guardId as string,
    title,
    categoryId: categoryId as string,
    typeId: typeId as string,
    description,
    media: mediaFiles.length > 0 ? mediaFiles : undefined,
    latitude: latitude ? Number(latitude) : undefined,
    longitude: longitude ? Number(longitude) : undefined,
    clientId: clientId as string,
  });

  await createAuditLog({
    userId: guardId as string,
    module: "INCIDENTS",
    action: "CREATE",
    resourceId: result.id,
    details: { title, clientId }
  });

  return res.status(201).json(createTResult(result));
});

export const getIncidents = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate, guardId, category, title } = req.query;

  const filters: any = {};
  if (startDate) filters.startDate = new Date(String(startDate));
  if (endDate) filters.endDate = new Date(String(endDate));
  if (guardId) filters.guardId = guardId as string;
  if (category) filters.category = String(category);
  if (title) filters.title = String(title);

  const result = await incidentService.getIncidents(filters);
  return res.status(200).json(createTResult(result));
});

export const resolveIncident = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = res.locals.user?.id;

  if (!userId) {
    throw new AppError("Usuario no autenticado", 401);
  }

  const result = await incidentService.resolveIncident(id, userId as string);

  await createAuditLog({
    userId: userId as string,
    module: "INCIDENTS",
    action: "RESOLVE",
    resourceId: id
  });

  return res.status(200).json(createTResult(result));
});

export const getPendingCount = asyncHandler(async (req: Request, res: Response) => {
  const count = await incidentService.getPendingIncidentsCount();
  return res.status(200).json(createTResult({ count }));
});

export const deleteIncident = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const incident = await incidentService.getIncidentById(id);
  if (!incident) {
    throw new AppError("Incidencia no encontrada", 404);
  }

  await incidentService.deleteIncident(id);

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "INCIDENTS",
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

  const incident = await incidentService.getIncidentById(id);
  if (!incident || !incident.media) {
    throw new AppError("Incidencia o media no encontrada", 404);
  }

  const bucketName = process.env.AWS_BUCKET_NAME;
  if (bucketName) {
    try {
      await storageService.deleteFile(bucketName, String(key));
    } catch (s3Err) {
      logger.error("Error deleting from S3:", s3Err);
    }
  }

  const media = incident.media as any[];
  const updatedMedia = media.filter((m: any) => {
    if (!m) return false;
    const mKey =
      m.key || (typeof m.url === "string" ? m.url.split("/").pop() : null);
    return mKey !== String(key);
  });
  await incidentService.updateIncidentMedia(id, updatedMedia);

  return res.status(200).json(createTResult(true));
});
