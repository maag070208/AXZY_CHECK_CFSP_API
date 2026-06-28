import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import {
  getActiveGuards,
  getOverview,
  getPendingCounts,
  getRecentActivity,
  getRecentPanicAlerts,
} from "./dashboard.service";

export const getOverviewHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const result = await getOverview(user);
    return res.status(200).json(createTResult(result));
  },
);

export const getActiveGuardsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const result = await getActiveGuards(user);
    return res.status(200).json(createTResult(result));
  },
);

export const getPendingCountsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const result = await getPendingCounts(user);
    return res.status(200).json(createTResult(result));
  },
);

export const getRecentActivityHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const limit = Number(req.query.limit) || 20;
    const result = await getRecentActivity(user, limit);
    return res.status(200).json(createTResult(result));
  },
);

export const getRecentPanicAlertsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = res.locals.user;
    const limit = Number(req.query.limit) || 10;
    const result = await getRecentPanicAlerts(user, limit);
    return res.status(200).json(createTResult(result));
  },
);
