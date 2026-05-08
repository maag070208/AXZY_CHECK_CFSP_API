import { Request, Response } from "express";
import * as syncService from "./sync.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const pull = asyncHandler(async (req: Request, res: Response) => {
  const lastPulledAt = req.query.last_pulled_at 
      ? parseInt(req.query.last_pulled_at as string) 
      : undefined;
  
  const result = await syncService.pullChanges({ lastPulledAt });
  res.json(createTResult(result));
});

export const push = asyncHandler(async (req: Request, res: Response) => {
  const { changes } = req.body;
  const result = await syncService.pushChanges({ changes });
  res.json(createTResult(result));
});
