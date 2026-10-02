import { prismaClient as prisma } from "@src/core/config/database";
import {
  AGENDA_ITEM_TYPE,
  AGENDA_STATUS,
  DASHBOARD_ABANDONED_ROUND_HOURS,
  DASHBOARD_MAX_KARDEX_LOOKBACK_DAYS,
  DASHBOARD_STALE_ROUND_MINUTES,
  INCIDENT_STATUS_PENDING,
  OPERATIONAL_ROLES,
  ROLE_CLIENT,
  ROUND_STATUS_IN_PROGRESS,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import { formatDurationEs } from "@src/core/utils/date-time.utils";
import { IAgendaItem } from "../shift-plans/shift-plan.dto";
import { getCurrentAgenda } from "../shift-plans/agenda.service";
import {
  ILiveAlert,
  ILiveDashboard,
  ILiveMapPoint,
  ILiveRound,
  LiveAlertSeverity,
  LiveRoundState,
} from "./dashboard.dto";

const MAX_OPEN_INCIDENT_ALERTS = 8;
const MAX_PANIC_ALERTS = 10;
const MAX_PENDING_COMPLIANCE_ITEMS = 30;

const SEVERITY_ORDER: Record<LiveAlertSeverity, number> = { critical: 0, high: 1, medium: 2 };

const fullName = (p: { name: string; lastName: string | null }): string =>
  `${p.name} ${p.lastName ?? ""}`.trim();

const minutesBetween = (from: Date, to: Date): number => Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));

const roundState = (elapsedMinutes: number, minutesSinceLastScan: number): LiveRoundState => {
  if (elapsedMinutes >= DASHBOARD_ABANDONED_ROUND_HOURS * 60) return "ABANDONED";
  if (minutesSinceLastScan >= DASHBOARD_STALE_ROUND_MINUTES) return "STALLED";
  return "ON_TRACK";
};

/**
 * @description Agrupa los uniformes vencidos por turno para emitir una sola
 * alerta por (cliente, turno, fecha) en lugar de una por guardia.
 */
