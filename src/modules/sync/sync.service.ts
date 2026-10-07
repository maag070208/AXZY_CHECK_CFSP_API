import { prismaClient } from "@src/core/config/database";

/** Tipo real del cliente de transacción (cliente Prisma extendido). */
type TExtendedTx = Parameters<Parameters<typeof prismaClient.$transaction>[0]>[0];

/**
 * Vista "laxa" del cliente para el acceso **dinámico** por nombre de modelo
 * (`prisma[model]`). La sincronización itera modelos por su nombre en runtime,
 * así que el cliente no se puede indexar con un tipo concreto.
 */
interface IDynamicDelegate {
  findMany: (args?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
  findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  count: (args?: Record<string, unknown>) => Promise<number>;
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  update: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  delete: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
}
type TDynamicPrisma = Record<string, IDynamicDelegate>;
import { ZodError, ZodTypeAny } from "zod";
import {
  OPERATIONAL_ROLES,
  SHIFT_HANDOVER_CHECKLIST,
  SUPERVISION_ROLES,
  UNIFORM_CHECKLIST,
  UNIFORM_MIN_COMPLIANT_SCORE,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { AppError } from "@src/core/errors/AppError";
import { logger } from "@src/core/utils/logger";
import { createAuditLog } from "../audit/audit.service";
import { createShiftHandoverSchema } from "../shift-handovers/schemas/shift-handover.schema";
import { prepareShiftHandover, writeShiftHandover } from "../shift-handovers/shift-handover.service";
import { createUniformCheckSchema } from "../uniform-checks/schemas/uniform-check.schema";
import { prepareUniformCheck } from "../uniform-checks/uniform-check.service";

export interface SyncPullParams {
  lastPulledAt?: number;
  resetModels?: string[];
  user?: IAuthUser;
}

type SyncRecord = Record<string, unknown> & { id: string };

export interface SyncPushParams {
  changes: {
    [key: string]: {
      created: SyncRecord[];
      updated: SyncRecord[];
      deleted: string[];
    };
  };
  user: IAuthUser;
  lastPulledAt?: number;
}

/** Modelos que el dispositivo descarga (WatermelonDB pull). */
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
  "shiftHandover",
  "uniformCheck",
];

/** Relaciones que viajan embebidas en el registro (la APP las guarda como JSON). */
const PULL_INCLUDE: Record<string, Record<string, unknown>> = {
  shiftHandover: {
    elements: { select: { guardId: true, entryTime: true, punctual: true, observations: true } },
  },
};

/** Modelos con baja lógica por `softDelete` (la extensión de Prisma los oculta en lecturas). */
const SOFT_DELETE_MODELS = new Set(["client", "zone", "user", "location", "recurringConfiguration"]);

/** Campos que nunca deben salir del servidor. */
const SENSITIVE_FIELDS: Record<string, string[]> = {
  user: ["password", "fcmToken"],
};

/**
 * Lo único que un dispositivo puede crear/modificar al sincronizar: lo que
 * la APP escribe offline. Cualquier otra tabla se ignora (el dispositivo no
 * administra catálogos, usuarios ni clientes).
 * - `ownerField`: debe ser el propio usuario cuando quien sincroniza es
 *   personal operativo (un guardia no puede crear registros a nombre de otro).
 * - `fields`: lista blanca; lo demás que mande el dispositivo se descarta.
 * - `createDefaults`: valores que el dispositivo no puede decidir al crear.
 */
const PUSHABLE_MODELS: Record<
  string,
  { ownerField: string; fields: string[]; createDefaults?: Record<string, unknown> }
> = {
  round: {
    ownerField: "guardId",
    fields: ["guardId", "clientId", "startTime", "endTime", "status", "recurringConfigurationId"],
  },
  kardex: {
    ownerField: "userId",
    fields: ["userId", "locationId", "timestamp", "notes", "media", "latitude", "longitude", "assignmentId", "scanType"],
  },
  incident: {
    ownerField: "guardId",
    fields: ["guardId", "title", "categoryId", "typeId", "description", "media", "latitude", "longitude", "clientId"],
    createDefaults: { status: "PENDING" },
  },
  maintenance: {
    ownerField: "guardId",
    fields: ["guardId", "title", "categoryId", "typeId", "description", "media", "latitude", "longitude", "clientId"],
    createDefaults: { status: "PENDING" },
  },
};


/** Parsea a objeto un campo que WatermelonDB guarda como texto JSON. */
const parseJsonField = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/** Valida con el mismo esquema Zod del endpoint web; errores → 400 legible. */
const validateBody = <T>(schema: ZodTypeAny, body: unknown, label: string): T => {
  try {
    return schema.parse(body) as T;
  } catch (e) {
    if (e instanceof ZodError) {
      const detail = e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new AppError(`${label} capturada offline no es válida: ${detail}`, 400);
    }
    throw e;
  }
};

type CustomPush = (
  tx: TExtendedTx,
  record: SyncRecord,
  user: IAuthUser,
  now: Date,
) => Promise<void>;

/**
 * Registros que la APP captura offline y que llevan lógica de negocio
 * (validaciones, puntualidad, puntaje): se aplican con las mismas funciones
 * del endpoint web. Solo los registra supervisión; no se editan después.
 */
const CUSTOM_PUSH: Record<string, CustomPush> = {
  shiftHandover: async (tx, record, user, now) => {
    if (await tx.shiftHandover.findUnique({ where: { id: record.id }, select: { id: true } })) return;
    const body = validateBody<Parameters<typeof prepareShiftHandover>[0]>(
      createShiftHandoverSchema.shape.body,
      {
        clientId: record.clientId,
        scheduleId: record.scheduleId,
        shiftDate: typeof record.shiftDate === "string" ? record.shiftDate.slice(0, 10) : record.shiftDate,
        credentialsCount: record.credentialsCount ?? null,
        tarjetonesCount: record.tarjetonesCount ?? null,
        novedades: record.novedades ?? null,
        checklist: parseJsonField(record.checklist) ?? [],
        reportedToAdmin: !!record.reportedToAdmin,
        elements: parseJsonField(record.elements) ?? [],
      },
      "La entrega de turno",
    );
    const prepared = await prepareShiftHandover(body);
    await writeShiftHandover(tx, prepared, {
      id: record.id,
      createdById: user.id,
      createdAt: deviceCreatedAt(record.createdAt, now),
    });
  },
  uniformCheck: async (tx, record, user, now) => {
    if (await tx.uniformCheck.findUnique({ where: { id: record.id }, select: { id: true } })) return;
    const body = validateBody<Parameters<typeof prepareUniformCheck>[0]>(
      createUniformCheckSchema.shape.body,
      {
        guardId: record.guardId,
        shiftDate: typeof record.shiftDate === "string" ? record.shiftDate.slice(0, 10) : undefined,
        items: parseJsonField(record.items) ?? [],
        notes: record.notes ?? null,
      },
      "La revisión de uniforme",
    );
    const prepared = await prepareUniformCheck(body, user.id);
    await tx.uniformCheck.create({
      data: { ...prepared.data, id: record.id, createdAt: deviceCreatedAt(record.createdAt, now) },
    });
  },
};

/** Orden de aplicación (padres antes que hijos). */
const PUSH_ORDER = ["round", "kardex", "incident", "maintenance", "shiftHandover", "uniformCheck"];

/** Margen tolerado para relojes de dispositivo adelantados. */
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * @description Filtro por cliente para lo que descarga un usuario con
 * cliente asignado (guardia, mantenimiento, jefe de turno de un cliente).
 * Usuarios sin cliente (administración) reciben todo. Los catálogos
 * globales (roles, horarios, categorías) no se filtran.
 */
const clientScope = (model: string, clientId: string | null | undefined): Record<string, unknown> => {
  if (!clientId) return {};
  switch (model) {
    case "client":
      return { id: clientId };
    case "zone":
    case "location":
    case "round":
    case "incident":
    case "maintenance":
    case "recurringConfiguration":
    case "shiftHandover":
    case "uniformCheck":
      return { clientId };
    case "user":
      return { clientId };
    case "locationTask":
    case "kardex":
    case "assignment":
      return { location: { clientId } };
    case "assignmentTask":
      return { assignment: { location: { clientId } } };
    case "recurringLocation":
      return { recurringConfiguration: { clientId } };
    case "recurringTask":
      return { recurringLocation: { recurringConfiguration: { clientId } } };
    default:
      return {};
  }
};

const sanitize = (model: string, rows: Record<string, unknown>[]) => {
  const hidden = SENSITIVE_FIELDS[model];
  if (!hidden) return rows;
  return rows.map((row) => {
    const copy = { ...row };
    for (const field of hidden) delete copy[field];
    return copy;
  });
};

/**
 * @description IDs dados de baja desde `since`. Para modelos con
 * `softDelete` la extensión de Prisma oculta los eliminados, así que se
 * piden explícitamente (`softDelete: true`) además de los que solo tienen
 * `deletedAt`.
 */
const findDeletedIds = async (model: string, since: Date, scope: Record<string, unknown>): Promise<string[]> => {
  const prisma = prismaClient as unknown as TDynamicPrisma;
  const where = { ...scope, deletedAt: { gt: since } };
  const rows = SOFT_DELETE_MODELS.has(model)
    ? [
        ...(await prisma[model].findMany({ where: { ...where, softDelete: true }, select: { id: true } })),
        ...(await prisma[model].findMany({ where: { ...where, softDelete: false }, select: { id: true } })),
      ]
    : await prisma[model].findMany({ where, select: { id: true } });
  return [...new Set(rows.map((r) => String(r.id)))];
};

export const pullChanges = async (params: SyncPullParams) => {
  const lastPulledAt = params.lastPulledAt ? new Date(params.lastPulledAt) : new Date(0);
  const resetModels = params.resetModels || [];
  // Se toma ANTES de consultar: lo que cambie durante la consulta vuelve a
  // llegar en el siguiente pull en lugar de perderse.
  const serverTimestamp = Date.now();
  const clientId = params.user?.clientId;

  const changes: Record<string, { created: unknown[]; updated: unknown[]; deleted: string[] }> = {};
  const prisma = prismaClient as unknown as TDynamicPrisma;

  await Promise.all(
    MODELS_TO_SYNC.map(async (model) => {
      const since = resetModels.includes(model) ? new Date(0) : lastPulledAt;
      const scope = clientScope(model, clientId);
      const [created, updated, deleted] = await Promise.all([
        prisma[model].findMany({
          where: { ...scope, createdAt: { gt: since }, deletedAt: null },
          include: PULL_INCLUDE[model],
        }),
        prisma[model].findMany({
          where: { ...scope, updatedAt: { gt: since }, createdAt: { lte: since }, deletedAt: null },
          include: PULL_INCLUDE[model],
        }),
        findDeletedIds(model, since, scope),
      ]);

      changes[model] = {
        created: sanitize(model, created),
        updated: sanitize(model, updated),
        deleted,
      };
    }),
  );

  return {
    changes,
    timestamp: serverTimestamp,
    // Catálogos que los formularios offline necesitan (la APP los cachea).
    catalogs: {
      shiftHandover: SHIFT_HANDOVER_CHECKLIST,
      uniform: { items: UNIFORM_CHECKLIST, minCompliantScore: UNIFORM_MIN_COMPLIANT_SCORE },
    },
  };
};

/** @description Fecha de creación del dispositivo, acotada a "ahora" si viene adelantada o inválida. */
const deviceCreatedAt = (value: unknown, now: Date): Date => {
  const parsed = typeof value === "string" || typeof value === "number" ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return now;
  return parsed.getTime() > now.getTime() + MAX_CLOCK_SKEW_MS ? now : parsed;
};

const pickFields = (record: SyncRecord, fields: string[]): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field in record)) continue;
    let value = record[field];
    // WatermelonDB guarda `media` como texto JSON.
    if (field === "media" && typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        logger.warn(`[sync] media no es JSON válido; se descarta`);
        value = [];
      }
    }
    data[field] = value;
  }
  return data;
};

