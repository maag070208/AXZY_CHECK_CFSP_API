import { Prisma } from "@prisma/client";

/** Ronda activa incluida en el dashboard (guardia y cliente reducidos). */
export type TActiveRound = Prisma.RoundGetPayload<{
  include: {
    guard: { select: { name: true; lastName: true } };
    client: { select: { name: true } };
  };
}>;

export interface IDashboardStats {
  activeRoundsCount: number;
  activeRounds: TActiveRound[];
  pendingIncidentsCount: number;
  pendingMaintenanceCount: number;
}
