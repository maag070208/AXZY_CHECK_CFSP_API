import { Request, Response } from "express";
import * as roundService from "./round.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { StorageService } from "../storage/storage.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { createAuditLog } from "../audit/audit.service";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const result = await roundService.getDataTableRounds(req.body, user);
  return res.status(200).json(createTResult(result));
});

export const startRound = asyncHandler(async (req: Request, res: Response) => {
  const { guardId, clientId, recurringConfigurationId } = req.body;
  const user = res.locals.user;
  const targetGuardId = user?.id || guardId;

  const result = await roundService.startRound(
    String(targetGuardId),
    clientId as string,
    recurringConfigurationId as string,
  );
  
  if (!result.success) {
    throw new AppError(result.messages?.[0] || "Error iniciando ronda", 400);
  }

  await createAuditLog({
    userId: String(targetGuardId),
    module: "ROUNDS",
    action: "START",
    resourceId: (result.data as any)?.id,
    details: { clientId, recurringConfigurationId }
  });

  return res.status(200).json(result);
});

export const endRound = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await roundService.endRound(id);
  
  if (!result.success) {
    throw new AppError(result.messages?.[0] || "Error finalizando ronda", 400);
  }

  await createAuditLog({
    userId: res.locals.user?.id || "SYSTEM",
    module: "ROUNDS",
    action: "END",
    resourceId: id
  });

  return res.status(200).json(result);
});

export const getCurrentRound = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user?.id;
  if (!userId) {
    throw new AppError("No autorizado", 401);
  }
  const result = await roundService.getCurrentRound(String(userId));
  return res.status(result.success ? 200 : 400).json(result);
});

export const getRounds = asyncHandler(async (req: Request, res: Response) => {
  const { date, guardId, status } = req.query;
  const user = res.locals.user;
  const result = await roundService.getRounds(
    date ? String(date) : undefined,
    guardId as string,
    user,
    status as string,
  );
  return res.status(result.success ? 200 : 500).json(result);
});

export const getRoundDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;
  const result = await roundService.getRoundDetail(id, user);
  if (!result.success) {
    throw new AppError(result.messages?.[0] || "Ronda no encontrada", 404);
  }
  return res.status(200).json(result);
});

export const generateReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;
  const buffer = await roundService.generateRoundPDF(id, user);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Ronda_${id}.pdf`,
  );
  return res.send(buffer);
});

export const shareReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = res.locals.user;
  const buffer = await roundService.generateRoundPDF(id, user);

  const storage = new StorageService();
  const bucket = process.env.AWS_BUCKET_NAME || "cfsp-s3-bucket-prod";
  const key = `reports/round_${id}_${Date.now()}.pdf`;

  await storage.uploadBuffer(buffer, bucket, key, "application/pdf");
  const url = await storage.getSignedReadUrl(bucket, key, 86400); // 24 hours

  return res.status(200).json(createTResult(url));
});