/**
 * @description Aplica en una sola transacción lo que el dispositivo creó o
 * modificó offline. Solo acepta las tablas de `PUSHABLE_MODELS`, con sus
 * campos permitidos y a nombre del propio usuario si es personal operativo.
 * - Conserva la fecha real de creación del dispositivo (`createdAt`).
 * - `updatedAt` lo pone el servidor (ahora), así otros dispositivos lo
 *   reciben en su siguiente pull sin importar cuándo sincronizaron.
 * - Un "updated" de algo que el servidor no tiene se crea (semántica de
 *   WatermelonDB) en lugar de abortar toda la sincronización.
 * - Reenviar el mismo lote es idempotente (upsert por id).
 */
export const pushChanges = async (params: SyncPushParams) => {
  const { changes, user } = params;
  const isOperational = OPERATIONAL_ROLES.includes(user.role);
  const now = new Date();

  const ignored = Object.keys(changes).filter((table) => !PUSHABLE_MODELS[table] && !CUSTOM_PUSH[table]);
  if (ignored.length > 0) {
    logger.warn(`[sync] Tablas no permitidas ignoradas en push de ${user.id}: ${ignored.join(", ")}`);
  }

  const summary: Record<string, { created: number; updated: number; deleted: number }> = {};

  await prismaClient.$transaction(
    async (tx) => {
      const db = tx as unknown as TDynamicPrisma;
      for (const table of PUSH_ORDER) {
        const change = changes[table];
        if (!change) continue;

        const custom = CUSTOM_PUSH[table];
        if (custom) {
          const records = [...(change.created ?? []), ...(change.updated ?? [])];
          if (records.length > 0 && !SUPERVISION_ROLES.includes(user.role)) {
            throw new AppError(`Tu rol no puede registrar ${table}`, 403);
          }
          for (const record of records) await custom(tx, record, user, now);
          summary[table] = { created: records.length, updated: 0, deleted: 0 };
          continue;
        }

        const { ownerField, fields, createDefaults = {} } = PUSHABLE_MODELS[table];
        const assertOwner = (record: SyncRecord, existingOwner?: unknown) => {
          if (!isOperational) return;
          const owner = existingOwner ?? record[ownerField];
          if (owner !== user.id) {
            throw new AppError(`No puedes sincronizar registros de otro usuario (${table})`, 403);
          }
        };

        for (const record of change.created ?? []) {
          const existing = await db[table].findUnique({ where: { id: record.id }, select: { [ownerField]: true } });
          assertOwner(record, existing?.[ownerField]);
          const data = pickFields(record, fields);
          if (existing) {
            await db[table].update({ where: { id: record.id }, data });
          } else {
            await db[table].create({
              data: { ...data, ...createDefaults, id: record.id, createdAt: deviceCreatedAt(record.createdAt, now) },
            });
          }
        }

        for (const record of change.updated ?? []) {
          const existing = await db[table].findUnique({ where: { id: record.id }, select: { [ownerField]: true } });
          assertOwner(record, existing?.[ownerField]);
          const data = pickFields(record, fields);
          if (existing) {
            await db[table].update({ where: { id: record.id }, data });
          } else {
            await db[table].create({
              data: { ...data, ...createDefaults, id: record.id, createdAt: deviceCreatedAt(record.createdAt, now) },
            });
          }
        }

        const deleted = change.deleted ?? [];
        if (deleted.length > 0) {
          if (isOperational) {
            const owned = await db[table].count({ where: { id: { in: deleted }, [ownerField]: user.id } });
            if (owned !== deleted.length) {
              throw new AppError(`No puedes eliminar registros de otro usuario (${table})`, 403);
            }
          }
          await db[table].updateMany({ where: { id: { in: deleted } }, data: { deletedAt: now } });
        }

        summary[table] = {
          created: change.created?.length ?? 0,
          updated: change.updated?.length ?? 0,
          deleted: deleted.length,
        };
      }
    },
    { timeout: 30000 },
  );

  await createAuditLog({
    userId: user.id,
    module: "SYNC",
    action: "PUSH",
    details: { tablesModified: Object.keys(summary), ignoredTables: ignored, summary },
  });

  return { success: true };
};

export const hasChangesSince = async (params: SyncPullParams): Promise<boolean> => {
  const lastPulledAt = params.lastPulledAt ? new Date(params.lastPulledAt) : new Date(0);
  const prisma = prismaClient as unknown as TDynamicPrisma;
  const clientId = params.user?.clientId;

  const results = await Promise.all(
    MODELS_TO_SYNC.map(async (model) => {
      const scope = clientScope(model, clientId);
      const changed = await prisma[model].count({
        where: { ...scope, OR: [{ createdAt: { gt: lastPulledAt } }, { updatedAt: { gt: lastPulledAt } }], deletedAt: null },
      });
      if (changed > 0) return true;
      return (await findDeletedIds(model, lastPulledAt, scope)).length > 0;
    }),
  );

  return results.some(Boolean);
};
