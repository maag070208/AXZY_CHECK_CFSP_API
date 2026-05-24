import { Request, Response } from "express";
import * as syncService from "./sync.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { API_VERSION } from "@src/core/config/constants";

export const pull = asyncHandler(async (req: Request, res: Response) => {
  const appVersion = req.headers["x-app-version"] as string;
  if (!appVersion || appVersion !== API_VERSION) {
    throw new AppError(`Aplicación desactualizada. Por favor actualice a la versión ${API_VERSION}.`, 400);
  }

  const lastPulledAt = req.query.last_pulled_at 
      ? parseInt(req.query.last_pulled_at as string) 
      : undefined;
  const resetModels = req.query.reset_models
      ? (req.query.reset_models as string).split(",")
      : undefined;
  
  const result = await syncService.pullChanges({ lastPulledAt, resetModels });
  res.json(createTResult(result));
});

export const push = asyncHandler(async (req: Request, res: Response) => {
  const appVersion = req.headers["x-app-version"] as string;
  if (!appVersion || appVersion !== API_VERSION) {
    throw new AppError(`Aplicación desactualizada. Por favor actualice a la versión ${API_VERSION}.`, 400);
  }

  const { changes } = req.body;
  const userId = res.locals.user?.id || "SYSTEM";
  const result = await syncService.pushChanges({ changes, userId });
  res.json(createTResult(result));
});

export const checkChanges = asyncHandler(async (req: Request, res: Response) => {
  const appVersion = req.headers["x-app-version"] as string;
  if (!appVersion || appVersion !== API_VERSION) {
    throw new AppError(`Aplicación desactualizada. Por favor actualice a la versión ${API_VERSION}.`, 400);
  }

  const lastPulledAt = req.query.last_pulled_at 
      ? parseInt(req.query.last_pulled_at as string) 
      : 0;
  
  const hasChanges = await syncService.hasChangesSince({ lastPulledAt });
  res.json(createTResult({ hasChanges }));
});
