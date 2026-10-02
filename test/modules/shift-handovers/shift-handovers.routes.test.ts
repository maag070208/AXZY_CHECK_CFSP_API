import dayjs from "dayjs";
import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);

jest.setTimeout(30000);

describe("Entregas de turno (Integración)", () => {
  let fx: ISupervisionFixture;
  let handoverId: string;
  const shiftDate = "2026-09-15";

  beforeAll(async () => {
    fx = await createSupervisionFixture("entrega");
    await prismaClient.shiftPlan.create({
      data: { clientId: fx.clientId, scheduleId: fx.scheduleId, toleranceMinutes: 10 },
    });
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  const lateEntry = () => dayjs(`2026-01-01 ${fx.scheduleStart}`).add(40, "minute").format("HH:mm");

  it("debe exponer el catálogo de equipo a verificar", async () => {
    const res = await request(app).get("/api/v1/shift-handovers/catalog").set("user", fx.adminHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { key: string }) => c.key)).toContain("radios");
  });

  it("debe registrar la entrega, normalizar el checklist y calcular la puntualidad", async () => {
    const res = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({
        clientId: fx.clientId,
        scheduleId: fx.scheduleId,
        shiftDate,
        credentialsCount: 4,
        novedades: "  Sin novedades relevantes  ",
        checklist: [
          { key: "radios", ok: true },
          { key: "keys", ok: true },
        ],
        reportedToAdmin: true,
        elements: [{ guardId: fx.guardId, entryTime: lateEntry(), observations: "Llegó tarde por tráfico" }],
      });

    expect(res.status).toBe(201);
    const data = res.body.data;
    handoverId = data.id;
    expect(data.shiftDate).toBe(shiftDate);
    expect(data.novedades).toBe("Sin novedades relevantes");
    expect(data.checklist).toHaveLength(6);
    expect(data.checklistOk).toBe(2);
    expect(data.elements[0].punctual).toBe(false);
    expect(data.lateCount).toBe(1);

    const stored = await prismaClient.shiftHandover.findUnique({ where: { id: handoverId } });
    expect(stored?.createdById).toBe(fx.adminId);
  });

  it("debe rechazar con 409 una segunda entrega del mismo turno y fecha", async () => {
    const res = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({
        clientId: fx.clientId,
        scheduleId: fx.scheduleId,
        shiftDate,
        elements: [{ guardId: fx.guardId, entryTime: fx.scheduleStart }],
      });
    expect(res.status).toBe(409);
  });

  it("debe validar elementos, horas y claves del checklist", async () => {
    const base = { clientId: fx.clientId, scheduleId: fx.scheduleId, shiftDate: "2026-09-16" };

    const noElements = await request(app).post("/api/v1/shift-handovers").set("user", fx.adminHeader).send({ ...base, elements: [] });
    expect(noElements.status).toBe(400);

    const badHour = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({ ...base, elements: [{ guardId: fx.guardId, entryTime: "25:00" }] });
    expect(badHour.status).toBe(400);

    const badKey = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({ ...base, checklist: [{ key: "lanzallamas", ok: true }], elements: [{ guardId: fx.guardId, entryTime: "07:00" }] });
    expect(badKey.status).toBe(400);

    const duplicated = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.adminHeader)
      .send({
        ...base,
        elements: [
          { guardId: fx.guardId, entryTime: "07:00" },
          { guardId: fx.guardId, entryTime: "07:05" },
        ],
      });
    expect(duplicated.status).toBe(400);
  });

  it("un guardia no debe poder registrar entregas (403)", async () => {
    const res = await request(app)
      .post("/api/v1/shift-handovers")
      .set("user", fx.guardHeader)
      .send({ clientId: fx.clientId, scheduleId: fx.scheduleId, shiftDate: "2026-09-17", elements: [] });
    expect(res.status).toBe(403);
  });

  it("debe listar en datatable filtrando por cliente y rango de fechas", async () => {
    const res = await request(app)
      .post("/api/v1/shift-handovers/datatable")
      .set("user", fx.clientHeader)
      .send({ page: 1, limit: 10, filters: { dateFrom: "2026-09-01", dateTo: "2026-09-30" } });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.rows[0].id).toBe(handoverId);
    expect(res.body.data.rows[0].elementsCount).toBe(1);
  });

  it("debe eliminar lógicamente la entrega", async () => {
    const del = await request(app).delete(`/api/v1/shift-handovers/${handoverId}`).set("user", fx.adminHeader);
    expect(del.status).toBe(200);
    const detail = await request(app).get(`/api/v1/shift-handovers/${handoverId}`).set("user", fx.adminHeader);
    expect(detail.status).toBe(404);
  });
});
