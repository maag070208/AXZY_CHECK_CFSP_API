import { Request, Response } from "express";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import * as uniformCheckService from "./uniform-check.service";

const authUser = (res: Response): IAuthUser => res.locals.user as IAuthUser;

export const getCatalog = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(createTResult(uniformCheckService.getUniformCatalog()));
});

export const createUniformCheck = asyncHandler(async (req: Request, res: Response) => {
  const data = await uniformCheckService.createUniformCheck(req.body, authUser(res));
  res.status(201).json(createTResult(data));
});

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const data = await uniformCheckService.getDataTableUniformChecks(req.body, authUser(res));
  res.status(200).json(createTResult(data));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const data = await uniformCheckService.getUniformCheckById(req.params.id, authUser(res));
  res.status(200).json(createTResult(data));
});

export const deleteUniformCheck = asyncHandler(async (req: Request, res: Response) => {
  const data = await uniformCheckService.deleteUniformCheck(req.params.id, authUser(res));
  res.status(200).json(createTResult(data));
});
