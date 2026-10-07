import { prismaClient as prisma } from "@src/core/config/database";
import {
  ATTENDANCE_EARLY_WINDOW_HOURS,
  ATTENDANCE_STATUS,
  AttendanceStatus,
  OPERATIONAL_ROLES,
} from "@src/core/config/constants";
import { IAuthUser } from "@src/core/dto/auth-user.dto";
import { resolveClientScope } from "@src/core/utils/client-scope.utils";
import {
  getShiftInstance,
  shiftDateWeekday,
  todayShiftDate,
  IShiftInstance,
} from "@src/core/utils/shift-instance.utils";
import { IAttendanceItem, IAttendanceReport, IAttendanceTotals } from "./dashboard.dto";

const minutesBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / 60000);

const byAttendancePriority: Record<AttendanceStatus, number> = {
  [ATTENDANCE_STATUS.ABSENT]: 0,
  [ATTENDANCE_STATUS.LATE]: 1,
  [ATTENDANCE_STATUS.PENDING]: 2,
  [ATTENDANCE_STATUS.ON_TIME]: 3,
};

/**
 * @description Asistencia del personal operativo contra su horario: quién está
 * en turno, quién llegó tarde y quién no se presentó. Se deriva de los
 * `ShiftPlan` (qué horarios aplican hoy), el `Schedule` de cada usuario y su
 * primer registro de entrada del turno (`GuardLoginLog`). No guarda nada.
 */
