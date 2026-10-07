import { AuthenticatedUser } from "@src/core/types/auth.types";
import { prismaClient as prisma } from "@src/core/config/database";
import {
  ROLE_CLIENT,
  ROLE_GUARD,
  ROLE_MAINTENANCE,
  ROLE_SHIFT,
  INCIDENT_STATUS_PENDING,
  MAINTENANCE_STATUS_PENDING,
  ROUND_STATUS_IN_PROGRESS,
} from "@src/core/config/constants";
import {
  IActiveBreakdown,
  IActiveGuard,
  IActivityItem,
  IDashboardOverview,
  IPanicAlertListItem,
  IPendingCounts,
  IRoleBreakdown,
} from "./dashboard.dto";

/**
 * Filtro de cliente para modelos que SÍ tienen `clientId` propio.
 *
 * Un usuario RESDN (cliente) queda SIEMPRE acotado a su empresa; si no tiene
 * `clientId` asignado no debe ver nada (antes veía los datos de TODOS).
 */
const buildClientFilter = (user: AuthenticatedUser) => {
  if (user?.role !== ROLE_CLIENT) return {};
  return { clientId: user.clientId ?? { in: [] as string[] } };
};

/**
 * Filtro de cliente para `User` (guardias/supervisores): el modelo tiene
 * `clientId` propio, misma semántica que `buildClientFilter`.
 */
const buildGuardFilter = (user: AuthenticatedUser) => {
  if (user?.role !== ROLE_CLIENT) return {};
  return { clientId: user.clientId ?? { in: [] as string[] } };
};

/**
 * Filtro de cliente para modelos SIN `clientId` propio (p. ej. `Assignment`):
 * el alcance se resuelve por la ubicación (punto de control) relacionada.
 */
const buildAssignmentClientFilter = (user: AuthenticatedUser) => {
  if (user?.role !== ROLE_CLIENT) return {};
  return { location: { clientId: user.clientId ?? { in: [] as string[] } } };
};

/** Where para `Client`: un RESDN sólo se cuenta a sí mismo. */
const buildClientSelfFilter = (user: AuthenticatedUser) => {
  if (user?.role !== ROLE_CLIENT) return {};
  return { id: user.clientId ?? { in: [] as string[] } };
};

/**
 * Vista 1: KPIs generales del dashboard.
 * Retorna el dato crudo (no TResult) para que el controller haga el wrap.
 */
export const getOverview = async (
  user: AuthenticatedUser,
): Promise<IDashboardOverview> => {
  const clientWhere = buildClientFilter(user);

  const [
    totalGuards,
    totalShift,
    totalMaintenance,
    activeGuardsNow,
    activeGuardsNowShift,
    activeGuardsNowMaintenance,
    totalClients,
    totalLocations,
    totalAssignments,
    pendingIncidents,
    pendingMaintenances,
    pendingDisciplines,
    activeRounds,
    panicAlerts,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        role: { name: ROLE_GUARD },
      },
    }),
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        role: { name: ROLE_SHIFT },
      },
    }),
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        role: { name: ROLE_MAINTENANCE },
      },
    }),
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        isLoggedIn: true,
        role: { name: ROLE_GUARD },
      },
    }),
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        isLoggedIn: true,
        role: { name: ROLE_SHIFT },
      },
    }),
    prisma.user.count({
      where: {
        ...buildGuardFilter(user),
        active: true,
        softDelete: false,
        isLoggedIn: true,
        role: { name: ROLE_MAINTENANCE },
      },
    }),
    prisma.client.count({
      where: { active: true, softDelete: false, ...buildClientSelfFilter(user) },
    }),
    prisma.location.count({
      where: { active: true, softDelete: false, ...clientWhere },
    }),
    // `Assignment` no tiene clientId: el alcance va por la ubicación relacionada.
    prisma.assignment.count({
      where: { deletedAt: null, ...buildAssignmentClientFilter(user) },
    }),
    prisma.incident.count({
      where: { status: INCIDENT_STATUS_PENDING, deletedAt: null, ...clientWhere },
    }),
    prisma.maintenance.count({
      where: { status: MAINTENANCE_STATUS_PENDING, deletedAt: null, ...clientWhere },
    }),
    prisma.guardDiscipline.count({
      where: { status: "PENDING", deletedAt: null, ...clientWhere },
    }),
    prisma.round.count({
      where: { status: ROUND_STATUS_IN_PROGRESS, ...clientWhere },
    }),
    prisma.panicAlert.count({
      where: { status: "PENDING", deletedAt: null, ...clientWhere },
    }),
  ]);

  const totalBreakdown: IRoleBreakdown = {
    guards: totalGuards,
    shift: totalShift,
    maintenance: totalMaintenance,
  };

  const activeBreakdown: IActiveBreakdown = {
    total: activeGuardsNow + activeGuardsNowShift + activeGuardsNowMaintenance,
    guards: activeGuardsNow,
    shift: activeGuardsNowShift,
    maintenance: activeGuardsNowMaintenance,
  };

  const pendingCounts: IPendingCounts = {
    incidents: pendingIncidents,
    maintenances: pendingMaintenances,
    disciplines: pendingDisciplines,
    activeRounds,
    panicAlerts,
  };

  return {
    totalGuards: totalGuards + totalShift + totalMaintenance,
    activeGuardsNow: activeBreakdown.total,
    totalBreakdown,
    activeBreakdown,
    totalClients,
    totalLocations,
    totalAssignments,
    pendingCounts,
    generatedAt: new Date().toISOString(),
    scope: user?.role === ROLE_CLIENT ? 'CLIENT' : 'ALL',
  };
};

