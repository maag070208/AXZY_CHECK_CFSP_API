import {
  currentShiftDateFor,
  getShiftInstance,
  minutesLateAgainstStart,
} from "./shift-instance.utils";
import { resolveAgendaStatus } from "@src/modules/shift-plans/agenda.service";

const TZ = "America/Tijuana";

describe("Utilidades de turnos", () => {
  it("calcula un turno diurno dentro del mismo día", () => {
    const i = getShiftInstance("2026-10-01", "07:00", "19:00", 30, TZ);
    expect(i.startAt.toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(i.dueAt.toISOString()).toBe("2026-10-01T14:30:00.000Z");
    expect(i.endAt.toISOString()).toBe("2026-10-02T02:00:00.000Z");
  });

  it("un turno nocturno termina al día siguiente", () => {
    const i = getShiftInstance("2026-10-01", "19:00", "07:00", 15, TZ);
    expect(i.startAt.toISOString()).toBe("2026-10-02T02:00:00.000Z");
    expect(i.endAt.toISOString()).toBe("2026-10-02T14:00:00.000Z");
  });

  it("mide la puntualidad aunque la entrada sea antes de medianoche", () => {
    const night = getShiftInstance("2026-10-01", "00:00", "08:00", 10, TZ);
    expect(minutesLateAgainstStart("23:50", night, TZ)).toBe(-10);
    expect(minutesLateAgainstStart("00:25", night, TZ)).toBe(25);
  });

  it("asigna la madrugada al turno nocturno que inició ayer", () => {
    // 02:00 hora de Tijuana del 2 de octubre = 09:00 UTC
    const at = new Date("2026-10-02T09:00:00.000Z");
    jest.useFakeTimers().setSystemTime(at);
    expect(currentShiftDateFor("19:00", "07:00", at, TZ)).toBe("2026-10-01");
    expect(currentShiftDateFor("07:00", "19:00", at, TZ)).toBe("2026-10-02");
    jest.useRealTimers();
  });

  it("resuelve el estado de un compromiso según la hora", () => {
    const i = getShiftInstance("2026-10-01", "07:00", "19:00", 30, TZ);
    expect(resolveAgendaStatus(false, i, new Date("2026-10-01T13:00:00Z"))).toBe("UPCOMING");
    expect(resolveAgendaStatus(false, i, new Date("2026-10-01T14:10:00Z"))).toBe("IN_WINDOW");
    expect(resolveAgendaStatus(false, i, new Date("2026-10-01T15:00:00Z"))).toBe("OVERDUE");
    expect(resolveAgendaStatus(false, i, new Date("2026-10-02T03:00:00Z"))).toBe("MISSED");
    expect(resolveAgendaStatus(true, i, new Date("2026-10-02T03:00:00Z"))).toBe("DONE");
  });
});
