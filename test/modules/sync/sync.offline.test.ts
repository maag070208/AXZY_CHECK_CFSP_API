import crypto from "crypto";
import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);

jest.setTimeout(30000);

/**
 * Escenarios offline del protocolo de sincronización (WatermelonDB):
 * lo que un guardia captura sin red y sube después.
 */
describe("Sincronización offline (Integración)", () => {
  let fx: ISupervisionFixture;
  let other: ISupervisionFixture;
  let locationId: string;
  let otherLocationId: string;
  const roundId = crypto.randomUUID();
  const kardexId = crypto.randomUUID();
  const incidentId = crypto.randomUUID();

  const push = (header: string, changes: Record<string, unknown>) =>
    request(app).post("/api/v1/sync").set("user", header).set("x-bypass-version-check", "true").send({ changes });
  const pull = (header: string, lastPulledAt = 0) =>
    request(app).get(`/api/v1/sync?last_pulled_at=${lastPulledAt}`).set("user", header).set("x-bypass-version-check", "true");

  beforeAll(async () => {
    fx = await createSupervisionFixture("sync");
    other = await createSupervisionFixture("sync-otro");
    const mk = async (clientId: string, name: string) =>
      (await prismaClient.location.create({ data: { clientId, name } })).id;
    locationId = await mk(fx.clientId, `Punto sync ${Date.now()}`);
    otherLocationId = await mk(other.clientId, `Punto ajeno ${Date.now()}`);
  });

  afterAll(async () => {
    await prismaClient.kardex.deleteMany({ where: { locationId: { in: [locationId, otherLocationId] } } });
    await prismaClient.incident.deleteMany({ where: { id: incidentId } });
    await prismaClient.round.deleteMany({ where: { guardId: fx.guardId } });
    await prismaClient.location.deleteMany({ where: { id: { in: [locationId, otherLocationId] } } });
    await fx.cleanup();
    await other.cleanup();
  });

  it("el pull no debe incluir contraseñas ni tokens de los usuarios", async () => {
    const res = await pull(fx.adminHeader);
    expect(res.status).toBe(200);
    const users = [...res.body.data.changes.user.created, ...res.body.data.changes.user.updated];
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u: Record<string, unknown>) => "password" in u || "fcmToken" in u)).toBe(false);
  });

  it("un guardia solo debe descargar los datos de su cliente", async () => {
    const res = await pull(fx.guardHeader);
    expect(res.status).toBe(200);
    const locs = res.body.data.changes.location.created.map((l: { id: string }) => l.id);
    expect(locs).toContain(locationId);
    expect(locs).not.toContain(otherLocationId);
    const clients = res.body.data.changes.client.created.map((c: { id: string }) => c.id);
    expect(clients).toEqual([fx.clientId]);
  });

  it("debe aplicar ronda, escaneo e incidencia capturados offline conservando su fecha real", async () => {
    const offlineAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // hace 3 h, sin red
    const res = await push(fx.guardHeader, {
      round: {
        created: [{ id: roundId, guardId: fx.guardId, clientId: fx.clientId, startTime: offlineAt, status: "IN_PROGRESS", createdAt: offlineAt }],
        updated: [],
        deleted: [],
      },
      kardex: {
        created: [{ id: kardexId, userId: fx.guardId, locationId, timestamp: offlineAt, notes: "sin red", media: '["https://cdn/x.jpg"]', scanType: "RECURRING", createdAt: offlineAt, isTampered: true }],
        updated: [],
        deleted: [],
      },
      incident: {
        created: [{ id: incidentId, guardId: fx.guardId, title: "Puerta abierta", clientId: fx.clientId, status: "ATTENDED", resolvedById: fx.guardId, media: "[]", createdAt: offlineAt }],
        updated: [],
        deleted: [],
      },
    });
    expect(res.status).toBe(200);

    const incident = await prismaClient.incident.findUnique({ where: { id: incidentId } });
    expect(incident?.status).toBe("PENDING"); // el guardia no puede auto-atenderla
    expect(incident?.resolvedById).toBeNull();
    expect(incident?.createdAt.toISOString()).toBe(offlineAt);
    expect(Date.now() - (incident?.updatedAt.getTime() ?? 0)).toBeLessThan(60_000);

    const kardex = await prismaClient.kardex.findUnique({ where: { id: kardexId } });
    expect(kardex?.media).toEqual(["https://cdn/x.jpg"]);
    expect(kardex?.timestamp.toISOString()).toBe(offlineAt);
  });

  it("reenviar el mismo lote no debe duplicar y debe aplicar el cierre de ronda", async () => {
    const endAt = new Date().toISOString();
    const res = await push(fx.guardHeader, {
      round: { created: [{ id: roundId, guardId: fx.guardId, status: "IN_PROGRESS" }], updated: [], deleted: [] },
      kardex: { created: [{ id: kardexId, userId: fx.guardId, locationId, timestamp: endAt }], updated: [], deleted: [] },
    });
    expect(res.status).toBe(200);
    const closed = await push(fx.guardHeader, {
      round: { created: [], updated: [{ id: roundId, guardId: fx.guardId, status: "COMPLETED", endTime: endAt }], deleted: [] },
    });
    expect(closed.status).toBe(200);
    expect(await prismaClient.kardex.count({ where: { id: kardexId } })).toBe(1);
    const round = await prismaClient.round.findUnique({ where: { id: roundId } });
    expect(round?.status).toBe("COMPLETED");
  });

  it("un 'updated' de algo que el servidor no tiene debe crearse en vez de romper la sincronización", async () => {
    const id = crypto.randomUUID();
    const res = await push(fx.guardHeader, {
      kardex: { created: [], updated: [{ id, userId: fx.guardId, locationId, timestamp: new Date().toISOString() }], deleted: [] },
    });
    expect(res.status).toBe(200);
    expect(await prismaClient.kardex.count({ where: { id } })).toBe(1);
  });

  it("debe rechazar registros a nombre de otro guardia sin aplicar nada del lote", async () => {
    const mine = crypto.randomUUID();
    const res = await push(fx.guardHeader, {
      kardex: {
        created: [
          { id: mine, userId: fx.guardId, locationId, timestamp: new Date().toISOString() },
          { id: crypto.randomUUID(), userId: other.guardId, locationId: otherLocationId, timestamp: new Date().toISOString() },
        ],
        updated: [],
        deleted: [],
      },
    });
    // El lote es atómico: no se aplica NADA (ni siquiera el registro legítimo).
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await prismaClient.kardex.count({ where: { id: mine } })).toBe(0);

    // Pero el rechazo es diagnosticable: se indica el registro exacto y el motivo.
    const rechazados = res.body.data.rejected as Array<{ table: string; id: string; action: string; reason: string }>;
    expect(rechazados).toHaveLength(1);
    expect(rechazados[0].table).toBe("kardex");
    expect(rechazados[0].action).toBe("create");
    expect(rechazados[0].reason).toContain("otro usuario");
  });

  it("un guardia no debe poder modificar usuarios ni escalar su rol (tabla no permitida)", async () => {
    const adminRole = await prismaClient.role.findUnique({ where: { name: "ADMIN" } });
    const res = await push(fx.guardHeader, {
      user: { created: [], updated: [{ id: fx.guardId, roleId: adminRole?.id }], deleted: [] },
    });
    // Antes se descartaba en silencio (200). Ahora se reporta y no se aplica.
    expect(res.status).toBe(400);
    expect(res.body.data.ignoredTables).toContain("user");
    const guard = await prismaClient.user.findUnique({ where: { id: fx.guardId }, include: { role: true } });
    expect(guard?.role.name).toBe("GUARD");
  });

  it("supervisión debe poder registrar entrega de turno y uniforme offline (servidor calcula puntualidad y puntaje)", async () => {
    const handoverId = crypto.randomUUID();
    const uniformId = crypto.randomUUID();
    const shiftDate = "2026-09-10";
    const res = await push(fx.adminHeader, {
      shiftHandover: {
        created: [{
          id: handoverId, clientId: fx.clientId, scheduleId: fx.scheduleId, shiftDate,
          checklist: JSON.stringify([{ key: "radios", ok: true }]), reportedToAdmin: false,
          elements: JSON.stringify([{ guardId: fx.guardId, entryTime: fx.scheduleStart }]),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        }],
        updated: [], deleted: [],
      },
      uniformCheck: {
        created: [{ id: uniformId, guardId: fx.guardId, shiftDate, items: JSON.stringify([{ key: "botas", ok: true }]), notes: "offline" }],
        updated: [], deleted: [],
      },
    });
    expect(res.status).toBe(200);

    const handover = await prismaClient.shiftHandover.findUnique({ where: { id: handoverId }, include: { elements: true } });
    expect(handover?.createdById).toBe(fx.adminId);
    expect(handover?.elements[0].punctual).toBe(true);
    expect(Array.isArray(handover?.checklist)).toBe(true);
    const uniform = await prismaClient.uniformCheck.findUnique({ where: { id: uniformId } });
    expect(uniform?.compliant).toBe(false);
    expect(uniform?.evaluatedById).toBe(fx.adminId);

    // Reenvío idempotente.
    const again = await push(fx.adminHeader, { uniformCheck: { created: [{ id: uniformId, guardId: fx.guardId, items: "[]" }], updated: [], deleted: [] } });
    expect(again.status).toBe(200);
    expect(await prismaClient.uniformCheck.count({ where: { id: uniformId } })).toBe(1);

    // El pull trae la entrega con sus elementos y los catálogos para los formularios offline.
    const pulled = await pull(fx.adminHeader);
    const h = pulled.body.data.changes.shiftHandover.created.find((x: { id: string }) => x.id === handoverId);
    expect(h.elements).toHaveLength(1);
    expect(pulled.body.data.catalogs.uniform.items.length).toBeGreaterThan(0);
  });

  it("un guardia no debe poder registrar entregas ni uniformes por sincronización", async () => {
    const res = await push(fx.guardHeader, {
      uniformCheck: { created: [{ id: crypto.randomUUID(), guardId: other.guardId, items: "[]" }], updated: [], deleted: [] },
    });
    expect(res.status).toBe(400);
    expect(res.body.data.rejected[0].reason).toContain("Tu rol no puede registrar");
    expect(await prismaClient.uniformCheck.count({ where: { guardId: other.guardId } })).toBe(0);
  });

  it("una entrega offline inválida debe rechazarse indicando el registro exacto", async () => {
    const idInvalido = crypto.randomUUID();
    const res = await push(fx.adminHeader, {
      shiftHandover: {
        created: [{ id: idInvalido, clientId: fx.clientId, scheduleId: fx.scheduleId, shiftDate: "2026-09-11", elements: "[]" }],
        updated: [], deleted: [],
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    const rechazado = res.body.data.rejected.find((r: { id: string }) => r.id === idInvalido);
    expect(rechazado).toBeDefined();
    expect(rechazado.reason).toContain("entrega de turno");
    expect(await prismaClient.shiftHandover.count({ where: { id: idInvalido } })).toBe(0);
  });

  it("las bajas lógicas de ubicaciones deben llegar como eliminadas", async () => {
    const before = Date.now() - 1000;
    await prismaClient.location.delete({ where: { id: locationId } }); // extensión: baja lógica
    const res = await pull(fx.guardHeader, before);
    expect(res.body.data.changes.location.deleted).toContain(locationId);
  });
});
