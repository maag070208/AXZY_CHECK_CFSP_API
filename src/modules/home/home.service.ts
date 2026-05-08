import { prismaClient as prisma } from "@src/core/config/database";
import { TResult } from "@src/core/dto/TResult";
import {
  ROUND_STATUS_IN_PROGRESS,
  INCIDENT_STATUS_PENDING,
  MAINTENANCE_STATUS_PENDING,
  ROLE_CLIENT,
} from "@src/core/config/constants";
import { IDashboardStats } from "./home.dto";

export const getDashboardStats = async (
  user: any,
): Promise<TResult<IDashboardStats>> => {
  try {
    const where: { clientId?: string } = {};
    if (user.role === ROLE_CLIENT && user.clientId) {
      where.clientId = user.clientId;
    }

    const [
      activeRounds,
      activeRoundsList,
      pendingIncidents,
      pendingMaintenance,
    ] = await Promise.all([
      prisma.round.count({
        where: { ...where, status: ROUND_STATUS_IN_PROGRESS },
      }),
      prisma.round.findMany({
        where: { ...where, status: ROUND_STATUS_IN_PROGRESS },
        include: {
          guard: { select: { name: true, lastName: true } },
          client: { select: { name: true } },
        },
        orderBy: { startTime: "desc" },
        take: 5,
      }),
      prisma.incident.count({
        where: { ...where, status: INCIDENT_STATUS_PENDING },
      }),
      prisma.maintenance.count({
        where: { ...where, status: MAINTENANCE_STATUS_PENDING },
      }),
    ]);

    return {
      success: true,
      data: {
        activeRoundsCount: activeRounds,
        activeRounds: activeRoundsList,
        pendingIncidentsCount: pendingIncidents,
        pendingMaintenanceCount: pendingMaintenance,
      },
      messages: [],
    };
  } catch (error: any) {
    return {
      success: false,
      data: null as unknown as IDashboardStats,
      messages: [error.message],
    };
  }
};
