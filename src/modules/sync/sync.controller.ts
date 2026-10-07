import { Request, Response } from "express";
import * as syncService from "./sync.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { API_VERSION } from "@src/core/config/constants";
import { prismaClient } from "@src/core/config/database";
import { IAuthUser } from "@src/core/dto/auth-user.dto";

const validateAppVersion = async (req: Request) => {
  if (req.headers["x-bypass-version-check"] === "true") {
    return;
  }

  const appVersion = req.headers["x-app-version"] as string;
  
  const sysConfig = await prismaClient.sysConfig.findUnique({
    where: { key: "APP_VERSION" }
  });
  const expectedVersion = sysConfig?.value || API_VERSION;

  if (!appVersion || appVersion !== expectedVersion) {
    // Intentar obtener changelog del SysConfig
    const logsConfig = await prismaClient.sysConfig.findUnique({
      where: { key: "VERSION_LOGS" }
    });
    let changelog: string[] = [];
    if (logsConfig?.value) {
      try {
        const logs = JSON.parse(logsConfig.value);
        if (Array.isArray(logs)) {
          const matchedLog = logs.find((l) => l.version === expectedVersion);
          changelog = matchedLog?.changes || [];
        }
      } catch (e) {
        // Ignorar error de parsing
      }
    }

    // Obtener URL de descarga del SysConfig
    const updateUrlConfig = await prismaClient.sysConfig.findUnique({
      where: { key: "APP_UPDATE_URL" }
    });
    const updateUrl = updateUrlConfig?.value || "https://axzy.dev/checkapp/download";

    const errData = {
      versionMismatch: true,
      currentVersion: appVersion || "unknown",
      requiredVersion: expectedVersion,
      updateUrl,
      changelog,
    };

    throw new AppError(
      `Aplicación desactualizada. Por favor actualice a la versión ${expectedVersion}.`,
      400,
      errData
    );
  }
};

export const pull = asyncHandler(async (req: Request, res: Response) => {
  await validateAppVersion(req);

  const lastPulledAt = req.query.last_pulled_at 
      ? parseInt(req.query.last_pulled_at as string) 
      : undefined;
  const resetModels = req.query.reset_models
      ? (req.query.reset_models as string).split(",")
      : undefined;
  
  const result = await syncService.pullChanges({ lastPulledAt, resetModels, user: res.locals.user as IAuthUser });
  res.json(createTResult(result));
});

export const push = asyncHandler(async (req: Request, res: Response) => {
  await validateAppVersion(req);

  const { changes, lastPulledAt } = req.body;
  const user = res.locals.user as IAuthUser | undefined;
  if (!user?.id) throw new AppError("No autenticado", 401);
  const result = await syncService.pushChanges({ changes, user, lastPulledAt });
  res.json(createTResult(result));
});

export const checkChanges = asyncHandler(async (req: Request, res: Response) => {
  await validateAppVersion(req);

  const lastPulledAt = req.query.last_pulled_at 
      ? parseInt(req.query.last_pulled_at as string) 
      : 0;
  
  const hasChanges = await syncService.hasChangesSince({ lastPulledAt, user: res.locals.user as IAuthUser });
  res.json(createTResult({ hasChanges }));
});
