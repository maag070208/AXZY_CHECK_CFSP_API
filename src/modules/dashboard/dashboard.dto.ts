/**
 * DTOs para el dashboard administrativo / cliente.
 * Todos los endpoints filtran por clientId cuando el usuario es RESDN.
 */

export interface IActiveGuard {
  id: string;
  name: string;
  lastName: string;
  username: string;
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

export interface IDashboardOverview {
  totalGuards: number;
  activeGuardsNow: number;
  totalClients: number;
  totalLocations: number;
  totalAssignments: number;
  pendingCounts: IPendingCounts;
  generatedAt: string;
  scope: 'ALL' | 'CLIENT';
}
