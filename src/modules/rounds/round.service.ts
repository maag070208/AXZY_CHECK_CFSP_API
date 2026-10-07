import { getErrorMessage } from "@src/core/utils/error.utils";
import { AppError } from "@src/core/errors/AppError";
import {
  ASSIGNMENT_STATUS_PENDING,
  OPERATIONAL_ROLES,
  ROLE_CLIENT,
  ROUND_STATUS_COMPLETED,
  ROUND_STATUS_IN_PROGRESS,
  TIMELINE_EVENT_START,
  TIMELINE_EVENT_SCAN,
  TIMELINE_EVENT_END,
  TIMELINE_EVENT_INCIDENT,
} from "@src/core/config/constants";
import { prismaClient as prisma } from "@src/core/config/database";
import { Prisma, Round, RoundStatus } from "@prisma/client";
import { AuthenticatedUser } from "@src/core/types/auth.types";
import { TResult } from "@src/core/dto/TResult";
import { IRoundResponse } from "./round.response";
import {
  ITDataTableFetchParams,
  ITDataTableResponse,
} from "@src/core/dto/datatable.dto";
import { getPrismaPaginationParams } from "@src/core/utils/prisma-pagination.utils";
import { TRoundDetailResult, IRoundTimelineEvent } from "./round.dto";
import { generateRoundPDFBuffer } from "./round.pdf.service";
import { getStartOfDay, getEndOfDay, now } from "@src/core/utils/date-time.utils";



/** Ronda con sus relaciones básicas (listado). */
type RoundWithBasicRelations = Prisma.RoundGetPayload<{
  include: { guard: true; recurringConfiguration: true; client: true };
}>;

/** Ronda en curso con la configuración recurrente expandida (pantalla del guardia). */
type CurrentRoundWithRecurring = Prisma.RoundGetPayload<{
  include: {
    recurringConfiguration: {
      include: {
        recurringLocations: {
          include: { location: { include: { zone: true } }; tasks: true };
          orderBy: { order: "asc" };
        };
      };
    };
  };
}>;

export const getDataTableRounds = async (
  params: ITDataTableFetchParams,
  user?: AuthenticatedUser,
): Promise<ITDataTableResponse<IRoundResponse>> => {
  const customFilters = params.filters || {};
  // Filtro dinámico: algunas claves llevan objetos de Prisma (p. ej. `guard`),
  // por eso no encaja en el tipo escalar de `filters` y se castea al usarlo.
  const cleanFilters: Record<string, unknown> = {};
  let clientIdFilter: string | undefined;

  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (key === "refreshKey" || key === "date") continue;

      if (key === "guard") {
        cleanFilters["guardId"] = value;
      } else if (key === "client" || key === "clientId") {
        clientIdFilter = value as string;
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
    filters: cleanFilters as Record<string, string | number | boolean>,
    sort: params.sort || { key: "startTime", direction: "desc" },
  });

  prismaParams.where.deletedAt = null;

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

  if (user) {
    if (user.role === ROLE_CLIENT) {
      // Un usuario de cliente SIEMPRE queda acotado a su empresa: sin clientId
      // asignado no debe ver ningún recorrido (antes veía todos).
      if (user.clientId) {
        prismaParams.where.OR = [
          { clientId: user.clientId },
          { recurringConfiguration: { clientId: user.clientId } },
        ];
      } else {
        prismaParams.where.id = "NO_CLIENT";
      }
    } else if (OPERATIONAL_ROLES.includes(user.role)) {
      if (user.clientId) {
        prismaParams.where.OR = [
          { clientId: user.clientId },
          { recurringConfiguration: { clientId: user.clientId } },
        ];
      } else {
        prismaParams.where.id = "NO_CLIENT";
      }
    }
  }

  if (clientIdFilter) {
    const existingOR = prismaParams.where.OR || [];
    prismaParams.where.OR = [
      ...existingOR,
      { clientId: clientIdFilter },
      { recurringConfiguration: { clientId: clientIdFilter } },
    ];
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

  // Get kardex counts for each round by guard + time range
  const counts = await Promise.all(
    rows.map((r) =>
      prisma.kardex.count({
        where: {
          userId: r.guardId,
          timestamp: {
            gte: r.startTime,
            ...(r.endTime ? { lte: r.endTime } : {}),
          },
        },
      }),
    ),
  );
  const enrichedRows = rows.map((r, i) => ({
    ...r,
    _count: { kardexEntries: counts[i] },
  }));

  return { rows: enrichedRows as unknown as IRoundResponse[], total };
};

