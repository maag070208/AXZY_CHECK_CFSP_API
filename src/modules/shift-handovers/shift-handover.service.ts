import { Prisma } from "@prisma/client";
import { prismaClient as prisma } from "@src/core/config/database";
import {
  OPERATIONAL_ROLES,
  SHIFT_HANDOVER_CHECKLIST,
  SHIFT_PLAN_DEFAULT_TOLERANCE_MINUTES,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { AppError } from "@src/core/errors/AppError";
import { publishActivity } from "@src/core/utils/ably-publisher";
import { ChecklistAnswer, checklistAnswersSchema, normalizeChecklist } from "@src/core/utils/checklist.utils";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import {
  getShiftInstance,
  minutesLateAgainstStart,
  shiftDateFromDb,
  shiftDateToDb,
} from "@src/core/utils/shift-instance.utils";
import { createAuditLog } from "../audit/audit.service";
import {
  CreateShiftHandoverDTO,
  IShiftHandoverDetail,
  IShiftHandoverFilters,
  IShiftHandoverListItem,
} from "./shift-handover.dto";

const AUDIT_MODULE = "SHIFT_HANDOVERS";

const personSelect = { id: true, name: true, lastName: true } as const;

const listSelect = {
  id: true,
  shiftDate: true,
  credentialsCount: true,
  tarjetonesCount: true,
  reportedToAdmin: true,
  checklist: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
  createdBy: { select: personSelect },
  elements: { select: { punctual: true } },
} satisfies Prisma.ShiftHandoverSelect;

const detailSelect = {
  ...listSelect,
  novedades: true,
  elements: {
    select: { id: true, entryTime: true, punctual: true, observations: true, guard: { select: personSelect } },
    orderBy: { entryTime: "asc" },
  },
} satisfies Prisma.ShiftHandoverSelect;

type ListRow = Prisma.ShiftHandoverGetPayload<{ select: typeof listSelect }>;
type DetailRow = Prisma.ShiftHandoverGetPayload<{ select: typeof detailSelect }>;

const readChecklist = (value: Prisma.JsonValue): ChecklistAnswer[] => {
  const parsed = checklistAnswersSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
};

const toListItem = (row: ListRow): IShiftHandoverListItem => {
  const checklist = readChecklist(row.checklist);
  return {
    id: row.id,
    shiftDate: shiftDateFromDb(row.shiftDate),
    credentialsCount: row.credentialsCount,
    tarjetonesCount: row.tarjetonesCount,
    reportedToAdmin: row.reportedToAdmin,
    checklistOk: checklist.filter((c) => c.ok).length,
    checklistTotal: checklist.length,
    elementsCount: row.elements.length,
    lateCount: row.elements.filter((e) => !e.punctual).length,
    client: row.client,
    schedule: row.schedule,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  };
};

const toDetail = (row: DetailRow): IShiftHandoverDetail => ({
  ...toListItem(row),
  novedades: row.novedades,
  checklist: readChecklist(row.checklist),
  elements: row.elements,
});

/** @description Catálogo de equipo/insumos que se verifica en la entrega. */
export const getHandoverCatalog = () => SHIFT_HANDOVER_CHECKLIST;

/** Entrega validada y lista para escribirse (sin autor, id ni fecha de alta). */
export interface IPreparedShiftHandover {
  clientName: string;
  handover: Omit<Prisma.ShiftHandoverUncheckedCreateInput, "id" | "createdById" | "createdAt" | "elements">;
  elements: Omit<Prisma.ShiftHandoverElementCreateManyInput, "shiftHandoverId">[];
}

/**
 * @description Valida una entrega (cliente, turno, elementos operativos sin
 * repetir, checklist contra catálogo) y calcula la puntualidad de cada
 * elemento contra el inicio del turno + tolerancia. No escribe nada: la usan
 * el endpoint web y la sincronización offline de la APP.
 */
export const prepareShiftHandover = async (data: CreateShiftHandoverDTO): Promise<IPreparedShiftHandover> => {
  const [client, schedule, plan] = await Promise.all([
    prisma.client.findFirst({ where: { id: data.clientId, softDelete: false }, select: { id: true, name: true } }),
    prisma.schedule.findFirst({
      where: { id: data.scheduleId, deletedAt: null },
      select: { id: true, startTime: true, endTime: true },
    }),
    prisma.shiftPlan.findFirst({
      where: { clientId: data.clientId, scheduleId: data.scheduleId, deletedAt: null },
      select: { toleranceMinutes: true },
    }),
  ]);
  if (!client) throw new AppError("Cliente no encontrado", 404);
  if (!schedule) throw new AppError("Horario no encontrado", 404);

  const guardIds = data.elements.map((e) => e.guardId);
  if (new Set(guardIds).size !== guardIds.length) {
    throw new AppError("Un guardia aparece más de una vez en los elementos", 400);
  }
  const guards = await prisma.user.findMany({
    where: { id: { in: guardIds }, active: true, softDelete: false, role: { name: { in: OPERATIONAL_ROLES } } },
    select: { id: true },
  });
  if (guards.length !== guardIds.length) {
    throw new AppError("Uno o más elementos no son personal operativo activo", 400);
  }

  const checklist = normalizeChecklist(SHIFT_HANDOVER_CHECKLIST, data.checklist);
  const tolerance = plan?.toleranceMinutes ?? SHIFT_PLAN_DEFAULT_TOLERANCE_MINUTES;
  const instance = getShiftInstance(data.shiftDate, schedule.startTime, schedule.endTime, tolerance);

  return {
    clientName: client.name,
    handover: {
      clientId: data.clientId,
      scheduleId: data.scheduleId,
      shiftDate: shiftDateToDb(data.shiftDate),
      credentialsCount: data.credentialsCount ?? null,
      tarjetonesCount: data.tarjetonesCount ?? null,
      novedades: data.novedades?.trim() || null,
      checklist: checklist.items,
      reportedToAdmin: data.reportedToAdmin ?? false,
    },
    elements: data.elements.map((el) => ({
      guardId: el.guardId,
      entryTime: el.entryTime,
      punctual: minutesLateAgainstStart(el.entryTime, instance) <= tolerance,
      observations: el.observations?.trim() || null,
    })),
  };
};

/** @description Escribe una entrega preparada y sus elementos dentro de una transacción. */
export const writeShiftHandover = async (
  tx: Pick<typeof prisma, "shiftHandover" | "shiftHandoverElement">,
  prepared: IPreparedShiftHandover,
  options: { createdById: string; id?: string; createdAt?: Date },
): Promise<string> => {
  const handover = await tx.shiftHandover.create({
    data: { ...prepared.handover, createdById: options.createdById, id: options.id, createdAt: options.createdAt },
    select: { id: true },
  });
  await tx.shiftHandoverElement.createMany({
    data: prepared.elements.map((el) => ({ ...el, shiftHandoverId: handover.id })),
  });
  return handover.id;
};

/**
 * @description Registra la entrega/recepción de un turno con sus elementos.
 * Rechaza duplicados (mismo cliente, turno y fecha) y calcula la
 * puntualidad de cada elemento contra el inicio del turno + tolerancia.
 */
export const createShiftHandover = async (
  data: CreateShiftHandoverDTO,
  user: IAuthUser,
): Promise<IShiftHandoverDetail> => {
  const prepared = await prepareShiftHandover(data);

  const duplicate = await prisma.shiftHandover.findFirst({
    where: {
      clientId: data.clientId,
      scheduleId: data.scheduleId,
      shiftDate: shiftDateToDb(data.shiftDate),
      deletedAt: null,
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("Ya existe una entrega registrada para ese turno y fecha", 409);

  const createdId = await prisma.$transaction((tx) => writeShiftHandover(tx, prepared, { createdById: user.id }));

  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "CREATE",
    resourceId: createdId,
    details: { clientId: data.clientId, scheduleId: data.scheduleId, shiftDate: data.shiftDate },
  });
  void publishActivity("shift_handover", "created", { clientId: data.clientId, clientName: prepared.clientName });

  return getShiftHandoverById(createdId, user);
};

/** @description Listado paginado para `ITDataTable`. */
export const getDataTableShiftHandovers = async (
  params: ITDataTableFetchParams,
  user: IAuthUser,
): Promise<ITDataTableResponse<IShiftHandoverListItem>> => {
  const filters = (params.filters ?? {}) as IShiftHandoverFilters;
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const page = Math.max(Number(params.page) || 1, 1);
  const clientId = resolveClientScope(user, filters.clientId);
  const search = String(filters.search ?? "").trim();

  const where: Prisma.ShiftHandoverWhereInput = {
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          shiftDate: {
            ...(filters.dateFrom ? { gte: shiftDateToDb(filters.dateFrom) } : {}),
            ...(filters.dateTo ? { lte: shiftDateToDb(filters.dateTo) } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { novedades: { contains: search, mode: "insensitive" } },
            { client: { name: { contains: search, mode: "insensitive" } } },
            { createdBy: { name: { contains: search, mode: "insensitive" } } },
            { elements: { some: { guard: { name: { contains: search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const sortable: Record<string, Prisma.ShiftHandoverOrderByWithRelationInput> = {
    shiftDate: { shiftDate: params.sort?.direction ?? "desc" },
    createdAt: { createdAt: params.sort?.direction ?? "desc" },
  };
  const orderBy = (params.sort?.key && sortable[params.sort.key]) || { shiftDate: "desc" };

  const [rows, total] = await Promise.all([
    prisma.shiftHandover.findMany({
      where,
      select: listSelect,
      orderBy: [orderBy, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shiftHandover.count({ where }),
  ]);

  return { rows: rows.map(toListItem), total };
};

/** @description Detalle completo (checklist + elementos) de una entrega. */
export const getShiftHandoverById = async (id: string, user: IAuthUser): Promise<IShiftHandoverDetail> => {
  const clientId = resolveClientScope(user);
  const row = await prisma.shiftHandover.findFirst({
    where: { id, deletedAt: null, ...(clientId ? { clientId } : {}) },
    select: detailSelect,
  });
  if (!row) throw new AppError("Entrega de turno no encontrada", 404);
  return toDetail(row);
};

/** @description Eliminación lógica de una entrega. */
export const deleteShiftHandover = async (id: string, user: IAuthUser): Promise<boolean> => {
  const row = await prisma.shiftHandover.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!row) throw new AppError("Entrega de turno no encontrada", 404);
  await prisma.shiftHandover.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({ userId: user.id, module: AUDIT_MODULE, action: "DELETE", resourceId: id });
  return true;
};