/**
 * Vista 2: Guardias activos en tiempo real.
 */
export const getActiveGuards = async (
  user: AuthenticatedUser,
): Promise<IActiveGuard[]> => {
  const guards = await prisma.user.findMany({
    where: {
      ...buildGuardFilter(user),
      active: true,
      softDelete: false,
      role: { name: { in: [ROLE_GUARD, ROLE_SHIFT, ROLE_MAINTENANCE] } },
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      username: true,
      role: { select: { name: true } },
      clientId: true,
      client: { select: { name: true } },
      isLoggedIn: true,
      rounds: {
        where: { status: ROUND_STATUS_IN_PROGRESS },
        orderBy: { startTime: "desc" },
        take: 1,
        select: {
          id: true,
          startTime: true,
        },
      },
      kardexEntries: {
        orderBy: { timestamp: "desc" },
        take: 1,
        select: {
          timestamp: true,
          location: { select: { name: true } },
        },
      },
    },
    orderBy: [{ isLoggedIn: "desc" }, { name: "asc" }],
  });

  return guards.map((g) => {
    const lastKardex = g.kardexEntries?.[0];
    const roleName = g.role?.name as 'GUARD' | 'SHIFT' | 'MAINT' | undefined;
    return {
      id: g.id,
      name: g.name,
      lastName: g.lastName ?? "",
      username: g.username,
      role: roleName === 'SHIFT' || roleName === 'MAINT' || roleName === 'GUARD'
        ? roleName
        : 'GUARD',
      clientId: g.clientId,
      clientName: g.client?.name ?? null,
      isLoggedIn: g.isLoggedIn,
      currentRoundId: g.rounds?.[0]?.id ?? null,
      currentRoundStartTime:
        g.rounds?.[0]?.startTime?.toISOString?.() ?? null,
      currentLocationName: null,
      lastKardexAt: lastKardex?.timestamp?.toISOString?.() ?? null,
      lastKardexLocation: lastKardex?.location?.name ?? null,
    };
  });
};

/**
 * Vista 3: Conteo de pendientes.
 */
export const getPendingCounts = async (
  user: AuthenticatedUser,
): Promise<IPendingCounts> => {
  const clientWhere = buildClientFilter(user);
  const [incidents, maintenances, disciplines, activeRounds, panicAlerts] =
    await Promise.all([
      prisma.incident.count({
        where: { status: INCIDENT_STATUS_PENDING, deletedAt: null, ...clientWhere },
      }),
      prisma.maintenance.count({
        where: { status: MAINTENANCE_STATUS_PENDING, deletedAt: null, ...clientWhere },
      }),
      prisma.guardDiscipline.count({
        where: { status: "PENDING", deletedAt: null, ...clientWhere },
      }),
      prisma.round.count({
        where: { status: ROUND_STATUS_IN_PROGRESS, ...clientWhere },
      }),
      prisma.panicAlert.count({
        where: { status: "PENDING", deletedAt: null, ...clientWhere },
      }),
    ]);

  return { incidents, maintenances, disciplines, activeRounds, panicAlerts };
};

/**
 * Vista 4: Feed unificado de actividad reciente.
 */
