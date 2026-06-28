import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AppError } from "@src/core/errors/AppError";
import { logger } from "@src/core/utils/logger";
import { ROLE_GUARD } from "@src/core/config/constants";

import * as panicService from "./panic.service";

export const createPanicAlert = asyncHandler(
  async (req: Request, res: Response) => {
    const guardId = res.locals.user?.id;
    const role = res.locals.user?.role;

    if (!guardId) {
      throw new AppError("Usuario no autenticado", 401);
    }

    if (role && role !== ROLE_GUARD && role !== "SHIFT" && role !== "MAINT") {
      throw new AppError("Rol no autorizado para alertas de pánico", 403);
    }

    const { source, triggerLatitude, triggerLongitude, triggerAccuracy, message } =
      req.body;

    logger.warn(
      `[Panic] Alerta de pánico recibida - guardId=${guardId} lat=${triggerLatitude} lng=${triggerLongitude}`,
    );

    const result = await panicService.createPanicAlert({
      guardId: guardId as string,
      source,
      triggerLatitude,
      triggerLongitude,
      triggerAccuracy,
      message,
    });

    return res.status(201).json(createTResult(result));
  },
);

export const getDataTable = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const result = await panicService.getDataTablePanicAlerts(req.body, user);
    return res.status(200).json(createTResult(result));
  },
);

export const getPanicAlert = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = res.locals.user;
    const alert = await panicService.getPanicAlertById(id, user);
    if (!alert) {
      throw new AppError("Alerta de pánico no encontrada", 404);
    }
    return res.status(200).json(createTResult(alert));
  },
);

export const resolvePanicAlert = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = res.locals.user;
    const result = await panicService.resolvePanicAlert(id, req.body, user);
    return res.status(200).json(createTResult(result));
  },
);

export const getRecent = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const limit = Number(req.query.limit) || 10;
    const result = await panicService.getRecentPanicAlerts(user, limit);
    return res.status(200).json(createTResult(result));
  },
);
