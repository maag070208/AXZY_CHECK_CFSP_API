import { prismaClient } from "@src/core/config/database";
import { createAuditLog } from "../audit/audit.service";

export interface SyncPullParams {
  lastPulledAt?: number;
  resetModels?: string[];
}

export interface SyncPushParams {
  changes: {
    [key: string]: {
      created: any[];
      updated: any[];
      deleted: string[];
    };
  };
  userId: string;
}

const MODELS_TO_SYNC = [
  "role",
  "client",
  "zone",
  "user",
  "schedule",
  "location",
  "locationTask",
  "kardex",
  "assignment",
  "assignmentTask",
  "incidentCategory",
  "incidentType",
  "incident",
  "round",
  "maintenance",
  "recurringConfiguration",
  "recurringLocation",
  "recurringTask",
];

export const pullChanges = async (params: SyncPullParams) => {
  const lastPulledAt = params.lastPulledAt ? new Date(params.lastPulledAt) : new Date(0);
  const resetModels = params.resetModels || [];
  const serverTimestamp = Date.now();

  const changes: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {};
  const prisma = prismaClient as any;

  await Promise.all(
    MODELS_TO_SYNC.map(async (model) => {
      const modelLastPulledAt = resetModels.includes(model) ? new Date(0) : lastPulledAt;
      const [created, updated, deletedRecords] = await Promise.all([
        prisma[model].findMany({
          where: {
            createdAt: { gt: modelLastPulledAt },
            deletedAt: null,
          },
        }),
        prisma[model].findMany({
          where: {
            updatedAt: { gt: modelLastPulledAt },
            createdAt: { lte: modelLastPulledAt },
            deletedAt: null,
          },
        }),
        prisma[model].findMany({
          where: {
            deletedAt: { gt: modelLastPulledAt },
          },
          select: { id: true },
        }),
      ]);

      changes[model] = {
        created,
        updated,
        deleted: deletedRecords.map((r: { id: string }) => r.id),
      };
    })
  );

  return {
    changes,
    timestamp: serverTimestamp,
  };
};

export const pushChanges = async (params: SyncPushParams) => {
  const { changes, userId } = params;
  const prisma = prismaClient as any;

  for (const [table, change] of Object.entries(changes)) {
    if (!MODELS_TO_SYNC.includes(table)) continue;

    // Apply created
    for (const record of change.created) {
      await prisma[table].create({
        data: record,
      });
    }

    // Apply updated
    for (const record of change.updated) {
      const { id, ...data } = record;
      await prisma[table].update({
        where: { id },
        data,
      });
    }

    // Apply deleted (Soft delete)
    if (change.deleted.length > 0) {
      await prisma[table].updateMany({
        where: {
          id: { in: change.deleted },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }
  }

  // Registrar auditoría del lote completo
  await createAuditLog({
    userId,
    module: "SYNC",
    action: "PUSH",
    details: {
      tablesModified: Object.keys(changes),
      summary: Object.entries(changes).reduce((acc, [table, change]) => {
        acc[table] = {
          createdCount: change.created?.length || 0,
          updatedCount: change.updated?.length || 0,
          deletedCount: change.deleted?.length || 0,
        };
        return acc;
      }, {} as Record<string, { createdCount: number; updatedCount: number; deletedCount: number }>)
    }
  });

  return { success: true };
};

export const hasChangesSince = async (params: SyncPullParams): Promise<boolean> => {
  const lastPulledAt = params.lastPulledAt ? new Date(params.lastPulledAt) : new Date(0);
  const prisma = prismaClient as any;

  const results = await Promise.all(
    MODELS_TO_SYNC.map(async (model) => {
      const createdCount = await prisma[model].count({
        where: {
          createdAt: { gt: lastPulledAt },
          deletedAt: null,
        },
      });
      if (createdCount > 0) return true;

      const updatedCount = await prisma[model].count({
        where: {
          updatedAt: { gt: lastPulledAt },
          createdAt: { lte: lastPulledAt },
          deletedAt: null,
        },
      });
      if (updatedCount > 0) return true;

      const deletedCount = await prisma[model].count({
        where: {
          deletedAt: { gt: lastPulledAt },
        },
      });
      return deletedCount > 0;
    })
  );

  return results.some((r) => r === true);
};
