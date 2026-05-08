import {
  ROLE_CLIENT,
  ROUND_STATUS_COMPLETED,
  ROUND_STATUS_IN_PROGRESS,
  TIMELINE_EVENT_START,
  TIMELINE_EVENT_SCAN,
  TIMELINE_EVENT_END,
  TIMELINE_EVENT_INCIDENT,
} from "@src/core/config/constants";
import { prismaClient as prisma } from "@src/core/config/database";
import { TResult } from "@src/core/dto/TResult";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { TRoundDetailResult } from "./round.dto";
import { generateRoundPDFBuffer } from "./round.pdf.service";
import { getStartOfDay, getEndOfDay, now } from "@src/core/utils/date-time.utils";

import { IRoundResponse } from "./round.response";

export const getDataTableRounds = async (
  params: ITDataTableFetchParams,
  user?: any,
): Promise<ITDataTableResponse<IRoundResponse>> => {
  const customFilters = params.filters || {};
  const cleanFilters: any = {};

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (key === "refreshKey" || key === "date") continue;

      if (key === "guard") {
        cleanFilters["guardId"] = value;
      } else if (key === "client") {
        cleanFilters["clientId"] = value;
      } else if (key === "search") {
        cleanFilters.guard = {
          OR: [
            { name: { contains: String(value), mode: "insensitive" } },
            { lastName: { contains: String(value), mode: "insensitive" } },
            { username: { contains: String(value), mode: "insensitive" } },
          ],
        };
      } else {
        cleanFilters[key] = value;
      }
    }
  }

  const prismaParams = getPrismaPaginationParams({
    ...params,
    filters: cleanFilters,
    sort: params.sort || { key: "startTime", direction: "desc" },
  });

  if (customFilters.date) {
    const dateParams = Array.isArray(customFilters.date)
      ? customFilters.date
      : [customFilters.date, customFilters.date];
    const start = getStartOfDay(dateParams[0]);
    const end = getEndOfDay(dateParams[1] || dateParams[0]);

    if (start && end) {
      prismaParams.where.startTime = { gte: start, lte: end };
    }
  }

  if (user?.role === ROLE_CLIENT && user.clientId) {
    prismaParams.where.clientId = user.clientId;
  }

  const [rows, total] = await Promise.all([
    prisma.round.findMany({
      ...prismaParams,
      select: {
        id: true,
        guardId: true,
        clientId: true,
        startTime: true,
        endTime: true,
        status: true,
        recurringConfigurationId: true,
        guard: {
          select: {
            id: true,
            name: true,
            lastName: true,
            username: true,
            client: { select: { name: true } }
          }
        },
        client: { select: { id: true, name: true } },
        recurringConfiguration: {
          select: {
            id: true,
            title: true,
            client: { select: { name: true } }
          }
        }
      }
    }),
    prisma.round.count({ where: prismaParams.where }),
  ]);

  return { rows: rows as IRoundResponse[], total };
};

export const startRound = async (
  guardId: string,
  clientId?: string,
  recurringConfigurationId?: string,
): Promise<TResult<any>> => {
    let targetClientId = clientId;

    if (!targetClientId && recurringConfigurationId) {
      const config = await prisma.recurringConfiguration.findUnique({
        where: { id: recurringConfigurationId },
        select: { clientId: true },
      });
      if (config?.clientId) targetClientId = config.clientId;
    }

    const round = await prisma.round.create({
      data: {
        guardId,
        clientId: targetClientId,
        recurringConfigurationId,
        status: ROUND_STATUS_IN_PROGRESS,
        startTime: now(),
      },
    });
    return { success: true, data: round, messages: [] };
};

export const endRound = async (id: string): Promise<TResult<any>> => {
    const round = await prisma.round.update({
      where: { id },
      data: { status: ROUND_STATUS_COMPLETED, endTime: now() },
    });
    return { success: true, data: round, messages: [] };
};

