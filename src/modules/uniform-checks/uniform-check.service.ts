import { Prisma } from "@prisma/client";
import { prismaClient as prisma } from "@src/core/config/database";
import {
  OPERATIONAL_ROLES,
  UNIFORM_CHECKLIST,
  UNIFORM_MIN_COMPLIANT_SCORE,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { ITDataTableFetchParams, ITDataTableResponse } from "@src/core/dto/datatable.dto";
import { AppError } from "@src/core/errors/AppError";
import { publishActivity } from "@src/core/utils/ably-publisher";
import { checklistAnswersSchema, normalizeChecklist } from "@src/core/utils/checklist.utils";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import {
  currentShiftDateFor,
  shiftDateFromDb,
  shiftDateToDb,
  todayShiftDate,
} from "@src/core/utils/shift-instance.utils";
import { createAuditLog } from "../audit/audit.service";
import { CreateUniformCheckDTO, IUniformCheckFilters, IUniformCheckResponse } from "./uniform-check.dto";

const AUDIT_MODULE = "UNIFORM_CHECKS";

const personSelect = { id: true, name: true, lastName: true } as const;

const uniformSelect = {
  id: true,
  shiftDate: true,
  score: true,
  compliant: true,
  notes: true,
  items: true,
  createdAt: true,
  guard: { select: personSelect },
  evaluatedBy: { select: personSelect },
  client: { select: { id: true, name: true } },
  schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
} satisfies Prisma.UniformCheckSelect;

type UniformRow = Prisma.UniformCheckGetPayload<{ select: typeof uniformSelect }>;

const toResponse = (row: UniformRow): IUniformCheckResponse => {
  const items = checklistAnswersSchema.safeParse(row.items);
  return {
    ...row,
    shiftDate: shiftDateFromDb(row.shiftDate),
    items: items.success ? items.data : [],
  };
};

/** @description Catálogo de elementos de uniforme y aseo + umbral de cumplimiento. */
export const getUniformCatalog = () => ({
  items: UNIFORM_CHECKLIST,
  minCompliantScore: UNIFORM_MIN_COMPLIANT_SCORE,
});

/** Revisión validada y lista para escribirse. */
export interface IPreparedUniformCheck {
  guardName: string;
  data: Omit<Prisma.UniformCheckUncheckedCreateInput, "id" | "createdAt">;
}

/**
 * @description Valida una revisión y calcula su puntaje. El cliente y el
 * horario se toman de la asignación actual del guardia; la fecha, si no se
 * envía, es la del turno en curso. La usan el endpoint web y la
 * sincronización offline de la APP.
 */
export const prepareUniformCheck = async (
  data: CreateUniformCheckDTO,
  evaluatorId: string,
): Promise<IPreparedUniformCheck> => {
  const guard = await prisma.user.findFirst({
    where: { id: data.guardId, active: true, softDelete: false, role: { name: { in: OPERATIONAL_ROLES } } },
    select: {
      id: true,
      name: true,
      lastName: true,
      clientId: true,
      scheduleId: true,
      schedule: { select: { startTime: true, endTime: true } },
    },
  });
  if (!guard) throw new AppError("Guardia no encontrado o inactivo", 404);
  if (guard.id === evaluatorId) throw new AppError("No puedes evaluar tu propio uniforme", 400);

  const shiftDate =
    data.shiftDate ??
    (guard.schedule ? currentShiftDateFor(guard.schedule.startTime, guard.schedule.endTime) : todayShiftDate());
  const checklist = normalizeChecklist(UNIFORM_CHECKLIST, data.items);

  return {
    guardName: `${guard.name} ${guard.lastName ?? ""}`.trim(),
    data: {
      guardId: guard.id,
      clientId: guard.clientId,
      scheduleId: guard.scheduleId,
      shiftDate: shiftDateToDb(shiftDate),
      evaluatedById: evaluatorId,
      items: checklist.items,
      score: checklist.score,
      compliant: checklist.score >= UNIFORM_MIN_COMPLIANT_SCORE,
      notes: data.notes?.trim() || null,
    },
  };
};

/** @description Registra la revisión de uniforme de un guardia. */
export const createUniformCheck = async (
  data: CreateUniformCheckDTO,
  user: IAuthUser,
): Promise<IUniformCheckResponse> => {
  const prepared = await prepareUniformCheck(data, user.id);
  const created = await prisma.uniformCheck.create({ data: prepared.data, select: uniformSelect });

  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "CREATE",
    resourceId: created.id,
    details: { guardId: created.guard.id, shiftDate: shiftDateFromDb(created.shiftDate), score: created.score },
  });
  void publishActivity("uniform_check", "created", {
    clientId: prepared.data.clientId,
    guardId: created.guard.id,
    guardName: prepared.guardName,
    compliant: created.compliant,
  });

  return toResponse(created);
};

const parseCompliant = (value: IUniformCheckFilters["compliant"]): boolean | undefined => {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return undefined;
};

/** @description Listado paginado para `ITDataTable`. */
export const getDataTableUniformChecks = async (
  params: ITDataTableFetchParams,
  user: IAuthUser,
): Promise<ITDataTableResponse<IUniformCheckResponse>> => {
  const filters = (params.filters ?? {}) as IUniformCheckFilters;
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const page = Math.max(Number(params.page) || 1, 1);
  const clientId = resolveClientScope(user, filters.clientId);
  const compliant = parseCompliant(filters.compliant);
  const search = String(filters.search ?? "").trim();

  const where: Prisma.UniformCheckWhereInput = {
    deletedAt: null,
    ...(clientId ? { clientId } : {}),
    ...(filters.guardId ? { guardId: filters.guardId } : {}),
    ...(compliant !== undefined ? { compliant } : {}),
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
            { guard: { name: { contains: search, mode: "insensitive" } } },
            { guard: { lastName: { contains: search, mode: "insensitive" } } },
            { evaluatedBy: { name: { contains: search, mode: "insensitive" } } },
            { notes: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortable: Record<string, Prisma.UniformCheckOrderByWithRelationInput> = {
    shiftDate: { shiftDate: params.sort?.direction ?? "desc" },
    score: { score: params.sort?.direction ?? "desc" },
    createdAt: { createdAt: params.sort?.direction ?? "desc" },
  };
  const orderBy = (params.sort?.key && sortable[params.sort.key]) || { createdAt: "desc" };

  const [rows, total] = await Promise.all([
    prisma.uniformCheck.findMany({
      where,
      select: uniformSelect,
      orderBy: [orderBy, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.uniformCheck.count({ where }),
  ]);

  return { rows: rows.map(toResponse), total };
};

/** @description Detalle de una revisión. */
export const getUniformCheckById = async (id: string, user: IAuthUser): Promise<IUniformCheckResponse> => {
  const clientId = resolveClientScope(user);
  const row = await prisma.uniformCheck.findFirst({
    where: { id, deletedAt: null, ...(clientId ? { clientId } : {}) },
    select: uniformSelect,
  });
  if (!row) throw new AppError("Revisión de uniforme no encontrada", 404);
  return toResponse(row);
};

/** @description Eliminación lógica de una revisión. */
export const deleteUniformCheck = async (id: string, user: IAuthUser): Promise<boolean> => {
  const row = await prisma.uniformCheck.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!row) throw new AppError("Revisión de uniforme no encontrada", 404);
  await prisma.uniformCheck.update({ where: { id }, data: { deletedAt: new Date() } });
  await createAuditLog({ userId: user.id, module: AUDIT_MODULE, action: "DELETE", resourceId: id });
  return true;
};
