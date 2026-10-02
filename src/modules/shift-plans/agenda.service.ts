import { prismaClient as prisma } from "@src/core/config/database";
import {
  AGENDA_ITEM_TYPE,
  AGENDA_STATUS,
  AgendaStatus,
  ROLE_GUARD,
} from "@src/core/config/constants";
import {
  IShiftInstance,
  addDaysToShiftDate,
  getShiftInstance,
  shiftDateFromDb,
  shiftDateToDb,
  shiftDateWeekday,
  todayShiftDate,
} from "@src/core/utils/shift-instance.utils";
import {
  IAgendaItem,
  IAgendaRecord,
  IAgendaResponse,
  IAgendaSummary,
  IPersonSummary,
} from "./shift-plan.dto";

const fullName = (p: { name: string; lastName: string | null }): string =>
  `${p.name} ${p.lastName ?? ""}`.trim();

/**
 * @description Estado de un compromiso según si ya tiene registro y en qué
 * punto del turno estamos.
 */
export const resolveAgendaStatus = (
  hasRecord: boolean,
  instance: IShiftInstance,
  now: Date,
): AgendaStatus => {
  if (hasRecord) return AGENDA_STATUS.DONE;
  if (now < instance.startAt) return AGENDA_STATUS.UPCOMING;
  if (now <= instance.dueAt) return AGENDA_STATUS.IN_WINDOW;
  if (now < instance.endAt) return AGENDA_STATUS.OVERDUE;
  return AGENDA_STATUS.MISSED;
};

/** @description Resume una lista de compromisos por estado. */
export const summarizeAgenda = (items: IAgendaItem[]): IAgendaSummary => {
  const count = (status: AgendaStatus) => items.filter((i) => i.status === status).length;
  const done = count(AGENDA_STATUS.DONE);
  const upcoming = count(AGENDA_STATUS.UPCOMING);
  const inWindow = count(AGENDA_STATUS.IN_WINDOW);
  // Exigibles: ya pasó su vencimiento (o ya se hicieron). Lo que sigue en
  // ventana o aún no empieza no cuenta en contra del cumplimiento.
  const exigible = items.length - upcoming - inWindow;
  return {
    total: items.length,
    done,
    inWindow,
    overdue: count(AGENDA_STATUS.OVERDUE),
    missed: count(AGENDA_STATUS.MISSED),
    upcoming,
    compliancePercent: exigible > 0 ? Math.round((done / exigible) * 100) : null,
  };
};

/**
 * @description Calcula la agenda de entregas de turno y revisiones de
 * uniforme para las fechas de inicio de turno indicadas. No guarda nada:
 * se deriva de `ShiftPlan`, de los guardias asignados (cliente + horario)
 * y de los registros existentes, así que siempre refleja el estado real.
 */
