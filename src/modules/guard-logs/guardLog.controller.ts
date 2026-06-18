import { Request, Response } from "express";
import * as guardLogService from "./guardLog.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const clockIn = asyncHandler(async (req: Request, res: Response) => {
  const { guardId } = req.body;
  const result = await guardLogService.clockIn(guardId);
  return res.status(201).json(createTResult(result));
});

export const clockOut = asyncHandler(async (req: Request, res: Response) => {
  const { guardId } = req.body;
  const result = await guardLogService.clockOut(guardId);
  return res.status(200).json(createTResult(result));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await guardLogService.deleteLog(req.params.id);
  return res.status(200).json(createTResult(result));
});

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await guardLogService.getDataTable(req.body);
  return res.status(200).json(createTResult(result));
});
