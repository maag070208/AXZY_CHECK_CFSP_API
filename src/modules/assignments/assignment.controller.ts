import { Request, Response } from "express";
import * as assignmentService from "./assignment.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AssignmentStatus } from "@prisma/client";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.getDataTableAssignments(req.body);
  return res.status(200).json(createTResult(result));
});

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.createAssignment(req.body);
  return res.status(201).json(createTResult(result));
});

export const getMyAssignments = asyncHandler(async (req: Request, res: Response) => {
  const userId = res.locals.user?.id as string;
  const { guardId: queryGuardId } = req.query;
  const guardId = userId || (queryGuardId as string);

  if (!guardId) {
    throw new AppError("Unauthorized", 401);
  }

  const result = await assignmentService.getAssignmentsByGuard(guardId);
  return res.status(200).json(createTResult(result));
});

export const getAllAssignments = asyncHandler(async (req: Request, res: Response) => {
  const { guardId, status, id } = req.query;
  const result = await assignmentService.getAllAssignments({
    id: id as string,
    guardId: guardId as string,
    status: status as AssignmentStatus,
  });
  return res.status(200).json(createTResult(result));
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const result = await assignmentService.updateAssignmentStatus(id, status);
  return res.status(200).json(createTResult(result));
});

export const toggleTask = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const result = await assignmentService.toggleAssignmentTask(taskId);
  return res.status(200).json(createTResult(result));
});