export const buildAgenda = async (
  shiftDates: string[],
  clientId?: string,
  now: Date = new Date(),
): Promise<IAgendaResponse> => {
  const plans = await prisma.shiftPlan.findMany({
    where: {
      deletedAt: null,
      active: true,
      ...(clientId ? { clientId } : {}),
      client: { active: true, softDelete: false },
      schedule: { active: true, deletedAt: null },
    },
    select: {
      id: true,
      clientId: true,
      scheduleId: true,
      requireHandover: true,
      requireUniform: true,
      toleranceMinutes: true,
      daysOfWeek: true,
      client: { select: { id: true, name: true } },
      schedule: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  });

  const empty: IAgendaItem[] = [];
  if (plans.length === 0) {
    const summary = summarizeAgenda(empty);
    return { dates: shiftDates, generatedAt: now, items: empty, summary, handoverSummary: summary, uniformSummary: summary };
  }

  const clientIds = [...new Set(plans.map((p) => p.clientId))];
  const scheduleIds = [...new Set(plans.map((p) => p.scheduleId))];
  const dbDates = shiftDates.map(shiftDateToDb);

  const guards = plans.some((p) => p.requireUniform)
    ? await prisma.user.findMany({
        where: {
          active: true,
          softDelete: false,
          role: { name: ROLE_GUARD },
          clientId: { in: clientIds },
          scheduleId: { in: scheduleIds },
        },
        select: { id: true, name: true, lastName: true, clientId: true, scheduleId: true },
        orderBy: { name: "asc" },
      })
    : [];

  const [handovers, uniforms] = await Promise.all([
    prisma.shiftHandover.findMany({
      where: { deletedAt: null, clientId: { in: clientIds }, shiftDate: { in: dbDates } },
      select: {
        id: true,
        clientId: true,
        scheduleId: true,
        shiftDate: true,
        createdAt: true,
        createdBy: { select: { name: true, lastName: true } },
      },
    }),
    guards.length
      ? prisma.uniformCheck.findMany({
          where: { deletedAt: null, guardId: { in: guards.map((g) => g.id) }, shiftDate: { in: dbDates } },
          select: {
            id: true,
            guardId: true,
            shiftDate: true,
            score: true,
            compliant: true,
            createdAt: true,
            evaluatedBy: { select: { name: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const handoverByKey = new Map<string, IAgendaRecord>();
  for (const h of handovers) {
    handoverByKey.set(`${h.clientId}:${h.scheduleId}:${shiftDateFromDb(h.shiftDate)}`, {
      id: h.id,
      createdAt: h.createdAt,
      by: fullName(h.createdBy),
    });
  }

  // Ordenado desc: la primera revisión que vemos por guardia/fecha es la última.
  const uniformByKey = new Map<string, IAgendaRecord>();
  for (const u of uniforms) {
    const key = `${u.guardId}:${shiftDateFromDb(u.shiftDate)}`;
    if (uniformByKey.has(key)) continue;
    uniformByKey.set(key, {
      id: u.id,
      createdAt: u.createdAt,
      by: fullName(u.evaluatedBy),
      score: u.score,
      compliant: u.compliant,
    });
  }

  const items: IAgendaItem[] = [];
  for (const shiftDate of shiftDates) {
    const weekday = shiftDateWeekday(shiftDate);
    for (const plan of plans) {
      if (!plan.daysOfWeek.includes(weekday)) continue;
      const instance = getShiftInstance(
        shiftDate,
        plan.schedule.startTime,
        plan.schedule.endTime,
        plan.toleranceMinutes,
      );
      const base = {
        shiftDate,
        startAt: instance.startAt,
        dueAt: instance.dueAt,
        endAt: instance.endAt,
        planId: plan.id,
        client: plan.client,
        schedule: plan.schedule,
      };

      if (plan.requireHandover) {
        const record = handoverByKey.get(`${plan.clientId}:${plan.scheduleId}:${shiftDate}`) ?? null;
        items.push({
          ...base,
          id: `${AGENDA_ITEM_TYPE.HANDOVER}:${plan.id}:${shiftDate}`,
          type: AGENDA_ITEM_TYPE.HANDOVER,
          status: resolveAgendaStatus(!!record, instance, now),
          guard: null,
          record,
        });
      }

      if (plan.requireUniform) {
        for (const g of guards) {
          if (g.clientId !== plan.clientId || g.scheduleId !== plan.scheduleId) continue;
          const record = uniformByKey.get(`${g.id}:${shiftDate}`) ?? null;
          const guard: IPersonSummary = { id: g.id, name: g.name, lastName: g.lastName };
          items.push({
            ...base,
            id: `${AGENDA_ITEM_TYPE.UNIFORM}:${plan.id}:${shiftDate}:${g.id}`,
            type: AGENDA_ITEM_TYPE.UNIFORM,
            status: resolveAgendaStatus(!!record, instance, now),
            guard,
            record,
          });
        }
      }
    }
  }

  items.sort(
    (a, b) =>
      a.startAt.getTime() - b.startAt.getTime() ||
      a.client.name.localeCompare(b.client.name) ||
      a.type.localeCompare(b.type) ||
      (a.guard?.name ?? "").localeCompare(b.guard?.name ?? ""),
  );

  return {
    dates: shiftDates,
    generatedAt: now,
    items,
    summary: summarizeAgenda(items),
    handoverSummary: summarizeAgenda(items.filter((i) => i.type === AGENDA_ITEM_TYPE.HANDOVER)),
    uniformSummary: summarizeAgenda(items.filter((i) => i.type === AGENDA_ITEM_TYPE.UNIFORM)),
  };
};

/** @description Agenda de un día (por defecto hoy en la zona operativa). */
export const getAgendaForDate = (shiftDate?: string, clientId?: string): Promise<IAgendaResponse> =>
  buildAgenda([shiftDate ?? todayShiftDate()], clientId);

/**
 * @description Compromisos que aplican AHORA: turnos que iniciaron hoy y
 * los de ayer que siguen en curso (nocturnos). Usado por el dashboard.
 */
export const getCurrentAgenda = async (clientId?: string, now: Date = new Date()): Promise<IAgendaResponse> => {
  const today = todayShiftDate();
  const agenda = await buildAgenda([addDaysToShiftDate(today, -1), today], clientId, now);
  // Ayer solo interesa lo que todavía está en curso.
  const items = agenda.items.filter((i) => i.shiftDate === today || i.endAt > now);
  return {
    ...agenda,
    items,
    summary: summarizeAgenda(items),
    handoverSummary: summarizeAgenda(items.filter((i) => i.type === AGENDA_ITEM_TYPE.HANDOVER)),
    uniformSummary: summarizeAgenda(items.filter((i) => i.type === AGENDA_ITEM_TYPE.UNIFORM)),
  };
};