export const getCurrentRound = async (
  guardId: string,
): Promise<TResult<any>> => {
  try {
    const round = await prisma.round.findFirst({
      where: { guardId, status: ROUND_STATUS_IN_PROGRESS },
      include: {
        recurringConfiguration: {
          include: {
            recurringLocations: {
              include: { location: { include: { zone: true } } },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });

    if (round) {
      const kardex = await prisma.kardex.findMany({
        where: {
          userId: guardId,
          timestamp: { gte: round.startTime },
        },
        include: { location: true },
      });
      (round as any).kardex = kardex;
    }

    return { success: true, data: round, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const getRounds = async (
  date?: string,
  guardId?: string,
  user?: any,
  status?: string,
): Promise<TResult<any>> => {
  try {
    const where: any = {};
    if (date) {
      const start = getStartOfDay(date);
      const end = getEndOfDay(date);
      where.startTime = { gte: start, lte: end };
    }
    if (guardId) where.guardId = guardId;
    if (status) where.status = status;
    if (user?.role === ROLE_CLIENT && user.clientId)
      where.clientId = user.clientId;

    const rounds = await prisma.round.findMany({
      where,
      include: { guard: true, recurringConfiguration: true, client: true },
      orderBy: { startTime: "desc" },
    });
    return { success: true, data: rounds, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const getRoundDetail = async (
  id: string,
  user?: any,
): Promise<TRoundDetailResult> => {
  try {
    const round = await prisma.round.findUnique({
      where: { id },
      include: {
        guard: { include: { client: true } },
        client: { include: { locations: true } },
        recurringConfiguration: {
          include: {
            recurringLocations: {
              include: { location: true },
              orderBy: { order: "asc" },
            },
            client: true,
          },
        },
      },
    });

    if (!round)
      return { success: false, data: null, messages: ["Ronda no encontrada"] };

    if (
      user?.role === ROLE_CLIENT &&
      user.clientId &&
      round.clientId !== user.clientId
    ) {
      return {
        success: false,
        data: null,
        messages: ["No tienes permiso para ver los detalles de esta ronda."],
      };
    }

    const start = round.startTime;
    const end = round.endTime || now();

    const [scans, incidents] = await Promise.all([
      prisma.kardex.findMany({
        where: { timestamp: { gte: start, lte: end }, userId: round.guardId },
        include: { location: true, assignment: { include: { tasks: true } } },
        orderBy: { timestamp: "asc" },
      }),
      prisma.incident.findMany({
        where: { createdAt: { gte: start, lte: end }, guardId: round.guardId },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const timeline: any[] = [];
    timeline.push({
      type: TIMELINE_EVENT_START,
      timestamp: round.startTime,
      description: "Inicio de Ronda",
      data: null,
    });

    scans.forEach((s) => {
      timeline.push({
        type: TIMELINE_EVENT_SCAN,
        timestamp: s.timestamp,
        description: `Escaneo: ${(s as any).location?.name || "Punto desconocido"}`,
        data: s,
      });
    });

    incidents.forEach((inc) => {
      timeline.push({
        type: TIMELINE_EVENT_INCIDENT,
        timestamp: inc.createdAt,
        description: `Incidente: ${inc.title}`,
        data: inc,
      });
    });

    if (round.status === ROUND_STATUS_COMPLETED && round.endTime) {
      timeline.push({
        type: TIMELINE_EVENT_END,
        timestamp: round.endTime,
        description: "Cierre de Ronda",
        data: null,
      });
    }

    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return { success: true, data: { round, timeline }, messages: [] };
  } catch (error: any) {
    return { success: false, data: null, messages: [error.message] };
  }
};

export const generateRoundPDF = async (
  id: string,
  user?: any,
): Promise<Buffer> => {
  const detailRes = await getRoundDetail(id, user);
  if (!detailRes.success || !detailRes.data) {
    throw new Error(detailRes.messages?.[0] || "Ronda no encontrada");
  }

  const { round, timeline } = detailRes.data;
  return generateRoundPDFBuffer(round, timeline);
};
