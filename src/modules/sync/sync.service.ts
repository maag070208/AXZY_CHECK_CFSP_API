import { prismaClient } from "@src/core/config/database";

export interface SyncPullParams {
  lastPulledAt?: number;
}

export interface SyncPushParams {
  changes: {
    [key: string]: {
      created: any[];
      updated: any[];
      deleted: string[];
    };
  };
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
  const serverTimestamp = Date.now();

  const changes: any = {};

  for (const model of MODELS_TO_SYNC) {
    // @ts-ignore
    const created = await prismaClient[model].findMany({
      where: {
        createdAt: { gt: lastPulledAt },
        deletedAt: null,
      },
    });

    // @ts-ignore
    const updated = await prismaClient[model].findMany({
      where: {
        updatedAt: { gt: lastPulledAt },
        createdAt: { lte: lastPulledAt },
        deletedAt: null,
      },
    });

    // @ts-ignore
    const deletedRecords = await prismaClient[model].findMany({
      where: {
        deletedAt: { gt: lastPulledAt },
      },
      select: { id: true },
    });

    changes[model] = {
      created,
      updated,
      deleted: deletedRecords.map((r: any) => r.id),
    };
  }

  return {
    changes,
    timestamp: serverTimestamp,
  };
};

export const pushChanges = async (params: SyncPushParams) => {
  const { changes } = params;

  for (const [table, change] of Object.entries(changes)) {
    if (!MODELS_TO_SYNC.includes(table)) continue;

    // Apply created
    for (const record of change.created) {
      // @ts-ignore
      await prismaClient[table].create({
        data: record,
      });
    }

    // Apply updated
    for (const record of change.updated) {
      const { id, ...data } = record;
      // @ts-ignore
      await prismaClient[table].update({
        where: { id },
        data,
      });
    }

    // Apply deleted (Soft delete)
    if (change.deleted.length > 0) {
      // @ts-ignore
      await prismaClient[table].updateMany({
        where: {
          id: { in: change.deleted },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    }
  }

  return { success: true };
};
