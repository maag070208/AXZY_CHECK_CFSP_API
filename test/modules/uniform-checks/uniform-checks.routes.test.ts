import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { UNIFORM_CHECKLIST } from "@src/core/config/constants";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);

jest.setTimeout(30000);

/** UUID válido que no existe en la base: sirve para probar recursos inexistentes. */
const UUID_INEXISTENTE = "00000000-0000-4000-8000-000000000000";

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

  describe("Eliminación de revisiones de uniforme", () => {
    const revisionesCreadas: string[] = [];

    const crearRevision = async (shiftDate: string): Promise<string> => {
      const res = await request(app)
        .post("/api/v1/uniform-checks")
        .set("user", fx.adminHeader)
        .send({
          guardId: fx.guardId,
          shiftDate,
          items: UNIFORM_CHECKLIST.map((i) => ({ key: i.key, ok: true })),
        });

      expect(res.status).toBe(201);
      revisionesCreadas.push(res.body.data.id);
      return res.body.data.id as string;
    };

    afterAll(async () => {
      await prismaClient.uniformCheck.deleteMany({ where: { id: { in: revisionesCreadas } } }).catch(() => {});
    });

    it("debe eliminar lógicamente la revisión y dejar de exponerla", async () => {
      const revisionId = await crearRevision("2026-09-25");

      const res = await request(app)
        .delete(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(res.body.data).toBe(true);

      // Borrado lógico: la fila permanece con deletedAt y ya no es consultable.
      const enDb = await prismaClient.uniformCheck.findUnique({ where: { id: revisionId } });
      expect(enDb).not.toBeNull();
      expect(enDb?.deletedAt).not.toBeNull();

      const detalle = await request(app)
        .get(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.adminHeader);
      expect(detalle.status).toBe(404);
    });

    it("debe responder 404 al eliminar una revisión inexistente", async () => {
      const res = await request(app)
        .delete(`/api/v1/uniform-checks/${UUID_INEXISTENTE}`)
        .set("user", fx.adminHeader);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Revisión de uniforme no encontrada");
    });

    it("debe responder 404 al eliminar dos veces la misma revisión", async () => {
      const revisionId = await crearRevision("2026-09-27");

      const primera = await request(app)
        .delete(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.adminHeader);
      expect(primera.status).toBe(200);

      const segunda = await request(app)
        .delete(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.adminHeader);
      expect(segunda.status).toBe(404);
      expect(segunda.body.success).toBe(false);
      expect(segunda.body.messages[0]).toBe("Revisión de uniforme no encontrada");
    });

    it("debe rechazar con 400 un id de revisión que no es UUID", async () => {
      const res = await request(app)
        .delete("/api/v1/uniform-checks/no-es-uuid")
        .set("user", fx.adminHeader);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toBe("Error de validación");
      expect(res.body.messages).toContain("params.id: ID de revisión inválido");
    });

    it("debe negar la eliminación a un guardia (403)", async () => {
      const revisionId = await crearRevision("2026-09-28");

      const res = await request(app)
        .delete(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.guardHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toContain("Permisos insuficientes");

      const enDb = await prismaClient.uniformCheck.findUnique({ where: { id: revisionId } });
      expect(enDb?.deletedAt).toBeNull();
    });

    it("debe negar la eliminación a un usuario cliente (403)", async () => {
      const revisionId = await crearRevision("2026-09-29");

      const res = await request(app)
        .delete(`/api/v1/uniform-checks/${revisionId}`)
        .set("user", fx.clientHeader);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.data).toBeNull();
      expect(res.body.messages[0]).toContain("Permisos insuficientes");

      const enDb = await prismaClient.uniformCheck.findUnique({ where: { id: revisionId } });
      expect(enDb?.deletedAt).toBeNull();
    });
  });
});
