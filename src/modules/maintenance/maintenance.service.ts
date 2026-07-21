import { prismaClient } from "@src/core/config/database";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import {
  MAINTENANCE_STATUS_ATTENDED,
  MAINTENANCE_STATUS_PENDING,
} from "@src/core/config/constants";

import { IMaintenanceResponse } from "./maintenance.response";

import { ROLE_CLIENT } from "@src/core/config/constants";
import { publishActivity } from "@src/core/utils/ably-publisher";
import { now } from "@src/core/utils/date-time.utils";

export const getDataTableMaintenances = async (
  params: ITDataTableFetchParams,
  user?: any,
): Promise<ITDataTableResponse<IMaintenanceResponse>> => {
  const prismaParams = getPrismaPaginationParams(params);

  if (user?.role === ROLE_CLIENT && user.clientId) {
    prismaParams.where.clientId = user.clientId;
  }
  
  // Handle combined search
  const searchVal = String(params.filters.search || "").trim();
  if (searchVal.length > 0) {
    delete prismaParams.where.search; // Remove generic search added by util
    prismaParams.where.OR = [
      { title: { contains: searchVal, mode: "insensitive" } },
      { description: { contains: searchVal, mode: "insensitive" } },
    ];
  }

  if (params.filters.clientId && params.filters.clientId !== "ALL") {
    prismaParams.where.clientId = params.filters.clientId;
  }

  const [rows, total] = await Promise.all([
    prismaClient.maintenance.findMany({
      ...prismaParams,
      select: {
        id: true,
        guardId: true,
        title: true,
        categoryId: true,
        typeId: true,
        category: true,
        description: true,
        media: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        resolvedAt: true,
        resolvedById: true,
        status: true,
        clientId: true,
        guard: { select: { id: true, name: true, lastName: true, username: true } },
        resolvedBy: { select: { id: true, name: true, lastName: true } },
        categoryRel: { select: { id: true, name: true, icon: true, color: true } },
        type: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: prismaParams.orderBy || { createdAt: "desc" },
    }),
    prismaClient.maintenance.count({
      where: prismaParams.where,
    }),
  ]);

  return { rows: rows as IMaintenanceResponse[], total };
};

import {
  sendMaintenanceEmail,
  sendMaintenanceWhatsApp,
} from "@src/core/utils/emailSender";
import { logger } from "@src/core/utils/logger";

export const createMaintenance = async (data: {
  guardId: string;
  title: string;
  categoryId?: string;
  typeId?: string;
  category?: string;
  description?: string;
  media?: any;
  latitude?: number;
  longitude?: number;
  clientId?: string;
}) => {
  const maintenance = await prismaClient.$transaction(async (tx) => {
    let clientId = data.clientId;
    if (!clientId) {
      const guard = await tx.user.findUnique({
        where: { id: data.guardId },
        select: { clientId: true },
      });
      clientId = guard?.clientId || undefined;
    }

    return tx.maintenance.create({
      data: {
        guardId: data.guardId,
        title: data.title,
        categoryId: data.categoryId,
        typeId: data.typeId,
        category: data.category,
        description: data.description,
        media: data.media,
        latitude: data.latitude,
        longitude: data.longitude,
        clientId: clientId,
      },
    });
  });

  setImmediate(async () => {
    try {
      const enrichedMaintenance = await prismaClient.maintenance.findUnique({
        where: { id: maintenance.id },
        include: {
          guard: true,
          categoryRel: true,
          type: true,
        },
      });
      if (enrichedMaintenance) {
        await sendMaintenanceEmail(
          enrichedMaintenance,
          enrichedMaintenance.guard,
        );
        await sendMaintenanceWhatsApp(
          enrichedMaintenance,
          enrichedMaintenance.guard,
        );

        await publishActivity("maintenance", "created", {
          id: enrichedMaintenance.id,
          title: enrichedMaintenance.title,
          status: enrichedMaintenance.status,
          guardId: enrichedMaintenance.guardId,
          guardName: enrichedMaintenance.guard
            ? `${enrichedMaintenance.guard.name} ${enrichedMaintenance.guard.lastName ?? ""}`.trim()
            : null,
          clientId: enrichedMaintenance.clientId,
        });
      }
    } catch (error) {
      logger.error("Background maintenance processing error:", error);
    }
  });

  return maintenance;
};

export const getMaintenancesByGuard = async (guardId: string) => {
  return prismaClient.maintenance.findMany({
    where: { guardId },
    orderBy: { createdAt: "desc" },
  });
};

export const getMaintenances = async (filters: {
  startDate?: Date;
  endDate?: Date;
  guardId?: string;
  category?: string;
  title?: string;
  clientId?: string;
}) => {
  const whereClause: any = {};

  if (filters.startDate && filters.endDate) {
    whereClause.createdAt = {
      gte: filters.startDate,
      lte: filters.endDate,
    };
  } else if (filters.startDate) {
    whereClause.createdAt = { gte: filters.startDate };
  }

  if (filters.guardId) whereClause.guardId = filters.guardId;
  if (filters.category) whereClause.category = filters.category;
  if (filters.title)
    whereClause.title = { contains: filters.title, mode: "insensitive" };
  if (filters.clientId) whereClause.clientId = filters.clientId;

  return prismaClient.maintenance.findMany({
    where: whereClause,
    select: {
      id: true,
      guardId: true,
      title: true,
      categoryId: true,
      typeId: true,
      category: true,
      description: true,
      media: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      resolvedAt: true,
      resolvedById: true,
      status: true,
      clientId: true,
      guard: { select: { id: true, name: true, lastName: true, username: true } },
      resolvedBy: { select: { id: true, name: true, lastName: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const resolveMaintenance = async (id: string, userId: string) => {
  const updated = await prismaClient.maintenance.update({
    where: { id },
    data: {
      status: MAINTENANCE_STATUS_ATTENDED,
      resolvedAt: now(),
      resolvedById: userId,
    },
    include: {
      guard: true,
      resolvedBy: true,
    },
  });

  setImmediate(() => {
    publishActivity("maintenance", "resolved", {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      guardId: updated.guardId,
      clientId: updated.clientId,
      resolvedById: updated.resolvedById,
    });
  });

  return updated;
};

export const getPendingMaintenancesCount = async () => {
  return prismaClient.maintenance.count({
    where: {
      status: MAINTENANCE_STATUS_PENDING,
    },
  });
};

export const getMaintenanceById = async (id: string) => {
  return prismaClient.maintenance.findUnique({
    where: { id },
    include: {
      guard: true,
      resolvedBy: true,
    },
  });
};

export const deleteMaintenance = async (id: string) => {
  return prismaClient.maintenance.delete({
    where: { id },
  });
};

export const updateMaintenanceMedia = async (id: string, media: any) => {
  return prismaClient.maintenance.update({
    where: { id },
    data: { media },
  });
};
