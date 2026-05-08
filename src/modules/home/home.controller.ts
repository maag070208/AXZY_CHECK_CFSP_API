import { Request, Response } from "express";
import * as homeService from "./home.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await homeService.getDashboardStats(user);
    return res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};
