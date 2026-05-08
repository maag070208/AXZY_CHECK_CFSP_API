import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import * as recurringService from "./recurring.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await recurringService.getRecurringDataTable(req.body);
  return res.status(200).json(createTResult(result));
});

export const postRecurring = asyncHandler(async (req: Request, res: Response) => {
  const result = await recurringService.createRecurring(req.body);
  return res.status(201).json(createTResult(result));
});

export const putRecurring = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await recurringService.updateRecurring(id, req.body);
    return res.status(200).json(createTResult(result));
});

export const deleteRecurring = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await recurringService.deleteRecurring(id);
  return res.status(200).json(createTResult(result));
});

export const getRecurring = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await recurringService.getRecurringById(id);
    return res.status(200).json(createTResult(result));
});

export const getRecurringByGuard = asyncHandler(async (req: Request, res: Response) => {
    const { guardId } = req.params;
    const result = await recurringService.getRecurringByGuard(guardId);
    return res.status(200).json(createTResult(result));
});

export const getAllRecurring = asyncHandler(async (req: Request, res: Response) => {
    const result = await recurringService.getAllRecurring();
    return res.status(200).json(createTResult(result));
});

