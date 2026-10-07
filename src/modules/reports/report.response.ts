/** Formas de respuesta de los reportes de guardias (analytics). */

export interface IGuardGeneralStats {
  totalIncidents: number;
  totalScans: number;
  incompleteRounds: number;
  missedScans: number;
}

export interface IGuardPerformanceRow {
  guardId: string;
  name: string;
  lastName: string | null;
  totalScans: number;
}

export interface IWorkloadRow {
  guardId: string;
  name: string;
  lastName: string | null;
  role: string;
  workload: number;
  details: { scans: number; reports: number; rounds: number };
}

export interface IGuardDetailedRow {
  guardId: string;
  name: string;
  lastName: string | null;
  role: string;
  totalRounds: number;
  totalScans: number;
  incompleteRounds: number;
  missedScans: number;
  avgRoundTimeMinutes: number;
}

export interface IMissedPoint {
  roundId: string;
  startTime: Date;
  locationId: string;
  locationName: string;
  aisle: string | null;
}

export interface IIncompleteRound {
  roundId: string;
  startTime: Date;
  endTime: Date | null;
  missedCount: number;
  totalLocations: number;
}

export interface IGuardBreakdown {
  missedPoints: IMissedPoint[];
  incompleteRounds: IIncompleteRound[];
}
