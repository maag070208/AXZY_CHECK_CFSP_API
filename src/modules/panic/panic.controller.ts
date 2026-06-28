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

    // Solo guardias (y roles operativos) pueden disparar pánico
    if (role && role !== ROLE_GUARD && role !== "SHIFT" && role !== "MAINT") {
      throw new AppError("Rol no autorizado para alertas de pánico", 403);
    }

    const { latitude, longitude, accuracy, source, notes } = req.body;

    logger.warn(
      `[Panic] Alerta de pánico recibida - guardId=${guardId} lat=${latitude} lng=${longitude}`,
    );

    const result = await panicService.createPanicAlert({
      guardId: guardId as string,
      latitude,
      longitude,
      accuracy,
      source,
      notes,
    });

    return res.status(201).json(createTResult(result));
  },
);

export const getPanicAlert = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const alert = await panicService.getPanicAlertById(id);
    if (!alert) {
      throw new AppError("Alerta de pánico no encontrada", 404);
    }
    return res.status(200).json(createTResult(alert));
  },
);
