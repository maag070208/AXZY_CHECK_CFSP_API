import { prismaClient } from "@src/core/config/database";
import { createAuditLog } from "../audit/audit.service";
import { logger } from "@src/core/utils/logger";

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
  lastPulledAt?: number;
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
  const { changes, userId, lastPulledAt } = params;
  const prisma = prismaClient as any;
  const lastPulledAtDate = lastPulledAt ? new Date(lastPulledAt) : new Date(Date.now() - 5000);

  for (const [table, change] of Object.entries(changes)) {
    if (!MODELS_TO_SYNC.includes(table)) continue;

    // Apply created
    for (const record of change.created) {
      if (record.media && typeof record.media === "string") {
        try {
          record.media = JSON.parse(record.media);
        } catch (e) {
          logger.warn(`Failed to parse media JSON: ${record.media}`);
        }
      }
      
      const existing = await prisma[table].findUnique({
        where: { id: record.id },
      });

      if (existing) {
        const { id, ...data } = record;
        await prisma[table].update({
          where: { id },
          data: {
            ...data,
            updatedAt: lastPulledAtDate,
          },
        });
      } else {
        await prisma[table].create({
          data: {
            ...record,
            createdAt: lastPulledAtDate,
            updatedAt: lastPulledAtDate,
          },
        });
      }
    }

    // Apply updated
    for (const record of change.updated) {
      const { id, ...data } = record;
      if (data.media && typeof data.media === "string") {
        try {
          data.media = JSON.parse(data.media);
        } catch (e) {
          logger.warn(`Failed to parse media JSON: ${data.media}`);
        }
      }
      await prisma[table].update({
        where: { id },
        data: {
          ...data,
          updatedAt: lastPulledAtDate,
        },
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