export const startRound = async (
  guardId: string,
  clientId?: string,
  recurringConfigurationId?: string,
): Promise<TResult<Round>> => {
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

export const endRound = async (id: string): Promise<TResult<Round>> => {
    const round = await prisma.round.update({
      where: { id },
      data: { status: ROUND_STATUS_COMPLETED, endTime: now() },
    });
    return { success: true, data: round, messages: [] };
};

export const getCurrentRound = async (
  guardId: string,
): Promise<TResult<(CurrentRoundWithRecurring & { kardex?: unknown }) | null>> => {
  try {
    const round = await prisma.round.findFirst({
      where: { guardId, status: ROUND_STATUS_IN_PROGRESS, deletedAt: null },
      include: {
        recurringConfiguration: {
          include: {
            recurringLocations: {
              include: { location: { include: { zone: true } }, tasks: true },
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
      (round as unknown as { kardex: unknown }).kardex = kardex;
    }

    return { success: true, data: round, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const getRounds = async (
  date?: string,
  guardId?: string,
  user?: AuthenticatedUser,
  status?: string,
): Promise<TResult<RoundWithBasicRelations[] | null>> => {
  try {
    const where: Prisma.RoundWhereInput = { deletedAt: null };
    if (date) {
      const start = getStartOfDay(date);
      const end = getEndOfDay(date);
      where.startTime = { gte: start, lte: end };
    }
    if (guardId) where.guardId = guardId;
    if (status) where.status = status as RoundStatus;
    if (user) {
      if (user.role === ROLE_CLIENT) {
        // Un usuario de cliente SIEMPRE queda acotado a su empresa: sin clientId
        // asignado no ve ningún recorrido (antes veía todos).
        if (user.clientId) {
          where.OR = [
            { clientId: user.clientId },
            { recurringConfiguration: { clientId: user.clientId } },
          ];
        } else {
          where.id = "NO_CLIENT";
        }
      } else if (OPERATIONAL_ROLES.includes(user.role)) {
        if (user.clientId) {
          where.OR = [
            { clientId: user.clientId },
            { recurringConfiguration: { clientId: user.clientId } },
          ];
        } else {
          where.id = "NO_CLIENT";
        }
      }
    }

    const rounds = await prisma.round.findMany({
      where,
      include: { guard: true, recurringConfiguration: true, client: true },
      orderBy: { startTime: "desc" },
    });
    return { success: true, data: rounds, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const getRoundDetail = async (
  id: string,
  user?: AuthenticatedUser,
): Promise<TRoundDetailResult> => {
  try {
    const round = await prisma.round.findFirst({
      where: { id, deletedAt: null },
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

    if (user?.role === ROLE_CLIENT) {
      // Un usuario de cliente sin empresa asignada no puede ver ninguna ronda.
      if (!user.clientId) {
        return {
          success: false,
          data: null,
          messages: ["No tienes permiso para ver los detalles de esta ronda."],
        };
      }
      const roundClientId =
        round.clientId ||
        round.recurringConfiguration?.clientId ||
        round.recurringConfiguration?.client?.id;
      if (roundClientId && roundClientId !== user.clientId) {
        return {
          success: false,
          data: null,
          messages: ["No tienes permiso para ver los detalles de esta ronda."],
        };
      }
    }

    const start = round.startTime;
    const end = round.endTime || now();

    let scans = await prisma.kardex.findMany({
      where: { timestamp: { gte: start, lte: end }, userId: round.guardId },
      include: { location: true, assignment: { include: { tasks: true } } },
      orderBy: { timestamp: "asc" },
    });

    scans = await Promise.all(scans.map(async (s) => {
      if (!s.assignment && s.scanType === "RECURRING") {
        const recurringTask = await prisma.recurringLocation.findFirst({
          where: { locationId: s.locationId },
          include: { tasks: true },
          orderBy: { createdAt: "desc" },
        });
        if (recurringTask && recurringTask.tasks.length > 0) {
          (s as unknown as { assignment: unknown }).assignment = {
            id: "0",
            status: ASSIGNMENT_STATUS_PENDING,
            tasks: recurringTask.tasks.map((t) => ({
              id: t.id,
              description: t.description,
              completed: false,
              reqPhoto: t.reqPhoto,
            })),
          };
        }
      }
      return s;
    }));

    const timeline: IRoundTimelineEvent[] = [];
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
        description: `Escaneo: ${s.location?.name || "Punto desconocido"}`,
        data: s,
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
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const deleteRound = async (id: string): Promise<TResult<null>> => {
  try {
    const round = await prisma.round.findFirst({ where: { id, deletedAt: null } });
    if (!round) {
      return { success: false, data: null, messages: ["Ronda no encontrada"] };
    }

    await prisma.round.update({
      where: { id },
      data: { deletedAt: now() },
    });

    return { success: true, data: null, messages: [] };
  } catch (error: unknown) {
    return { success: false, data: null, messages: [getErrorMessage(error)] };
  }
};

export const generateRoundPDF = async (
  id: string,
  user?: AuthenticatedUser,
): Promise<Buffer> => {
  const detailRes = await getRoundDetail(id, user);
  if (!detailRes.success || !detailRes.data) {
    // AppError: el middleware central responde el código correcto (404) y no un 500.
    throw new AppError(detailRes.messages?.[0] || "Ronda no encontrada", 404);
  }

  const { round, timeline } = detailRes.data;
  return generateRoundPDFBuffer(round, timeline);
};
