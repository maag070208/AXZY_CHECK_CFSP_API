import { Request, Response } from "express";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import * as shiftHandoverService from "./shift-handover.service";

const authUser = (res: Response): IAuthUser => res.locals.user as IAuthUser;

export const getCatalog = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(createTResult(shiftHandoverService.getHandoverCatalog()));
});

export const createShiftHandover = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftHandoverService.createShiftHandover(req.body, authUser(res));
  res.status(201).json(createTResult(data));
});

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftHandoverService.getDataTableShiftHandovers(req.body, authUser(res));
  res.status(200).json(createTResult(data));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftHandoverService.getShiftHandoverById(req.params.id, authUser(res));
  res.status(200).json(createTResult(data));
});

export const deleteShiftHandover = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftHandoverService.deleteShiftHandover(req.params.id, authUser(res));
  res.status(200).json(createTResult(data));
});
