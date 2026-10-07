import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ROLE_CLIENT, ROLE_GUARD } from "@src/core/config/constants";
import { addDaysToShiftDate, todayShiftDate } from "@src/core/utils/shift-instance.utils";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);
jest.setTimeout(30000);

interface IAgendaItemBody {
  type: string;
  status: string;
  planId: string;
  shiftDate: string;
  guard: { id: string } | null;
}

describe("Programación de turnos y agenda (Integración)", () => {
  let fx: ISupervisionFixture;
  let planId: string;

  beforeAll(async () => {
    fx = await createSupervisionFixture("plan");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  const currentAgenda = async () => {
    const res = await request(app)
      .get(`/api/v1/shift-plans/agenda/current?clientId=${fx.clientId}`)
      .set("user", fx.adminHeader);
    expect(res.status).toBe(200);
    return res.body.data as { items: IAgendaItemBody[]; handoverSummary: { compliancePercent: number | null } };
  };

  it("debe crear la programación de un turno para el cliente", async () => {
    const res = await request(app)
      .post("/api/v1/shift-plans")
      .set("user", fx.adminHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId, toleranceMinutes: 15 });

    expect(res.status).toBe(201);
    expect(res.body.data.requireHandover).toBe(true);
    expect(res.body.data.requireUniform).toBe(true);
    expect(res.body.data.daysOfWeek).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(res.body.data.guardsCount).toBe(1);
    planId = res.body.data.id;
  });

  it("debe rechazar con 409 programar dos veces el mismo turno", async () => {
    const res = await request(app)
      .post("/api/v1/shift-plans")
      .set("user", fx.adminHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("debe rechazar un plan que no exige nada", async () => {
    const res = await request(app)
      .post("/api/v1/shift-plans")
      .set("user", fx.adminHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId, requireHandover: false, requireUniform: false });
    expect(res.status).toBe(400);
  });

  it("debe negar a un guardia configurar la programación (403)", async () => {
    const res = await request(app)
      .post("/api/v1/shift-plans")
      .set("user", fx.guardHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId });
    expect(res.status).toBe(403);
  });

  it("la agenda en curso debe mostrar la entrega y el uniforme vencidos", async () => {
    const agenda = await currentAgenda();
    // El turno de prueba inició hace 2 h: su instancia en curso es la primera
    // (puede haber otra posterior aún no iniciada si el turno cruza medianoche).
    const shiftDate = agenda.items.find((i) => i.planId === planId)!.shiftDate;
    const mine = agenda.items.filter((i) => i.planId === planId && i.shiftDate === shiftDate);
    const handover = mine.find((i) => i.type === "HANDOVER");
    const uniform = mine.find((i) => i.type === "UNIFORM");

    expect(handover?.status).toBe("OVERDUE");
    expect(uniform?.status).toBe("OVERDUE");
    expect(uniform?.guard?.id).toBe(fx.guardId);
  });

  it("al registrar entrega y uniforme la agenda debe quedar cumplida", async () => {
    const before = await currentAgenda();
    const shiftDate = before.items.find((i) => i.planId === planId)!.shiftDate;

    const handover = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({
        clientId: fx.clientId,
        scheduleId: fx.scheduleId,
        shiftDate,
        checklist: [{ key: "radios", ok: true }],
        elements: [{ guardId: fx.guardId, entryTime: fx.scheduleStart }],
      });
    expect(handover.status).toBe(201);

    const uniform = await request(app)
      .post("/api/v1/uniform-checks")
      .set("user", fx.adminHeader)
      .send({ guardId: fx.guardId, items: [{ key: "pantalon", ok: true }] });
    expect(uniform.status).toBe(201);
    expect(uniform.body.data.shiftDate).toBe(shiftDate);

    const after = await currentAgenda();
    const mine = after.items.filter((i) => i.planId === planId && i.shiftDate === shiftDate);
    expect(mine.length).toBe(2);
    expect(mine.every((i) => i.status === "DONE")).toBe(true);
  });

  it("un usuario cliente solo debe ver la programación de su cliente", async () => {
    const res = await request(app).get("/api/v1/shift-plans").set("user", fx.clientHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((p: { clientId: string }) => p.clientId === fx.clientId)).toBe(true);
  });

  it("debe actualizar días y tolerancia, y validar el rango", async () => {
    const ok = await request(app)
      .put(`/api/v1/shift-plans/${planId}`)
      .set("user", fx.adminHeader)
      .send({ daysOfWeek: [5, 1, 1], toleranceMinutes: 45 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.daysOfWeek).toEqual([1, 5]);
    expect(ok.body.data.toleranceMinutes).toBe(45);

    const bad = await request(app)
      .put(`/api/v1/shift-plans/${planId}`)
      .set("user", fx.adminHeader)
      .send({ toleranceMinutes: 999 });
    expect(bad.status).toBe(400);
  });

  it("debe eliminar el plan y permitir reprogramarlo después", async () => {
    const del = await request(app).delete(`/api/v1/shift-plans/${planId}`).set("user", fx.adminHeader);
    expect(del.status).toBe(200);

    const again = await request(app)
      .post("/api/v1/shift-plans")
      .set("user", fx.adminHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId, requireUniform: false });
    expect(again.status).toBe(201);
    expect(again.body.data.id).toBe(planId);
    expect(again.body.data.requireUniform).toBe(false);
  });
});

/**
 * `GET /shift-plans/agenda` (un día concreto).
 *
 * Se usa un turno propio 08:00-20:00 con tolerancia 0 para que el estado sea
 * determinista a cualquier hora: el turno de AYER siempre está terminado
 * (MISSED) y el de hoy se valida sólo por forma, sin depender del reloj.
 */
describe("Agenda diaria de programación (Integración)", () => {
  let fx: ISupervisionFixture;
  let scheduleId: string;
  let guardId: string;
  let planId: string;
  let otroClientId: string;

  const otroClienteHeader = () =>
    JSON.stringify({ id: fx.adminId, name: "Cliente ajeno", username: "ajeno", role: ROLE_CLIENT, clientId: otroClientId });
  const clienteSinClienteHeader = () =>
    JSON.stringify({ id: fx.adminId, name: "Cliente", username: "cliente", role: ROLE_CLIENT, clientId: null });

  beforeAll(async () => {
    fx = await createSupervisionFixture("agenda-diaria");
    const stamp = Date.now();

    const schedule = await prismaClient.schedule.create({
      data: { name: `Turno Agenda ${stamp}`, startTime: "08:00", endTime: "20:00" },
    });
    scheduleId = schedule.id;

    const guardRole = await prismaClient.role.findUnique({ where: { name: ROLE_GUARD }, select: { id: true } });
    if (!guardRole) throw new Error("Se requiere el rol GUARD en la base de pruebas");

    const guard = await prismaClient.user.create({
      data: {
        name: "Guardia",
        lastName: `Agenda ${stamp}`,
        username: `guardia.agenda.${stamp}`.toLowerCase(),
        password: "x",
        roleId: guardRole.id,
        clientId: fx.clientId,
        scheduleId,
      },
    });
    guardId = guard.id;

    const plan = await prismaClient.shiftPlan.create({
      data: {
        clientId: fx.clientId,
        scheduleId,
        requireHandover: true,
        requireUniform: true,
        toleranceMinutes: 0,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
    });
    planId = plan.id;

    const otroCliente = await prismaClient.client.create({ data: { name: `Cliente Ajeno ${stamp}` } });
    otroClientId = otroCliente.id;
  });

  afterAll(async () => {
    await prismaClient.shiftPlan.deleteMany({ where: { clientId: fx.clientId } }).catch(() => {});
    await prismaClient.user.delete({ where: { id: guardId } }).catch(() => {});
    await prismaClient.schedule.delete({ where: { id: scheduleId } }).catch(() => {});
    await prismaClient.client.delete({ where: { id: otroClientId } }).catch(() => {});
    await fx.cleanup();
  });

  it("debe devolver la agenda de hoy con la entrega y el uniforme del turno", async () => {
    const res = await request(app)
      .get(`/api/v1/shift-plans/agenda?clientId=${fx.clientId}`)
      .set("user", fx.adminHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messages).toEqual(["Success"]);

    const data = res.body.data;
    expect(data.dates).toEqual([todayShiftDate()]);
    expect(data.generatedAt).toBeDefined();
    expect(data.items).toHaveLength(2);

    const entrega = data.items.find((i: { type: string }) => i.type === "HANDOVER");
    expect(entrega.planId).toBe(planId);
    expect(entrega.guard).toBeNull();
    expect(entrega.record).toBeNull();
    expect(entrega.client.id).toBe(fx.clientId);
    expect(entrega.schedule.id).toBe(scheduleId);
    expect(entrega.shiftDate).toBe(todayShiftDate());

    const uniforme = data.items.find((i: { type: string }) => i.type === "UNIFORM");
    expect(uniforme.planId).toBe(planId);
    expect(uniforme.guard.id).toBe(guardId);
    expect(uniforme.schedule.id).toBe(scheduleId);

    expect(data.summary.total).toBe(2);
    expect(data.handoverSummary.total).toBe(1);
    expect(data.uniformSummary.total).toBe(1);
  });

  it("debe marcar como perdidos los compromisos de un turno que ya terminó (ayer)", async () => {
    const ayer = addDaysToShiftDate(todayShiftDate(), -1);
    const res = await request(app)
      .get(`/api/v1/shift-plans/agenda?date=${ayer}&clientId=${fx.clientId}`)
      .set("user", fx.adminHeader);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.dates).toEqual([ayer]);
    expect(data.items).toHaveLength(2);
    expect(data.items.every((i: { status: string }) => i.status === "MISSED")).toBe(true);
    expect(data.summary).toEqual({
      total: 2,
      done: 0,
      inWindow: 0,
      overdue: 0,
      missed: 2,
      upcoming: 0,
      compliancePercent: 0,
    });

    const entrega = data.items.find((i: { type: string }) => i.type === "HANDOVER");
    expect(entrega.planId).toBe(planId);
    expect(new Date(entrega.endAt).getTime()).toBeLessThan(Date.now());
    expect(new Date(entrega.startAt).getTime()).toBeLessThanOrEqual(new Date(entrega.dueAt).getTime());
  });

  it("un usuario cliente sólo ve la agenda de su cliente", async () => {
    const propio = await request(app).get("/api/v1/shift-plans/agenda").set("user", fx.clientHeader);
    expect(propio.status).toBe(200);
    expect(propio.body.data.dates).toEqual([todayShiftDate()]);
    expect(propio.body.data.items.length).toBeGreaterThan(0);
    expect(propio.body.data.items.every((i: { client: { id: string } }) => i.client.id === fx.clientId)).toBe(true);
    expect(propio.body.data.items.some((i: { planId: string }) => i.planId === planId)).toBe(true);

    // Un cliente distinto (sin programación) no ve nada del cliente de prueba.
    const ajeno = await request(app).get("/api/v1/shift-plans/agenda").set("user", otroClienteHeader());
    expect(ajeno.status).toBe(200);
    expect(ajeno.body.data.items).toHaveLength(0);
    expect(ajeno.body.data.items.some((i: { planId: string }) => i.planId === planId)).toBe(false);

    // El ADMIN puede filtrar por el cliente ajeno: tampoco aparece el plan.
    const adminAjeno = await request(app)
      .get(`/api/v1/shift-plans/agenda?clientId=${otroClientId}`)
      .set("user", fx.adminHeader);
    expect(adminAjeno.status).toBe(200);
    expect(adminAjeno.body.data.items).toHaveLength(0);
  });

  it("debe rechazar una fecha con formato inválido", async () => {
    const res = await request(app)
      .get("/api/v1/shift-plans/agenda?date=01-01-2026")
      .set("user", fx.adminHeader);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.messages.join(" ")).toContain("query.date");
  });

  it("debe rechazar un clientId que no es UUID", async () => {
    const res = await request(app)
      .get("/api/v1/shift-plans/agenda?clientId=no-es-uuid")
      .set("user", fx.adminHeader);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.messages.join(" ")).toContain("query.clientId");
  });

  it("debe negar la agenda a un guardia", async () => {
    const res = await request(app).get("/api/v1/shift-plans/agenda").set("user", fx.guardHeader);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("debe negar la agenda a un usuario cliente sin cliente asignado", async () => {
    const res = await request(app).get("/api/v1/shift-plans/agenda").set("user", clienteSinClienteHeader());

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.messages.join(" ")).toContain("cliente asignado");
  });
});
