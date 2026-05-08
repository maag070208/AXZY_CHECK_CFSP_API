import { createTResult } from "@src/core/mappers/tresult.mapper";
import { Request, Response } from "express";
import { createSchedule, deleteSchedule, getDataTableSchedules, getSchedules, getUsersBySchedule, updateSchedule } from "./schedule.service";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await getDataTableSchedules(req.body);
  return res.status(200).json(createTResult(result));
});

export const getAll = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSchedules();
  return res.status(200).json(createTResult(data));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name, startTime, endTime } = req.body;
    const data = await createSchedule({ name, startTime, endTime });
    return res.status(201).json(createTResult(data));
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new AppError("Ya existe un horario con ese nombre.", 400);
    }
    throw error;
  }
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await updateSchedule(id, req.body);
    return res.status(200).json(createTResult(data));
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new AppError("Ya existe un horario con ese nombre.", 400);
    }
    throw error;
  }
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deleteSchedule(id);
    return res.status(200).json(createTResult(true));
  } catch (error: any) {
    if (error.code === 'P2003') {
      throw new AppError("Este horario está asignado a uno o más guardias y no puede ser eliminado.", 400);
    }
    throw error;
  }
});

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = await getUsersBySchedule(id);
  return res.status(200).json(createTResult(data));
});
