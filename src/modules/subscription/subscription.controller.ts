import { Request, Response } from "express";
import * as subscriptionService from "./subscription.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { getAuthUserId } from "@src/core/utils/auth-user.utils";

export const getConfig = asyncHandler(async (_req: Request, res: Response) => {
  const config = await subscriptionService.getConfig();
  return res.status(200).json(createTResult(config));
});

export const updateConfig = asyncHandler(async (req: Request, res: Response) => {
  const config = await subscriptionService.updateConfig(req.body, getAuthUserId(res));
  return res.status(200).json(createTResult(config));
});
