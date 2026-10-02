import request from "supertest";
import { app } from "@src/index";
import { UNIFORM_CHECKLIST } from "@src/core/config/constants";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);

jest.setTimeout(30000);

describe("Revisión de uniforme (Integración)", () => {
  let fx: ISupervisionFixture;
  let checkId: string;

  beforeAll(async () => {
    fx = await createSupervisionFixture("uniforme");
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("debe exponer el catálogo y el umbral de cumplimiento", async () => {
    const res = await request(app).get("/api/v1/uniform-checks/catalog").set("user", fx.adminHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(UNIFORM_CHECKLIST.length);
    expect(typeof res.body.data.minCompliantScore).toBe("number");
  });

  it("debe registrar la revisión con puntaje y tomar cliente/horario del guardia", async () => {
    const allButOne = UNIFORM_CHECKLIST.slice(1).map((i) => ({ key: i.key, ok: true }));
    const res = await request(app)
      .post("/api/v1/uniform-checks")
      .set("user", fx.adminHeader)
      .send({ guardId: fx.guardId, shiftDate: "2026-09-20", items: allButOne, notes: "Falta pantalón reglamentario" });

    expect(res.status).toBe(201);
    const data = res.body.data;
    checkId = data.id;
    expect(data.score).toBe(Math.round(((UNIFORM_CHECKLIST.length - 1) / UNIFORM_CHECKLIST.length) * 100));
    expect(data.compliant).toBe(true);
    expect(data.items).toHaveLength(UNIFORM_CHECKLIST.length);
    expect(data.client.id).toBe(fx.clientId);
    expect(data.schedule.id).toBe(fx.scheduleId);
    expect(data.evaluatedBy.id).toBe(fx.adminId);
  });

  it("debe marcar como no cumple un uniforme incompleto", async () => {
    const res = await request(app)
      .post("/api/v1/uniform-checks")
      .set("user", fx.adminHeader)
      .send({ guardId: fx.guardId, shiftDate: "2026-09-21", items: [{ key: "botas", ok: true }] });
    expect(res.status).toBe(201);
    expect(res.body.data.compliant).toBe(false);
  });

  it("debe rechazar claves desconocidas y guardias inexistentes", async () => {
    const badKey = await request(app)
      .post("/api/v1/uniform-checks")
      .set("user", fx.adminHeader)
      .send({ guardId: fx.guardId, items: [{ key: "capa", ok: true }] });
    expect(badKey.status).toBe(400);

    const noGuard = await request(app)
      .post("/api/v1/uniform-checks")
      .set("user", fx.adminHeader)
      .send({ guardId: "00000000-0000-4000-8000-000000000000", items: [] });
    expect(noGuard.status).toBe(404);
  });

  it("debe filtrar por cumplimiento en el datatable", async () => {
    const res = await request(app)
      .post("/api/v1/uniform-checks/datatable")
      .set("user", fx.adminHeader)
      .send({ page: 1, limit: 10, filters: { clientId: fx.clientId, compliant: "false" } });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.rows[0].compliant).toBe(false);
  });

  it("debe devolver el detalle y respetar el alcance del usuario cliente", async () => {
    const own = await request(app).get(`/api/v1/uniform-checks/${checkId}`).set("user", fx.clientHeader);
    expect(own.status).toBe(200);

    const otherClient = JSON.stringify({ ...JSON.parse(fx.clientHeader), clientId: "00000000-0000-4000-8000-000000000000" });
    const foreign = await request(app).get(`/api/v1/uniform-checks/${checkId}`).set("user", otherClient);
    expect(foreign.status).toBe(404);
  });
});
