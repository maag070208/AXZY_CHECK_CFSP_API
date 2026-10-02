import request from "supertest";
import { app } from "@src/index";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);
jest.mock("@src/core/middlewares/token-validator.middleware", () =>
  require("../supervision.fixtures").tokenValidatorMock(),
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
