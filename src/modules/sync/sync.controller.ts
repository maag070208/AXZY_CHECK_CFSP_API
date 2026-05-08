import { Request, Response } from "express";
import * as syncService from "./sync.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";

export const pull = async (req: Request, res: Response) => {
  try {
    const lastPulledAt = req.query.last_pulled_at 
        ? parseInt(req.query.last_pulled_at as string) 
        : undefined;
    
    const result = await syncService.pullChanges({ lastPulledAt });
    res.json(createTResult(result));
  } catch (error: any) {
    res.status(500).json(createTResult(null, [error.message]));
  }
};

export const push = async (req: Request, res: Response) => {
  try {
    const { changes } = req.body;
    const result = await syncService.pushChanges({ changes });
    res.json(createTResult(result));
  } catch (error: any) {
    console.error("SYNC PUSH ERROR:", error);
    res.status(500).json(createTResult(null, [error.message]));
  }
};
