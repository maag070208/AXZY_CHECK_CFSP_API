import { Request, Response } from "express";
import * as disciplineService from "./discipline.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { asyncHandler } from "@src/core/utils/asyncHandler";

// ── Categories ──
export const getPaginatedCategories = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.getPaginatedCategories(req.body);
  res.status(200).json(createTResult(data));
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.createCategory(req.body);
  res.status(201).json(createTResult(data));
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.updateCategory(req.params.id, req.body);
  res.status(200).json(createTResult(data));
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await disciplineService.deleteCategory(req.params.id);
  res.status(200).json(createTResult(true));
});

// ── Types ──
export const getPaginatedTypes = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.getPaginatedTypes(req.body);
  res.status(200).json(createTResult(data));
});

export const createType = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.createType(req.body);
  res.status(201).json(createTResult(data));
});

export const updateType = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.updateType(req.params.id, req.body);
  res.status(200).json(createTResult(data));
});

export const deleteType = asyncHandler(async (req: Request, res: Response) => {
  await disciplineService.deleteType(req.params.id);
  res.status(200).json(createTResult(true));
});

// ── Discipline Records ──
export const getPaginatedDisciplines = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as any;
  const data = await disciplineService.getPaginatedDisciplines(req.body, user.id, user.role, user.clientId);
  res.status(200).json(createTResult(data));
});

export const createDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const user = res.locals.user as any;
  const data = await disciplineService.createDiscipline(req.body, user.id);
  res.status(201).json(createTResult(data));
});

export const resolveDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.resolveDiscipline(req.params.id, req.body);
  res.status(200).json(createTResult(data));
});

export const removeDiscipline = asyncHandler(async (req: Request, res: Response) => {
  const data = await disciplineService.deleteDiscipline(req.params.id);
  res.status(200).json(createTResult(data));
});
