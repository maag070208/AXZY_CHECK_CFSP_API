import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { DEFAULT_TIMEZONE } from "../config/constants";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

/** Formato de fecha de turno usado en API y WEB. */
export const SHIFT_DATE_FORMAT = "YYYY-MM-DD";

/**
 * Una ocurrencia concreta de un turno (`Schedule`) en una fecha.
 * `shiftDate` es la fecha en que el turno INICIA.
 */
export interface IShiftInstance {
  shiftDate: string;
  startAt: Date;
  /** Inicio + tolerancia: después de esto el compromiso está vencido. */
  dueAt: Date;
  /** Fin del turno (día siguiente si cruza medianoche). */
  endAt: Date;
}

const parseHHmm = (value: string): { hour: number; minute: number } => {
  const [hour, minute] = value.split(":").map(Number);
  return { hour: hour || 0, minute: minute || 0 };
};

/**
 * @description Calcula inicio, vencimiento y fin de un turno para una fecha
 * de inicio dada, en la zona horaria operativa. Si `endTime` es menor o
 * igual que `startTime` el turno termina al día siguiente (nocturno).
 * @example getShiftInstance("2026-10-01", "19:00", "07:00", 30)
 *   // startAt 2026-10-01 19:00, dueAt 19:30, endAt 2026-10-02 07:00
 */
export const getShiftInstance = (
  shiftDate: string,
  startTime: string,
  endTime: string,
  toleranceMinutes: number,
  tz: string = DEFAULT_TIMEZONE,
): IShiftInstance => {
  const day = dayjs.tz(shiftDate, SHIFT_DATE_FORMAT, tz);
  const start = parseHHmm(startTime);
  const end = parseHHmm(endTime);

  const startAt = day.hour(start.hour).minute(start.minute).second(0).millisecond(0);
  let endAt = day.hour(end.hour).minute(end.minute).second(0).millisecond(0);
  if (!endAt.isAfter(startAt)) endAt = endAt.add(1, "day");

  return {
    shiftDate,
    startAt: startAt.toDate(),
    dueAt: startAt.add(toleranceMinutes, "minute").toDate(),
    endAt: endAt.toDate(),
  };
};

/** @description Fecha de hoy (YYYY-MM-DD) en la zona horaria operativa. */
export const todayShiftDate = (tz: string = DEFAULT_TIMEZONE): string =>
  dayjs().tz(tz).format(SHIFT_DATE_FORMAT);

/** @description Suma días a una fecha YYYY-MM-DD. */
export const addDaysToShiftDate = (shiftDate: string, days: number): string =>
  dayjs(shiftDate, SHIFT_DATE_FORMAT).add(days, "day").format(SHIFT_DATE_FORMAT);

/** @description Día de la semana (0 = domingo) de una fecha YYYY-MM-DD. */
export const shiftDateWeekday = (shiftDate: string): number =>
  dayjs(shiftDate, SHIFT_DATE_FORMAT).day();

/**
 * @description Convierte YYYY-MM-DD al `Date` que Prisma guarda en columnas
 * `@db.Date` (medianoche UTC), evitando corrimientos por zona horaria.
 */
export const shiftDateToDb = (shiftDate: string): Date =>
  new Date(`${shiftDate}T00:00:00.000Z`);

/** @description Inverso de `shiftDateToDb`. */
export const shiftDateFromDb = (value: Date): string => value.toISOString().slice(0, 10);

/**
 * @description Hora "HH:mm" de un instante en la zona operativa y su
 * diferencia en minutos contra el inicio del turno (positivo = tarde).
 */
export const minutesLateAgainstStart = (
  entryTime: string,
  instance: IShiftInstance,
  tz: string = DEFAULT_TIMEZONE,
): number => {
  const startLocal: Dayjs = dayjs(instance.startAt).tz(tz);
  const entry = parseHHmm(entryTime);
  let entryAt = startLocal.hour(entry.hour).minute(entry.minute);
  // Entrada registrada "antes de medianoche" para un turno que inicia de
  // madrugada (o viceversa): elegimos el instante más cercano al inicio.
  const diff = entryAt.diff(startLocal, "minute");
  if (diff > 12 * 60) entryAt = entryAt.subtract(1, "day");
  if (diff < -12 * 60) entryAt = entryAt.add(1, "day");
  return entryAt.diff(startLocal, "minute");
};

/**
 * @description Fecha de inicio del turno que está en curso (o el de hoy si
 * ninguno está en curso). Un nocturno 19:00-07:00 consultado a las 02:00
 * pertenece al turno que inició AYER.
 */
export const currentShiftDateFor = (
  startTime: string,
  endTime: string,
  now: Date = new Date(),
  tz: string = DEFAULT_TIMEZONE,
): string => {
  const today = todayShiftDate(tz);
  const yesterday = addDaysToShiftDate(today, -1);
  const previous = getShiftInstance(yesterday, startTime, endTime, 0, tz);
  return now >= previous.startAt && now < previous.endAt ? yesterday : today;
};