const uniformAlerts = (items: IAgendaItem[]): ILiveAlert[] => {
  const groups = new Map<string, IAgendaItem[]>();
  for (const item of items) {
    const key = `${item.planId}:${item.shiftDate}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const first = group[0];
    const names = group.map((g) => (g.guard ? fullName(g.guard) : "")).filter(Boolean);
    return {
      id: `UNIFORM_OVERDUE:${key}`,
      type: "UNIFORM_OVERDUE",
      severity: "high",
      title: `Uniforme sin revisar: ${group.length} ${group.length === 1 ? "guardia" : "guardias"}`,
      detail: `${first.schedule.name} · ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` y ${names.length - 3} más` : ""}`,
      clientName: first.client.name,
      at: first.dueAt.toISOString(),
      refId: null,
    };
  });
};

/**
 * @description Foto del estado operativo AHORA: rondas en curso con su
 * avance, quién está de turno, cumplimiento de entregas/uniformes del turno
 * y qué requiere atención. La WEB lo vuelve a pedir cuando llega un evento
 * de actividad por Ably (y por polling como respaldo).
 */
export const getLiveDashboard = async (user: IAuthUser, requestedClientId?: string): Promise<ILiveDashboard> => {
  const now = new Date();
  const clientId = resolveClientScope(user, requestedClientId);
  const clientWhere = clientId ? { clientId } : {};

  const [roundsRaw, guardsOnShift, openIncidents, openIncidentsCount, panicAlerts, pendingPanic, routes, agenda] =
    await Promise.all([
      prisma.round.findMany({
        where: { status: ROUND_STATUS_IN_PROGRESS, deletedAt: null, ...clientWhere },
        select: {
          id: true,
          guardId: true,
          startTime: true,
          recurringConfigurationId: true,
          guard: { select: { id: true, name: true, lastName: true } },
          client: { select: { name: true } },
          recurringConfiguration: {
            select: { title: true, recurringLocations: { where: { deletedAt: null }, select: { locationId: true } } },
          },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.user.count({
        where: {
          active: true,
          softDelete: false,
          isLoggedIn: true,
          role: { name: { in: OPERATIONAL_ROLES } },
          ...clientWhere,
        },
      }),
      prisma.incident.findMany({
        where: { status: INCIDENT_STATUS_PENDING, deletedAt: null, ...clientWhere },
        select: {
          id: true,
          title: true,
          createdAt: true,
          client: { select: { name: true } },
          guard: { select: { name: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_OPEN_INCIDENT_ALERTS,
      }),
      prisma.incident.count({ where: { status: INCIDENT_STATUS_PENDING, deletedAt: null, ...clientWhere } }),
      prisma.panicAlert.findMany({
        where: { status: "PENDING", deletedAt: null, ...clientWhere },
        select: {
          id: true,
          message: true,
          createdAt: true,
          client: { select: { name: true } },
          guard: { select: { name: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: MAX_PANIC_ALERTS,
      }),
      prisma.panicAlert.count({ where: { status: "PENDING", deletedAt: null, ...clientWhere } }),
      prisma.recurringConfiguration.findMany({
        where: { active: true, softDelete: false, deletedAt: null, ...clientWhere },
        select: { id: true, title: true, client: { select: { name: true } } },
        orderBy: { title: "asc" },
      }),
      getCurrentAgenda(clientId, now),
    ]);

  // Escaneos de los guardias con ronda activa desde la ronda más antigua
  // (con tope) en una sola consulta; se agrupan en memoria por guardia.
  const lookbackLimit = new Date(now.getTime() - DASHBOARD_MAX_KARDEX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const earliestStart = roundsRaw.reduce<Date | null>(
    (min, r) => (!min || r.startTime < min ? r.startTime : min),
    null,
  );
  const kardexSince = earliestStart && earliestStart > lookbackLimit ? earliestStart : lookbackLimit;
  const scans = roundsRaw.length
    ? await prisma.kardex.findMany({
        where: {
          userId: { in: [...new Set(roundsRaw.map((r) => r.guardId))] },
          timestamp: { gte: kardexSince },
          deletedAt: null,
        },
        select: {
          userId: true,
          locationId: true,
          timestamp: true,
          latitude: true,
          longitude: true,
          location: { select: { name: true } },
        },
        orderBy: { timestamp: "desc" },
      })
    : [];

  const activeRounds: ILiveRound[] = roundsRaw.map((round) => {
    const routeLocationIds = new Set(round.recurringConfiguration?.recurringLocations.map((l) => l.locationId) ?? []);
    const roundScans = scans.filter(
      (s) =>
        s.userId === round.guardId &&
        s.timestamp >= round.startTime &&
        (routeLocationIds.size === 0 || routeLocationIds.has(s.locationId)),
    );
    const lastScan = roundScans[0] ?? null;
    const scannedCount = new Set(roundScans.map((s) => s.locationId)).size;
    const totalLocations = routeLocationIds.size > 0 ? routeLocationIds.size : null;
    const elapsedMinutes = minutesBetween(round.startTime, now);
    const minutesSinceLastScan = lastScan ? minutesBetween(lastScan.timestamp, now) : elapsedMinutes;

    return {
      roundId: round.id,
      guard: round.guard,
      clientName: round.client?.name ?? null,
      routeId: round.recurringConfigurationId,
      routeTitle: round.recurringConfiguration?.title ?? null,
      startTime: round.startTime.toISOString(),
      elapsedMinutes,
      totalLocations,
      scannedCount,
      progressPercent: totalLocations ? Math.min(100, Math.round((scannedCount / totalLocations) * 100)) : null,
      minutesSinceLastScan,
      lastScan: lastScan
        ? {
            locationName: lastScan.location.name,
            timestamp: lastScan.timestamp.toISOString(),
            latitude: lastScan.latitude,
            longitude: lastScan.longitude,
          }
        : null,
      state: roundState(elapsedMinutes, minutesSinceLastScan),
    };
  });

  const mapPoints: ILiveMapPoint[] = activeRounds
    .filter((r) => r.state !== "ABANDONED" && r.lastScan?.latitude != null && r.lastScan?.longitude != null)
    .map((r) => ({
      guardId: r.guard.id,
      guardName: fullName(r.guard),
      clientName: r.clientName,
      roundId: r.roundId,
      routeTitle: r.routeTitle,
      latitude: r.lastScan!.latitude as number,
      longitude: r.lastScan!.longitude as number,
      timestamp: r.lastScan!.timestamp,
      state: r.state,
    }));

  const actionable = agenda.items.filter(
    (i) => i.status === AGENDA_STATUS.OVERDUE || i.status === AGENDA_STATUS.IN_WINDOW,
  );
  const overdue = actionable.filter((i) => i.status === AGENDA_STATUS.OVERDUE);

  const alerts: ILiveAlert[] = [
    ...panicAlerts.map<ILiveAlert>((p) => ({
      id: `PANIC:${p.id}`,
      type: "PANIC",
      severity: "critical",
      title: `Alerta de pánico: ${fullName(p.guard)}`,
      detail: p.message,
      clientName: p.client?.name ?? null,
      at: p.createdAt.toISOString(),
      refId: p.id,
    })),
    ...overdue
      .filter((i) => i.type === AGENDA_ITEM_TYPE.HANDOVER)
      .map<ILiveAlert>((i) => ({
        id: `HANDOVER_OVERDUE:${i.id}`,
        type: "HANDOVER_OVERDUE",
        severity: "high",
        title: "Entrega de turno sin registrar",
        detail: `${i.schedule.name} (${i.schedule.startTime} - ${i.schedule.endTime})`,
        clientName: i.client.name,
        at: i.dueAt.toISOString(),
        refId: i.planId,
      })),
    ...uniformAlerts(overdue.filter((i) => i.type === AGENDA_ITEM_TYPE.UNIFORM)),
    ...activeRounds
      .filter((r) => r.state === "STALLED")
      .map<ILiveAlert>((r) => ({
        id: `ROUND_STALLED:${r.roundId}`,
        type: "ROUND_STALLED",
        severity: "high",
        title: `${fullName(r.guard)} sin escanear hace ${formatDurationEs(r.minutesSinceLastScan)}`,
        detail: r.routeTitle ? `Ronda: ${r.routeTitle}` : "Ronda sin ruta",
        clientName: r.clientName,
        at: r.lastScan?.timestamp ?? r.startTime,
        refId: r.roundId,
      })),
    ...activeRounds
      .filter((r) => r.state === "ABANDONED")
      .map<ILiveAlert>((r) => ({
        id: `ROUND_ABANDONED:${r.roundId}`,
        type: "ROUND_ABANDONED",
        severity: "medium",
        title: `Ronda abierta hace ${formatDurationEs(r.elapsedMinutes)} sin cerrar`,
        detail: `${fullName(r.guard)}${r.routeTitle ? ` · ${r.routeTitle}` : ""}`,
        clientName: r.clientName,
        at: r.startTime,
        refId: r.roundId,
      })),
    ...openIncidents.map<ILiveAlert>((inc) => ({
      id: `INCIDENT_OPEN:${inc.id}`,
      type: "INCIDENT_OPEN",
      severity: "medium",
      title: `Incidencia sin atender: ${inc.title}`,
      detail: `Reportó ${fullName(inc.guard)}`,
      clientName: inc.client?.name ?? null,
      at: inc.createdAt.toISOString(),
      refId: inc.id,
    })),
  ].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (b.at ?? "").localeCompare(a.at ?? ""),
  );

  // Una ruta está cubierta si alguien la recorre (y la ronda no está abandonada).
  const coveredRouteIds = new Set(
    activeRounds.filter((r) => r.state !== "ABANDONED" && r.routeId).map((r) => r.routeId as string),
  );

  return {
    generatedAt: now.toISOString(),
    scope: user.role === ROLE_CLIENT ? "CLIENT" : "ALL",
    kpis: {
      activeRounds: activeRounds.filter((r) => r.state !== "ABANDONED").length,
      stalledRounds: activeRounds.filter((r) => r.state === "STALLED").length,
      guardsOnShift,
      openIncidents: openIncidentsCount,
      pendingPanic,
      routesTotal: routes.length,
      routesCovered: routes.filter((r) => coveredRouteIds.has(r.id)).length,
      handoverCompliance: agenda.handoverSummary.compliancePercent,
      uniformCompliance: agenda.uniformSummary.compliancePercent,
    },
    alerts,
    activeRounds,
    mapPoints,
    uncoveredRoutes: routes
      .filter((r) => !coveredRouteIds.has(r.id))
      .map((r) => ({ id: r.id, title: r.title, clientName: r.client?.name ?? null })),
    compliance: {
      handover: agenda.handoverSummary,
      uniform: agenda.uniformSummary,
      pending: actionable
        .sort((a, b) => (a.status === b.status ? a.dueAt.getTime() - b.dueAt.getTime() : a.status === AGENDA_STATUS.OVERDUE ? -1 : 1))
        .slice(0, MAX_PENDING_COMPLIANCE_ITEMS),
    },
  };
};