export const getAttendance = async (
  user: IAuthUser,
  requestedClientId?: string,
  requestedDate?: string,
): Promise<IAttendanceReport> => {
  const now = new Date();
  const shiftDate = requestedDate || todayShiftDate();

  // Un usuario de cliente SIEMPRE queda acotado a su empresa (ignora el query);
  // sin cliente asignado recibe 403 en lugar de ver la asistencia de otra empresa.
  const scopedClientId = resolveClientScope(user, requestedClientId);

  const plans = await prisma.shiftPlan.findMany({
    where: {
      deletedAt: null,
      active: true,
      ...(scopedClientId ? { clientId: scopedClientId } : {}),
      client: { active: true, softDelete: false },
      schedule: { active: true, deletedAt: null },
    },
    select: {
      clientId: true,
      scheduleId: true,
      toleranceMinutes: true,
      daysOfWeek: true,
      client: { select: { name: true } },
      schedule: { select: { name: true, startTime: true, endTime: true } },
    },
  });

  // Solo los turnos que operan hoy. Sin esto, un horario que no trabaja hoy
  // aparecería como falta y ensuciaría el reporte.
  const weekday = shiftDateWeekday(shiftDate);
  const todaysPlans = plans.filter((p) => p.daysOfWeek.includes(weekday));

  const emptyTotals: IAttendanceTotals = { expected: 0, onTime: 0, late: 0, absent: 0, pending: 0 };
  if (todaysPlans.length === 0) {
    return { generatedAt: now.toISOString(), shiftDate, scope: scopedClientId ? "CLIENT" : "ALL", totals: emptyTotals, items: [] };
  }

  const clientIds = [...new Set(todaysPlans.map((p) => p.clientId))];
  const scheduleIds = [...new Set(todaysPlans.map((p) => p.scheduleId))];

  const staff = await prisma.user.findMany({
    where: {
      active: true,
      softDelete: false,
      role: { name: { in: OPERATIONAL_ROLES } },
      clientId: { in: clientIds },
      scheduleId: { in: scheduleIds },
    },
    select: {
      id: true,
      name: true,
      lastName: true,
      role: { select: { name: true } },
      clientId: true,
      scheduleId: true,
      client: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  if (staff.length === 0) {
    return { generatedAt: now.toISOString(), shiftDate, scope: scopedClientId ? "CLIENT" : "ALL", totals: emptyTotals, items: [] };
  }

  const planByPair = new Map(todaysPlans.map((p) => [`${p.clientId}:${p.scheduleId}`, p]));

  // Instancia de turno por usuario + ventana de entradas a consultar.
  const instances = new Map<string, { instance: IShiftInstance; tolerance: number; plan: (typeof todaysPlans)[number] }>();
  for (const person of staff) {
    if (!person.clientId || !person.scheduleId) continue;
    const plan = planByPair.get(`${person.clientId}:${person.scheduleId}`);
    if (!plan) continue;
    instances.set(person.id, {
      plan,
      tolerance: plan.toleranceMinutes,
      instance: getShiftInstance(shiftDate, plan.schedule.startTime, plan.schedule.endTime, plan.toleranceMinutes),
    });
  }

  const earliestStart = Math.min(...[...instances.values()].map((v) => v.instance.startAt.getTime()));
  const windowStart = new Date(earliestStart - ATTENDANCE_EARLY_WINDOW_HOURS * 60 * 60 * 1000);

  const logs = instances.size
    ? await prisma.guardLoginLog.findMany({
        where: { userId: { in: [...instances.keys()] }, loginAt: { gte: windowStart } },
        select: { userId: true, loginAt: true },
        orderBy: { loginAt: "asc" },
      })
    : [];

  // Primera entrada que caiga dentro de la ventana de cada turno.
  const firstCheckIn = new Map<string, Date>();
  for (const log of logs) {
    const ctx = instances.get(log.userId);
    if (!ctx) continue;
    if (log.loginAt < ctx.instance.startAt || log.loginAt > ctx.instance.endAt) continue;
    const current = firstCheckIn.get(log.userId);
    if (!current || log.loginAt < current) firstCheckIn.set(log.userId, log.loginAt);
  }

  const items: IAttendanceItem[] = staff.reduce<IAttendanceItem[]>((acc, person) => {
    const ctx = instances.get(person.id);
    if (!ctx) return acc;

    const checkIn = firstCheckIn.get(person.id) ?? null;
    let status: AttendanceStatus;
    let minutesLate: number | null = null;

    if (checkIn) {
      minutesLate = minutesBetween(ctx.instance.startAt, checkIn);
      status = minutesLate <= ctx.tolerance ? ATTENDANCE_STATUS.ON_TIME : ATTENDANCE_STATUS.LATE;
    } else {
      status = now >= ctx.instance.dueAt ? ATTENDANCE_STATUS.ABSENT : ATTENDANCE_STATUS.PENDING;
    }

    acc.push({
      guardId: person.id,
      name: person.name,
      lastName: person.lastName,
      role: person.role.name as IAttendanceItem["role"],
      clientId: person.clientId,
      clientName: person.client?.name ?? null,
      scheduleId: person.scheduleId,
      scheduleName: ctx.plan.schedule.name,
      scheduledStart: ctx.instance.startAt.toISOString(),
      checkInAt: checkIn ? checkIn.toISOString() : null,
      status,
      minutesLate,
    });
    return acc;
  }, []);

  items.sort(
    (a, b) =>
      byAttendancePriority[a.status] - byAttendancePriority[b.status] ||
      a.scheduledStart.localeCompare(b.scheduledStart) ||
      a.name.localeCompare(b.name),
  );

  const totals = items.reduce<IAttendanceTotals>(
    (acc, item) => {
      acc.expected += 1;
      if (item.status === ATTENDANCE_STATUS.ON_TIME) acc.onTime += 1;
      else if (item.status === ATTENDANCE_STATUS.LATE) acc.late += 1;
      else if (item.status === ATTENDANCE_STATUS.ABSENT) acc.absent += 1;
      else acc.pending += 1;
      return acc;
    },
    { expected: 0, onTime: 0, late: 0, absent: 0, pending: 0 },
  );

  return {
    generatedAt: now.toISOString(),
    shiftDate,
    scope: scopedClientId ? "CLIENT" : "ALL",
    totals,
    items,
  };
};
