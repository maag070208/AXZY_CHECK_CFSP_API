
import { Request, Response } from "express";
import * as assignmentService from "./assignment.service";
import { AssignmentStatus } from "@prisma/client";
import { createTResult } from "@src/core/mappers/tresult.mapper";

export const getDataTable = async (req: Request, res: Response) => {
  try {
    const result = await assignmentService.getDataTableAssignments(req.body);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const createAssignment = async (req: Request, res: Response) => {
  try {
    const { guardId, locationId, notes, tasks, assignedBy: bodyAssignedBy } = req.body;
    const assignedBy = bodyAssignedBy;
    console.log({
      assignedBy,
      guardId,
      locationId,
      notes,
      tasks,
    });
    const result = await assignmentService.createAssignment({
      guardId: guardId as string,
      locationId: locationId as string,
      assignedBy: Number(assignedBy),
      notes,
      tasks,
    });

    return res.status(201).json(createTResult(result));
  } catch (error: any) {
    return res.status(400).json(createTResult(null, error.message));
  }
};

export const getMyAssignments = async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const userId = req.user?.id as string;
    const { guardId: queryGuardId } = req.query;
    const guardId = userId || (queryGuardId as string);
    
    if (!guardId) return res.status(401).json(createTResult(null, ["Unauthorized"]));

    const result = await assignmentService.getAssignmentsByGuard(guardId);
    return res.status(200).json(createTResult(result));
  } catch (error: any) {
    return res.status(500).json(createTResult(null, error.message));
  }
};

export const getAllAssignments = async (req: Request, res: Response) => {
    try {
        const { guardId, status, id } = req.query;
        const result = await assignmentService.getAllAssignments({ 
            id: id as string,
            guardId: guardId as string,
            status: status as AssignmentStatus
        });
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
}

export const updateStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await assignmentService.updateAssignmentStatus(id, status);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
}

export const toggleTask = async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;
        const result = await assignmentService.toggleAssignmentTask(taskId);
        return res.status(200).json(createTResult(result));
    } catch (error: any) {
        return res.status(500).json(createTResult(null, error.message));
    }
}
