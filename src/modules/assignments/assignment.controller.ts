import { Request, Response } from "express";
import * as assignmentService from "./assignment.service";
import { createTResult } from "@src/core/mappers/tresult.mapper";
import { AssignmentStatus } from "@prisma/client";
import { asyncHandler } from "@src/core/utils/asyncHandler";
import { AppError } from "@src/core/errors/AppError";
import { createAuditLog } from "../audit/audit.service";
import { getAuthUserId } from "@src/core/utils/auth-user.utils";

export const getDataTable = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.getDataTableAssignments(req.body);
  return res.status(200).json(createTResult(result));
});

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const result = await assignmentService.createAssignment({
    ...req.body,
    assignedBy: res.locals.user.id,
  });

  await createAuditLog({
    userId: getAuthUserId(res),
    module: "ASSIGNMENTS",
    action: "CREATE",
    resourceId: result.id,
    details: { guardId: result.guardId, locationId: result.locationId },
  });

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

  await createAuditLog({
    userId: getAuthUserId(res),
    module: "ASSIGNMENTS",
    action: "UPDATE_STATUS",
    resourceId: id,
    details: { status },
  });

  return res.status(200).json(createTResult(result));
});

export const toggleTask = asyncHandler(async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const result = await assignmentService.toggleAssignmentTask(taskId);

  await createAuditLog({
    userId: getAuthUserId(res),
    module: "ASSIGNMENTS",
    action: "TOGGLE_TASK",
    resourceId: taskId,
  });

  return res.status(200).json(createTResult(result));
});

export const deleteAssignment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await assignmentService.deleteAssignment(id);

  await createAuditLog({
    userId: getAuthUserId(res),
    module: "ASSIGNMENTS",
    action: "DELETE",
    resourceId: id,
  });

  return res.status(200).json(createTResult(true));
});