export const getRecentActivity = async (
  user: AuthenticatedUser,
  limit: number = 20,
): Promise<IActivityItem[]> => {
  const take = Math.min(Math.max(limit, 1), 50);
  const clientWhere = buildClientFilter(user);

  const [incidents, maintenances, disciplines, panicAlerts] = await Promise.all([
    prisma.incident.findMany({
      where: { deletedAt: null, ...clientWhere },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        client: { select: { name: true } },
        guardId: true,
        guard: { select: { name: true, lastName: true } },
        createdAt: true,
      },
    }),
    prisma.maintenance.findMany({
      where: { deletedAt: null, ...clientWhere },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        client: { select: { name: true } },
        guardId: true,
        guard: { select: { name: true, lastName: true } },
        createdAt: true,
      },
    }),
    prisma.guardDiscipline.findMany({
      where: { deletedAt: null, ...clientWhere },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        title: true,
        status: true,
        clientId: true,
        client: { select: { name: true } },
        guardId: true,
        guard: { select: { name: true, lastName: true } },
        createdAt: true,
      },
    }),
    prisma.panicAlert.findMany({
      where: { deletedAt: null, ...clientWhere },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        guardId: true,
        clientId: true,
        triggerLatitude: true,
        triggerLongitude: true,
        message: true,
        status: true,
        guard: { select: { name: true, lastName: true } },
        client: { select: { name: true } },
        createdAt: true,
      },
    }),
  ]);

  return [
    ...panicAlerts.map<IActivityItem>((p) => ({
      id: p.id,
      type: 'panic' as const,
      title: p.message ?? "Alerta de pánico",
      guardId: p.guardId,
      guardName: `${p.guard.name} ${p.guard.lastName ?? ''}`.trim(),
      clientId: p.clientId,
      clientName: p.client?.name ?? null,
      status: p.status,
      latitude: p.triggerLatitude ?? undefined,
      longitude: p.triggerLongitude ?? undefined,
      createdAt: p.createdAt.toISOString(),
    })),
    ...incidents.map<IActivityItem>((i) => ({
      id: i.id,
      type: 'incident',
      title: i.title,
      guardId: i.guardId,
      guardName: `${i.guard.name} ${i.guard.lastName ?? ''}`.trim(),
      clientId: i.clientId,
      clientName: i.client?.name ?? null,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    })),
    ...maintenances.map<IActivityItem>((m) => ({
      id: m.id,
      type: 'maintenance',
      title: m.title,
      guardId: m.guardId,
      guardName: `${m.guard.name} ${m.guard.lastName ?? ''}`.trim(),
      clientId: m.clientId,
      clientName: m.client?.name ?? null,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    })),
    ...disciplines.map<IActivityItem>((d) => ({
      id: d.id,
      type: 'discipline',
      title: d.title,
      guardId: d.guardId,
      guardName: `${d.guard.name} ${d.guard.lastName ?? ''}`.trim(),
      clientId: d.clientId,
      clientName: d.client?.name ?? null,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, take);
};

/**
 * Vista 5: Lista dedicada de alertas de pánico recientes.
 */
export const getRecentPanicAlerts = async (
  user: AuthenticatedUser,
  limit: number = 10,
): Promise<IPanicAlertListItem[]> => {
  const take = Math.min(Math.max(limit, 1), 50);
  const clientWhere = buildClientFilter(user);

  const alerts = await prisma.panicAlert.findMany({
    where: { deletedAt: null, ...clientWhere },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      guardId: true,
      clientId: true,
      triggerLatitude: true,
      triggerLongitude: true,
      message: true,
      status: true,
      resolutionComment: true,
      resolvedById: true,
      resolvedAt: true,
      guard: { select: { name: true, lastName: true } },
      client: { select: { name: true } },
      createdAt: true,
    },
  });

  return alerts.map((a) => ({
    id: a.id,
    title: a.message ?? "Alerta de pánico",
    description: a.resolutionComment,
    guardId: a.guardId,
    guardName: `${a.guard.name} ${a.guard.lastName ?? ''}`.trim(),
    clientId: a.clientId,
    clientName: a.client?.name ?? null,
    latitude: a.triggerLatitude,
    longitude: a.triggerLongitude,
    status: a.status,
    resolutionComment: a.resolutionComment,
    resolvedById: a.resolvedById,
    createdAt: a.createdAt.toISOString(),
    resolvedAt: a.resolvedAt?.toISOString() ?? null,
  }));
};
