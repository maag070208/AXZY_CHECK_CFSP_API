import { Request, Response } from "express";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import * as agendaService from "./agenda.service";
import * as shiftPlanService from "./shift-plan.service";

const authUser = (res: Response): IAuthUser => res.locals.user as IAuthUser;
const queryString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const listShiftPlans = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftPlanService.listShiftPlans(authUser(res), queryString(req.query.clientId));
  res.status(200).json(createTResult(data));
});

export const createShiftPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftPlanService.createShiftPlan(req.body, authUser(res));
  res.status(201).json(createTResult(data));
});

export const updateShiftPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftPlanService.updateShiftPlan(req.params.id, req.body, authUser(res));
  res.status(200).json(createTResult(data));
});

export const deleteShiftPlan = asyncHandler(async (req: Request, res: Response) => {
  const data = await shiftPlanService.deleteShiftPlan(req.params.id, authUser(res));
  res.status(200).json(createTResult(data));
});

export const getAgenda = asyncHandler(async (req: Request, res: Response) => {
  const clientId = resolveClientScope(authUser(res), queryString(req.query.clientId));
  const data = await agendaService.getAgendaForDate(queryString(req.query.date), clientId);
  res.status(200).json(createTResult(data));
});

export const getCurrentAgenda = asyncHandler(async (req: Request, res: Response) => {
  const clientId = resolveClientScope(authUser(res), queryString(req.query.clientId));
  const data = await agendaService.getCurrentAgenda(clientId);
  res.status(200).json(createTResult(data));
});
