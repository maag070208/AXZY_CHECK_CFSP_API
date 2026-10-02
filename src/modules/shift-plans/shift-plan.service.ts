import { Prisma } from "@prisma/client";
import { prismaClient as prisma } from "@src/core/config/database";
import {
  ROLE_GUARD,
  SHIFT_PLAN_DEFAULT_TOLERANCE_MINUTES,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { AppError } from "@src/core/errors/AppError";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import { createAuditLog } from "../audit/audit.service";
import {
  CreateShiftPlanDTO,
  IShiftPlanResponse,
  UpdateShiftPlanDTO,
} from "./shift-plan.dto";

const AUDIT_MODULE = "SHIFT_PLANS";
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const planSelect = {
  id: true,
  clientId: true,
  scheduleId: true,
  requireHandover: true,
  requireUniform: true,
  toleranceMinutes: true,
  daysOfWeek: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
  schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
} satisfies Prisma.ShiftPlanSelect;

type PlanRow = Prisma.ShiftPlanGetPayload<{ select: typeof planSelect }>;

/** @description Cuenta guardias activos por (cliente, horario) en una consulta. */
const countGuardsByPlan = async (plans: PlanRow[]): Promise<Map<string, number>> => {
  if (plans.length === 0) return new Map();
  const groups = await prisma.user.groupBy({
    by: ["clientId", "scheduleId"],
    where: {
      active: true,
      softDelete: false,
      role: { name: ROLE_GUARD },
      clientId: { in: plans.map((p) => p.clientId) },
      scheduleId: { in: plans.map((p) => p.scheduleId) },
    },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const g of groups) map.set(`${g.clientId}:${g.scheduleId}`, g._count._all);
  return map;
};

const toResponse = (plan: PlanRow, guards: Map<string, number>): IShiftPlanResponse => ({
  ...plan,
  guardsCount: guards.get(`${plan.clientId}:${plan.scheduleId}`) ?? 0,
});

/** @description Lista los planes vigentes (no eliminados), opcionalmente por cliente. */
export const listShiftPlans = async (
  user: IAuthUser,
  clientId?: string,
): Promise<IShiftPlanResponse[]> => {
  const scopedClientId = resolveClientScope(user, clientId);
  const plans = await prisma.shiftPlan.findMany({
    where: { deletedAt: null, ...(scopedClientId ? { clientId: scopedClientId } : {}) },
    select: planSelect,
    orderBy: [{ client: { name: "asc" } }, { schedule: { startTime: "asc" } }],
  });
  const guards = await countGuardsByPlan(plans);
  return plans.map((p) => toResponse(p, guards));
};

const loadPlan = async (id: string): Promise<IShiftPlanResponse> => {
  const plan = await prisma.shiftPlan.findFirst({ where: { id, deletedAt: null }, select: planSelect });
  if (!plan) throw new AppError("Plan de turno no encontrado", 404);
  const guards = await countGuardsByPlan([plan]);
  return toResponse(plan, guards);
};

/**
 * @description Crea la programación de un turno para un cliente. Si ya
 * existe una eliminada para el mismo cliente/horario se reactiva con los
 * nuevos valores (la llave única impide duplicarla).
 */
export const createShiftPlan = async (
  data: CreateShiftPlanDTO,
  user: IAuthUser,
): Promise<IShiftPlanResponse> => {
  const [client, schedule] = await Promise.all([
    prisma.client.findFirst({ where: { id: data.clientId, softDelete: false }, select: { id: true } }),
    prisma.schedule.findFirst({ where: { id: data.scheduleId, deletedAt: null }, select: { id: true } }),
  ]);
  if (!client) throw new AppError("Cliente no encontrado", 404);
  if (!schedule) throw new AppError("Horario no encontrado", 404);

  const values = {
    requireHandover: data.requireHandover ?? true,
    requireUniform: data.requireUniform ?? true,
    toleranceMinutes: data.toleranceMinutes ?? SHIFT_PLAN_DEFAULT_TOLERANCE_MINUTES,
    daysOfWeek: data.daysOfWeek ? [...new Set(data.daysOfWeek)].sort((a, b) => a - b) : ALL_DAYS,
    active: data.active ?? true,
  };

  const existing = await prisma.shiftPlan.findUnique({
    where: { clientId_scheduleId: { clientId: data.clientId, scheduleId: data.scheduleId } },
    select: { id: true, deletedAt: true },
  });
  if (existing && !existing.deletedAt) {
    throw new AppError("Este cliente ya tiene programado ese turno", 409);
  }

  const saved = existing
    ? await prisma.shiftPlan.update({
        where: { id: existing.id },
        data: { ...values, deletedAt: null },
        select: { id: true },
      })
    : await prisma.shiftPlan.create({
        data: { ...values, clientId: data.clientId, scheduleId: data.scheduleId },
        select: { id: true },
      });

  await createAuditLog({
    userId: user.id,
    module: AUDIT_MODULE,
    action: "CREATE",
    resourceId: saved.id,
    details: { clientId: data.clientId, scheduleId: data.scheduleId, ...values },
  });

  return loadPlan(saved.id);
};

/** @description Actualiza reglas de un plan (exigencias, tolerancia, días, estado). */
export const updateShiftPlan = async (
  id: string,
  data: UpdateShiftPlanDTO,
  user: IAuthUser,
): Promise<IShiftPlanResponse> => {
  const current = await prisma.shiftPlan.findFirst({
    where: { id, deletedAt: null },
    select: { requireHandover: true, requireUniform: true },
  });
  if (!current) throw new AppError("Plan de turno no encontrado", 404);

  const requireHandover = data.requireHandover ?? current.requireHandover;
  const requireUniform = data.requireUniform ?? current.requireUniform;
  if (!requireHandover && !requireUniform) {
    throw new AppError("El plan debe exigir entrega de turno, uniforme o ambos", 400);
  }

  await prisma.shiftPlan.update({
    where: { id },
    data: {
      ...data,
      ...(data.daysOfWeek ? { daysOfWeek: [...new Set(data.daysOfWeek)].sort((a, b) => a - b) } : {}),
    },
  });

  await createAuditLog({ userId: user.id, module: AUDIT_MODULE, action: "UPDATE", resourceId: id, details: data });
  return loadPlan(id);
};

/** @description Eliminación lógica de un plan. */
export const deleteShiftPlan = async (id: string, user: IAuthUser): Promise<boolean> => {
  const current = await prisma.shiftPlan.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!current) throw new AppError("Plan de turno no encontrado", 404);

  await prisma.shiftPlan.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
  await createAuditLog({ userId: user.id, module: AUDIT_MODULE, action: "DELETE", resourceId: id });
  return true;
};
