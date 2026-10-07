import { AttendanceStatus } from "@src/core/config/constants";
import { IAgendaItem, IAgendaSummary } from "../shift-plans/shift-plan.dto";

/**
 * DTOs para el dashboard administrativo / cliente.
 * Todos los endpoints filtran por clientId cuando el usuario es RESDN.
 */

export interface IActiveGuard {
  id: string;
  name: string;
  lastName: string;
  username: string;
  role: 'GUARD' | 'SHIFT' | 'MAINT';
  clientId: string | null;
  clientName: string | null;
  isLoggedIn: boolean;
  currentRoundId: string | null;
  currentRoundStartTime: string | null;
  currentLocationName: string | null;
  lastKardexAt: string | null;
  lastKardexLocation: string | null;
}

export interface IPendingCounts {
  incidents: number;
  maintenances: number;
  disciplines: number;
  activeRounds: number;
  panicAlerts: number;
}

export interface IActivityItem {
  id: string;
  type: 'incident' | 'maintenance' | 'discipline' | 'panic' | 'round' | 'kardex';
  title: string;
  description?: string;
  guardId?: string;
  guardName?: string;
  clientId?: string | null;
  clientName?: string | null;
  status?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
}

export interface IPanicAlertListItem {
  id: string;
  title: string;
  description: string | null;
  resolutionComment?: string | null;
  guardId: string;
  guardName: string;
  clientId: string | null;
  clientName: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  resolvedById?: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface IRoleBreakdown {
  guards: number;
  shift: number;
  maintenance: number;
}

export interface IActiveBreakdown {
  total: number;
  guards: number;
  shift: number;
  maintenance: number;
}

export interface IDashboardOverview {
  totalGuards: number;
  activeGuardsNow: number;
  totalBreakdown: IRoleBreakdown;
  activeBreakdown: IActiveBreakdown;
  totalClients: number;
  totalLocations: number;
  totalAssignments: number;
  pendingCounts: IPendingCounts;
  generatedAt: string;
  scope: 'ALL' | 'CLIENT';
}

// ── Dashboard en vivo (`GET /dashboard/live`) ──

export type LiveAlertType =
  | 'PANIC'
  | 'ROUND_STALLED'
  | 'ROUND_ABANDONED'
  | 'HANDOVER_OVERDUE'
  | 'UNIFORM_OVERDUE'
  | 'INCIDENT_OPEN';

export type LiveAlertSeverity = 'critical' | 'high' | 'medium';

export interface ILiveAlert {
  id: string;
  type: LiveAlertType;
  severity: LiveAlertSeverity;
  title: string;
  detail: string | null;
  clientName: string | null;
  /** Momento que originó la alerta (para "hace X"). */
  at: string | null;
  /** Registro relacionado (ronda, incidencia, alerta de pánico...). */
  refId: string | null;
}

export type LiveRoundState = 'ON_TRACK' | 'STALLED' | 'ABANDONED';

export interface ILiveRoundLastScan {
  locationName: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ILiveRound {
  roundId: string;
  guard: { id: string; name: string; lastName: string | null };
  clientName: string | null;
  routeId: string | null;
  routeTitle: string | null;
  startTime: string;
  elapsedMinutes: number;
  totalLocations: number | null;
  scannedCount: number;
  progressPercent: number | null;
  minutesSinceLastScan: number;
  lastScan: ILiveRoundLastScan | null;
  state: LiveRoundState;
}

export interface ILiveMapPoint {
  guardId: string;
  guardName: string;
  clientName: string | null;
  roundId: string;
  routeTitle: string | null;
  latitude: number;
  longitude: number;
  timestamp: string;
  state: LiveRoundState;
}

export interface ILiveUncoveredRoute {
  id: string;
  title: string;
  clientName: string | null;
}

export interface ILiveDashboard {
  generatedAt: string;
  scope: 'ALL' | 'CLIENT';
  kpis: {
    activeRounds: number;
    stalledRounds: number;
    guardsOnShift: number;
    openIncidents: number;
    pendingPanic: number;
    routesTotal: number;
    routesCovered: number;
    handoverCompliance: number | null;
    uniformCompliance: number | null;
  };
  alerts: ILiveAlert[];
  activeRounds: ILiveRound[];
  mapPoints: ILiveMapPoint[];
  uncoveredRoutes: ILiveUncoveredRoute[];
  compliance: {
    handover: IAgendaSummary;
    uniform: IAgendaSummary;
    /** Compromisos accionables ahora (en ventana o vencidos). */
    pending: IAgendaItem[];
  };
}

// ── Asistencia del día (`GET /dashboard/attendance`) ──

export interface IAttendanceItem {
  guardId: string;
  name: string;
  lastName: string | null;
  role: 'GUARD' | 'SHIFT' | 'MAINT';
  clientId: string | null;
  clientName: string | null;
  scheduleId: string | null;
  scheduleName: string | null;
  /** Inicio programado del turno (ISO). */
  scheduledStart: string;
  /** Primera entrada registrada del día (ISO), o null. */
  checkInAt: string | null;
  status: AttendanceStatus;
  /** Minutos de retardo (positivo = tarde). `null` si aún no entra o falta. */
  minutesLate: number | null;
}

export interface IAttendanceTotals {
  expected: number;
  onTime: number;
  late: number;
  absent: number;
  pending: number;
}

export interface IAttendanceReport {
  generatedAt: string;
  /** Fecha de inicio del turno evaluada (YYYY-MM-DD). */
  shiftDate: string;
  scope: 'ALL' | 'CLIENT';
  totals: IAttendanceTotals;
  items: IAttendanceItem[];
}
