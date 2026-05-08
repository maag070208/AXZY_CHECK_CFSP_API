
import { prismaClient } from "@src/core/config/database";
import { PrismaClient, AssignmentStatus } from "@prisma/client";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { now } from "@src/core/utils/date-time.utils";
import { OPERATIONAL_ROLES, ASSIGNMENT_STATUS_PENDING } from "@src/core/config/constants";
import { CreateAssignmentSchema } from "./schemas/assignment.schema";

import { AppError } from "@src/core/errors/AppError";

const prisma = prismaClient;

import { IAssignmentResponse } from "./assignment.response";

export const getDataTableAssignments = async (params: ITDataTableFetchParams): Promise<ITDataTableResponse<IAssignmentResponse>> => {
  const prismaParams = getPrismaPaginationParams(params);

  // Map clientId to location relation
  if (prismaParams.where.clientId) {
    prismaParams.where.location = {
      clientId: prismaParams.where.clientId
    };
    delete prismaParams.where.clientId;
  }

  const [rows, total] = await Promise.all([
    prisma.assignment.findMany({
      ...prismaParams,
      select: {
        id: true,
        guardId: true,
        locationId: true,
        status: true,
        assignedBy: true,
        notes: true,
        createdAt: true,
        location: {
          select: {
            id: true,
            name: true,
            clientId: true
          }
        },
        guard: {
          select: { id: true, name: true, lastName: true }
        },
        tasks: {
          select: {
            id: true,
            description: true,
            reqPhoto: true,
            completed: true,
            completedAt: true
          }
        },
      }
    }),
    prisma.assignment.count({
      where: prismaParams.where
    })
  ]);

  return { rows: rows as IAssignmentResponse[], total };
};

// Create a new assignment
export const createAssignment = async (data: CreateAssignmentSchema) => {
  // Validate guard role
  const guard = await prisma.user.findUnique({
    where: { id: data.guardId },
    include: { role: true }
  });

  if (!guard || !OPERATIONAL_ROLES.includes(guard.role.name)) {
    throw new AppError(`Invalid guard ID or user is not a GUARD, SHIFT or MAINT. Guard: ${guard?.username}, Role: ${guard?.role?.name}`, 400);
  }

  // Duplicate Check: Guard + Location + Active Status
  const activeAssignment = await prisma.assignment.findFirst({
    where: {
      guardId: data.guardId,
      locationId: data.locationId,
      status: {
        in: [
          AssignmentStatus.PENDING,
          AssignmentStatus.CHECKING,
          AssignmentStatus.UNDER_REVIEW,
          AssignmentStatus.ANOMALY,
        ],
      },
    },
  });

  if (activeAssignment) {
    throw new AppError("El guardia ya tiene una asignación activa para esta ubicación.", 400);
  }

  return prisma.assignment.create({
    data: {
      guardId: data.guardId,
      locationId: data.locationId,
      assignedBy: data.assignedBy,
      notes: data.notes,
      status: ASSIGNMENT_STATUS_PENDING as AssignmentStatus,
      tasks: data.tasks && data.tasks.length > 0 ? {
        create: data.tasks.map((t) => ({
          description: t.description,
          reqPhoto: t.reqPhoto,
        })),
      } : undefined,
    },
    include: {
      location: true,
      guard: {
        select: { id: true, name: true, lastName: true },
      },
      tasks: true,
    },
  });
};

// Get assignments for a specific guard (My Assignments)
export const getAssignmentsByGuard = async (guardId: string) => {
  return prisma.assignment.findMany({
    where: { 
      guardId,
      status: {
        in: [AssignmentStatus.PENDING, AssignmentStatus.ANOMALY]
      }
    },
    include: {
      location: true,
      tasks: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

// Get all assignments (filtering optional)
export const getAllAssignments = async (filters: { guardId?: string; status?: AssignmentStatus; id?: string }) => {
  const where: any = {};
  if (filters.id) where.id = filters.id;
  if (filters.guardId) where.guardId = filters.guardId;
  if (filters.status) where.status = filters.status;

  return prisma.assignment.findMany({
    where,
    include: {
        location: true,
        guard: { select: { id: true, name: true, lastName: true } },
        tasks: true,
        kardex: {
          include: {
            location: true,
            user: { select: { id: true, name: true, lastName: true, username: true, role: true } },
            assignment: true
          }
        }
    },
    orderBy: { createdAt: 'desc' }
  });
};

// Update status
export const updateAssignmentStatus = async (id: string, status: AssignmentStatus) => {
    return prisma.assignment.update({
        where: { id },
        data: { status }
    });
}

// Toggle task completion
export const toggleAssignmentTask = async (taskId: string) => {
    const task = await prisma.assignmentTask.findUnique({ where: { id: taskId } });
    if (!task) throw new Error("Task not found");

    return prisma.assignmentTask.update({
        where: { id: taskId },
        data: { 
            completed: !task.completed,
            completedAt: !task.completed ? now() : null
        }
    });
}

