import { Request, Response } from "express";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import {
  registerCheck,
  getKardex,
  getKardexById,
  updateKardex,
  getDataTableKardex,
  deleteKardex,
  updateKardexMedia,
} from "./kardex.service";
import { StorageService } from "../storage/storage.service";
import { logger } from "@src/core/utils/logger";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";

const storageService = new StorageService();

export const createKardexEntry = asyncHandler(async (req: Request, res: Response) => {
  const {
    userId,
    locationId,
    notes,
    media,
    latitude,
    longitude,
    assignmentId,
  } = req.body;

  const entry = await registerCheck({
    userId: userId as string,
    locationId: locationId as string,
    notes,
    media,
    latitude,
    longitude,
    assignmentId: assignmentId as string,
  });

  return res.status(201).json(createTResult(entry));
});

export const updateKardexEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes, media, latitude, longitude } = req.body;

  const entry = await updateKardex(id, {
    notes,
    media,
    latitude,
    longitude,
  });

  return res.status(200).json(createTResult(entry));
});

export const getKardexEntries = asyncHandler(async (req: Request, res: Response) => {
  const { userId, locationId, startDate, endDate } = req.query;

  const entries = await getKardex({
    userId: userId as string,
    locationId: locationId as string,
    startDate: startDate as string,
    endDate: endDate as string,
  });

  return res.status(200).json(createTResult(entries));
});

export const getKardexDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const entry = await getKardexById(id);

  if (!entry) {
    throw new AppError("Kardex entry not found", 404);
  }

  return res.status(200).json(createTResult(entry));
});

export const getDataTableKardexEntries = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, filters, sort } = req.body;

  const result = await getDataTableKardex({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    filters: filters || {},
    sort: sort || undefined,
  });

  return res.status(200).json(createTResult(result));
});

export const deleteKardexEntry = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const entry = await getKardexById(id);

  if (!entry) {
    throw new AppError("Registro no encontrado", 404);
  }

  await deleteKardex(id);
  return res.status(200).json(createTResult(true));
});

export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { key } = req.query;

  if (!key) {
    throw new AppError("Falta el key del archivo", 400);
  }

  const entry = await getKardexById(id);
  if (!entry || !entry.media) {
    throw new AppError("Registro o media no encontrada", 404);
  }

  const bucketName = process.env.AWS_BUCKET_NAME;
  if (bucketName) {
    try {
      await storageService.deleteFile(bucketName, String(key));
    } catch (err) {
      logger.error("Error deleting from S3:", err);
    }
  }

  const media = entry.media as any[];
  const updatedMedia = media.filter((m: any) => {
    if (!m) return false;
    const mKey =
      m.key || (typeof m.url === "string" ? m.url.split("/").pop() : null);
    return mKey !== String(key);
  });

  await updateKardexMedia(id, updatedMedia);
  return res.status(200).json(createTResult(true));
});
