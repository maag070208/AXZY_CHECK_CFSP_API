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
import { getErrorMessage } from "@src/core/utils/error.utils";
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
const CUSTOM_PUSH: Record<string, CustomPush | undefined> = {
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

/** Registro que el servidor NO aceptó, con el motivo exacto (para poder descartarlo o corregirlo). */
export interface IPushRejection {
  table: string;
  id: string;
  action: "create" | "update" | "delete";
  reason: string;
}

export interface ISyncPushResult {
  /** `false` ⇒ no se aplicó NADA y el cliente debe reintentar. */
  applied: boolean;
  summary: Record<string, { created: number; updated: number; deleted: number }>;
  /** Tablas que el dispositivo no debe empujar (antes se descartaban en silencio). */
  ignoredTables: string[];
  rejected: IPushRejection[];
}

/** Campos obligatorios (no-FK) que sólo se exigen cuando el registro se va a CREAR. */
const REQUIRED_ON_CREATE: Record<string, string[]> = {
  incident: ["title"],
  maintenance: ["title"],
};

/** Integridad referencial y campos obligatorios por tabla. */
const FK_RULES: Record<string, Array<{ field: string; model: string; label: string; required?: boolean }>> = {
  round: [
    { field: "guardId", model: "user", label: "guardia", required: true },
    { field: "clientId", model: "client", label: "cliente" },
    { field: "recurringConfigurationId", model: "recurringConfiguration", label: "ronda recurrente" },
  ],
  kardex: [
    { field: "userId", model: "user", label: "usuario", required: true },
    { field: "locationId", model: "location", label: "punto de control", required: true },
    { field: "assignmentId", model: "assignment", label: "asignación" },
  ],
  incident: [
    { field: "guardId", model: "user", label: "guardia", required: true },
    { field: "categoryId", model: "incidentCategory", label: "categoría" },
    { field: "typeId", model: "incidentType", label: "tipo" },
    { field: "clientId", model: "client", label: "cliente" },
  ],
  maintenance: [
    { field: "guardId", model: "user", label: "guardia", required: true },
    { field: "categoryId", model: "incidentCategory", label: "categoría" },
    { field: "typeId", model: "incidentType", label: "tipo" },
    { field: "clientId", model: "client", label: "cliente" },
  ],
  shiftHandover: [
    { field: "clientId", model: "client", label: "cliente", required: true },
    { field: "scheduleId", model: "schedule", label: "horario", required: true },
  ],
  uniformCheck: [
    { field: "guardId", model: "user", label: "guardia", required: true },
  ],
};

/** Nombres legibles para los mensajes de rechazo. */
const TABLE_LABELS: Record<string, string> = {
  round: "la ronda",
  kardex: "el registro de bitácora",
  incident: "la incidencia",
  maintenance: "el mantenimiento",
  shiftHandover: "la entrega de turno",
  uniformCheck: "la revisión de uniforme",
};

/**
 * Cómo se elimina cada tabla al sincronizar, replicando EXACTAMENTE lo que hace
 * el endpoint online del módulo.
 *
 * Es crítico: la extensión de Prisma sólo oculta automáticamente los modelos
 * `Client/Zone/User/Location/RecurringConfiguration`, y los servicios de
 * kardex/incident/maintenance NO filtran `deletedAt`. Si aquí se hiciera baja
 * lógica, el registro borrado offline seguiría apareciendo en los listados.
 */
const DELETE_STRATEGY: Record<string, "soft" | "hard"> = {
  round: "soft",
  kardex: "soft",
  incident: "soft",
  maintenance: "soft",
};

/**
 * Verifica que las referencias del registro existan y que sus campos
 * obligatorios estén presentes. Devuelve el motivo del rechazo o `null`.
 * Se ejecuta ANTES de escribir: así un registro inválido no deja la
 * transacción en estado abortado (Postgres no permite continuar tras un error).
 */
const findRecordProblem = async (
  table: string,
  record: SyncRecord,
  db: TDynamicPrisma,
  willCreate: boolean,
): Promise<string | null> => {
  for (const rule of FK_RULES[table] ?? []) {
    const value = record[rule.field];
    if (value === undefined || value === null || value === "") {
      if (rule.required) return `Falta ${rule.field} (${rule.label})`;
      continue;
    }
    if (typeof value !== "string") return `${rule.field} debe ser un id válido`;
    const found = await db[rule.model].findUnique({ where: { id: value }, select: { id: true } });
    if (!found) return `El ${rule.label} indicado en ${rule.field} no existe en el servidor`;
  }

  if (willCreate) {
    for (const field of REQUIRED_ON_CREATE[table] ?? []) {
      const value = record[field];
      if (value === undefined || value === null || value === "") return `Falta el campo obligatorio ${field}`;
    }
  }

  return null;
};

/** Valida la forma de un registro de tabla "custom" con el mismo Zod del endpoint web. */
const validateCustomShape = (table: string, record: SyncRecord): string | null => {
  try {
    if (table === "shiftHandover") {
      validateBody<Parameters<typeof prepareShiftHandover>[0]>(
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
    } else if (table === "uniformCheck") {
      validateBody<Parameters<typeof prepareUniformCheck>[0]>(
        createUniformCheckSchema.shape.body,
        {
          guardId: record.guardId,
          shiftDate: typeof record.shiftDate === "string" ? record.shiftDate.slice(0, 10) : undefined,
          items: parseJsonField(record.items) ?? [],
          notes: record.notes ?? null,
        },
        "La revisión de uniforme",
      );
    }
    return null;
  } catch (e) {
    return getErrorMessage(e);
  }
};

/**
 * @description Aplica lo que el dispositivo creó o modificó offline.
 *
 * Garantías del contrato (cola offline):
 * - **Atómico**: o se aplica el lote completo o nada. Nunca se escribe a medias.
 * - **Idempotente**: reenviar el mismo lote no duplica (upsert por id).
 * - **Diagnosticable**: si algo no se puede aplicar, se devuelve el detalle por
 *   registro (`rejected` con tabla/id/acción/motivo) para que la APP pueda
 *   corregirlo o descartarlo, en lugar de bloquear la cola con un error opaco.
 * - **Sin descartes silenciosos**: las tablas que el dispositivo no administra
 *   se reportan (`ignoredTables`) y tampoco se aplican.
 * - Conserva la fecha real de creación del dispositivo (`createdAt`).
 * - `updatedAt` lo pone el servidor, así otros dispositivos lo reciben en su
 *   siguiente pull sin importar cuándo sincronizaron.
 * - Un "updated" de algo que el servidor no tiene se crea (semántica de
 *   WatermelonDB) en lugar de romper la sincronización.
 */
export const pushChanges = async (params: SyncPushParams): Promise<ISyncPushResult> => {
  const { changes, user } = params;
  const isOperational = OPERATIONAL_ROLES.includes(user.role);
  const now = new Date();
  const db = prismaClient as unknown as TDynamicPrisma;

  const ignoredTables = Object.keys(changes).filter((table) => !PUSHABLE_MODELS[table] && !CUSTOM_PUSH[table]);
  const rejected: IPushRejection[] = [];

  /** Escrituras a ejecutar si TODA la validación pasa. */
  const upserts: Array<{ table: string; record: SyncRecord; willCreate: boolean }> = [];
  const deletions: Array<{ table: string; id: string }> = [];

  for (const table of PUSH_ORDER) {
    const change = changes[table];
    if (!change) continue;
    const custom: CustomPush | undefined = CUSTOM_PUSH[table];

    // ── Tablas custom (entrega de turno / uniforme) ──
    if (custom) {
      const records = [...(change.created ?? []), ...(change.updated ?? [])];
      if (records.length > 0 && !SUPERVISION_ROLES.includes(user.role)) {
        for (const record of records) {
          rejected.push({
            table,
            id: String(record.id ?? "(sin id)"),
            action: "create",
            reason: `Tu rol no puede registrar ${TABLE_LABELS[table] ?? table}`,
          });
        }
      } else {
        for (const record of records) {
          const id = String(record.id ?? "(sin id)");
          const shapeProblem = validateCustomShape(table, record);
          if (shapeProblem) {
            rejected.push({ table, id, action: "create", reason: shapeProblem });
            continue;
          }
          const fkProblem = await findRecordProblem(table, record, db, true);
          if (fkProblem) {
            rejected.push({ table, id, action: "create", reason: fkProblem });
            continue;
          }
          upserts.push({ table, record, willCreate: true });
        }
      }

      // El borrado de estas tablas no está soportado: se reporta en vez de perderse.
      for (const id of change.deleted ?? []) {
        rejected.push({
          table,
          id: String(id),
          action: "delete",
          reason: `La eliminación de ${TABLE_LABELS[table] ?? table} no se admite desde el dispositivo`,
        });
      }
      continue;
    }

    // ── Tablas de escritura directa ──
    const { ownerField, fields } = PUSHABLE_MODELS[table];
    const seenInBatch = new Set<string>();

    for (const action of ["create", "update"] as const) {
      const records = (action === "create" ? change.created : change.updated) ?? [];
      for (const record of records) {
        if (!record.id) {
          rejected.push({ table, id: "(sin id)", action, reason: "El registro no trae id" });
          continue;
        }
        const id = String(record.id);

        // Duplicados dentro del mismo lote: evita ambigüedad y escrituras repetidas.
        if (seenInBatch.has(id)) {
          rejected.push({ table, id, action, reason: "El registro aparece más de una vez en el mismo lote" });
          continue;
        }
        seenInBatch.add(id);

        const existing = await db[table].findUnique({
          where: { id: record.id },
          select: { [ownerField]: true },
        });

        if (isOperational) {
          const owner = existing ? existing[ownerField] : record[ownerField];
          if (owner !== user.id) {
            rejected.push({
              table,
              id,
              action,
              reason: `No puedes sincronizar ${TABLE_LABELS[table] ?? table} de otro usuario`,
            });
            continue;
          }
        }

        const problem = await findRecordProblem(table, record, db, !existing);
        if (problem) {
          rejected.push({ table, id, action, reason: problem });
          continue;
        }

        upserts.push({ table, record, willCreate: !existing });
      }
    }

    // Deduplicado: un mismo id repetido en `deleted` no debe provocar un falso rechazo.
    for (const rawId of new Set(change.deleted ?? [])) {
      const id = String(rawId);
      const found = await db[table].findUnique({ where: { id }, select: { [ownerField]: true } });

      // Ya no existe (p. ej. reenvío tras un fallo de red): la baja es idempotente.
      if (!found) continue;

      if (isOperational && found[ownerField] !== user.id) {
        rejected.push({
          table,
          id,
          action: "delete",
          reason: `No puedes eliminar ${TABLE_LABELS[table] ?? table} de otro usuario`,
        });
        continue;
      }
      deletions.push({ table, id });
    }
  }

  // Nada se aplica si hay rechazos o tablas no permitidas: el cliente reintenta
  // y, si algún registro es irrecuperable, puede descartarlo con la información
  // exacta que devolvemos.
  if (rejected.length > 0 || ignoredTables.length > 0) {
    if (ignoredTables.length > 0) {
      logger.warn(`[sync] Tablas no permitidas en push de ${user.id}: ${ignoredTables.join(", ")}`);
    }
    logger.warn(`[sync] Push rechazado para ${user.id}: ${rejected.length} registro(s) inválido(s)`);
    return { applied: false, summary: {}, ignoredTables, rejected };
  }

  // ── Aplicación: una sola transacción ──
  const summary: Record<string, { created: number; updated: number; deleted: number }> = {};
  const bump = (table: string, key: "created" | "updated" | "deleted") => {
    summary[table] = summary[table] ?? { created: 0, updated: 0, deleted: 0 };
    summary[table][key] += 1;
  };

  await prismaClient.$transaction(
    async (tx) => {
      const txDb = tx as unknown as TDynamicPrisma;

      for (const { table, record, willCreate } of upserts) {
        const custom: CustomPush | undefined = CUSTOM_PUSH[table];
        if (custom) {
          await custom(tx, record, user, now);
          bump(table, "created");
          continue;
        }

        const { fields, createDefaults = {} } = PUSHABLE_MODELS[table];
        const data = pickFields(record, fields);
        if (willCreate) {
          await txDb[table].create({
            data: { ...data, ...createDefaults, id: record.id, createdAt: deviceCreatedAt(record.createdAt, now) },
          });
          bump(table, "created");
        } else {
          await txDb[table].update({ where: { id: record.id }, data });
          bump(table, "updated");
        }
      }

      for (const { table, id } of deletions) {
        // Misma semántica que el borrado online del módulo (ver DELETE_STRATEGY).
        if (DELETE_STRATEGY[table] === "soft") {
          await txDb[table].update({ where: { id }, data: { deletedAt: now } });
        } else {
          await txDb[table].delete({ where: { id } });
        }
        bump(table, "deleted");
      }
    },
    { timeout: 30000 },
  );

  await createAuditLog({
    userId: user.id,
    module: "SYNC",
    action: "PUSH",
    details: { tablesModified: Object.keys(summary), ignoredTables, summary },
  });

  return { applied: true, summary, ignoredTables: [], rejected: [] };
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
