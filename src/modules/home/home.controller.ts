import { Request, Response } from "express";
import * as homeService from "./home.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user;
  const result = await homeService.getDashboardStats(user);
  return res.status(result.success ? 200 : 500).json(result);
});
