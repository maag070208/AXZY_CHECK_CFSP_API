/**
 * DTOs para el módulo de Alertas de Pánico.
 * Una PanicAlert es una entidad propia (NO un Incident) para que el
 * equipo de seguridad/admin le dé seguimiento con su propio ciclo de vida.
 */

export type PanicAlertStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED" | "DISMISSED";

export interface IPanicAlertGuardSummary {
  id: string;
  name: string;
  lastName: string | null;
  username: string;
}

export interface IPanicAlertClientSummary {
  id: string;
  name: string;
}

export interface IPanicAlertResolverSummary {
  id: string;
  name: string;
  lastName: string | null;
}

export interface IPanicAlert {
  id: string;
  guardId: string;
  guard: IPanicAlertGuardSummary;
  clientId: string | null;
  client: IPanicAlertClientSummary | null;
  source: string;
  triggerLatitude: number | null;
  triggerLongitude: number | null;
  triggerAccuracy: number | null;
  message: string | null;
  status: PanicAlertStatus;
  resolutionComment: string | null;
  resolvedById: string | null;
  resolvedBy: IPanicAlertResolverSummary | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface IPanicAlertCreate {
  guardId: string;
  clientId?: string | null;
  source?: string;
  triggerLatitude?: number;
  triggerLongitude?: number;
  triggerAccuracy?: number;
  message?: string;
}

export interface IPanicAlertResolve {
  resolutionComment?: string;
  status?: PanicAlertStatus;
}

export interface IPaginatedPanicAlerts {
  rows: IPanicAlert[];
  total: number;
}
