import { Request, Response } from "express";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AuthenticatedUser } from "@src/core/types/auth.types";
import * as service from "./scheduled.service";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.getDataTable(req.body);
  return res.status(200).json(createTResult(result));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const record = await service.getById(req.params.id);
  return res.status(200).json(createTResult(record));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const userId = (res.locals.user as AuthenticatedUser).id;
  const record = await service.create(req.body, userId);
  return res.status(201).json(createTResult(record));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = (res.locals.user as AuthenticatedUser).id;
  const record = await service.update(req.params.id, req.body, userId);
  return res.status(200).json(createTResult(record));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = (res.locals.user as AuthenticatedUser).id;
  await service.remove(req.params.id, userId);
  return res.status(200).json(createTResult(true));
});
