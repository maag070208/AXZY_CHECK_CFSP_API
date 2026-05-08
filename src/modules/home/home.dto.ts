export interface IDashboardStats {
  activeRoundsCount: number;
  activeRounds: any[]; // Using any[] here because it's Prisma included types, or I could define it better
  pendingIncidentsCount: number;
  pendingMaintenanceCount: number;
}
