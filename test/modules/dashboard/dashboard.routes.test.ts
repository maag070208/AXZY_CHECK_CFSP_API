import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import {
  ROLE_CLIENT,
  ROLE_GUARD,
  ROLE_MAINTENANCE,
  ROLE_SHIFT,
} from "@src/core/config/constants";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);
jest.setTimeout(30000);

/** Tipos válidos del feed de actividad reciente (ver dashboard.dto.ts). */
const TIPOS_ACTIVIDAD = ["incident", "maintenance", "discipline", "panic", "round", "kardex"];

/**
 * Vistas del dashboard administrativo (integración contra Postgres real).
 *
 * `GET /dashboard/live` ya está cubierto en `live-dashboard.routes.test.ts`; aquí
 * se cubren overview, active-guards, pending-counts, recent-activity y
 * panic-alerts. El seed trae datos de otros clientes, así que las expectativas
 * se calculan contra la base con las MISMAS condiciones que el servicio.
 */
describe("Vistas del dashboard (Integración)", () => {
  let fx: ISupervisionFixture;
  let incidenteNuevoId: string;
  let incidenteMedioId: string;
  let incidenteViejoId: string;
  let mantenimientoId: string;
  let disciplinaId: string;
  let roundActivoId: string;
  let panicNuevoId: string;
  let panicViejoId: string;
  let panicSinClienteId: string;

  const clienteSinClienteHeader = () =>
    JSON.stringify({ id: fx.adminId, name: "Cliente", username: "cliente", role: ROLE_CLIENT, clientId: null });

  beforeAll(async () => {
    fx = await createSupervisionFixture("dashboard-vistas");
    // Línea de tiempo estrictamente ordenada (minutos hacia atrás) para que el
    // feed y las alertas tengan un orden determinista dentro del cliente.
    const base = Date.now();
    const hace = (minutos: number) => new Date(base - minutos * 60_000);

    const incidenteNuevo = await prismaClient.incident.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, title: "Incidencia nueva", createdAt: hace(0) },
    });
    const incidenteMedio = await prismaClient.incident.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, title: "Incidencia media", createdAt: hace(1) },
    });
    const incidenteViejo = await prismaClient.incident.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, title: "Incidencia vieja", createdAt: hace(2) },
    });
    incidenteNuevoId = incidenteNuevo.id;
    incidenteMedioId = incidenteMedio.id;
    incidenteViejoId = incidenteViejo.id;

    const mantenimiento = await prismaClient.maintenance.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, title: "Mantenimiento pendiente", createdAt: hace(5) },
    });
    mantenimientoId = mantenimiento.id;

    const disciplina = await prismaClient.guardDiscipline.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, createdById: fx.adminId, title: "Falta pendiente", createdAt: hace(6) },
    });
    disciplinaId = disciplina.id;
    const round = await prismaClient.round.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, status: "IN_PROGRESS" },
    });
    roundActivoId = round.id;

    const panicNuevo = await prismaClient.panicAlert.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, message: "Pánico nuevo", createdAt: hace(3) },
    });
    const panicViejo = await prismaClient.panicAlert.create({
      data: { guardId: fx.guardId, clientId: fx.clientId, message: "Pánico viejo", createdAt: hace(4) },
    });
    // Alerta sin cliente: el ADMIN la ve, un usuario RESDN no debe verla.
    const panicSinCliente = await prismaClient.panicAlert.create({
      data: { guardId: fx.guardId, clientId: null, message: "Pánico sin cliente", createdAt: hace(7) },
    });
    panicNuevoId = panicNuevo.id;
    panicViejoId = panicViejo.id;
    panicSinClienteId = panicSinCliente.id;
  });

  afterAll(async () => {
    await prismaClient.incident.deleteMany({ where: { guardId: fx.guardId } }).catch(() => {});
    await prismaClient.maintenance.deleteMany({ where: { guardId: fx.guardId } }).catch(() => {});
    await prismaClient.guardDiscipline.deleteMany({ where: { guardId: fx.guardId } }).catch(() => {});
    await prismaClient.round.deleteMany({ where: { guardId: fx.guardId } }).catch(() => {});
    await prismaClient.panicAlert.deleteMany({ where: { guardId: fx.guardId } }).catch(() => {});
    await fx.cleanup();
  });

  describe("GET /api/v1/dashboard/overview", () => {
    it("debe devolver los KPIs generales coherentes con la base de datos (ADMIN)", async () => {
      const res = await request(app).get("/api/v1/dashboard/overview").set("user", fx.adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);

      const data = res.body.data;
      expect(data.scope).toBe("ALL");
      expect(data.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const rolesOperativos = [ROLE_GUARD, ROLE_SHIFT, ROLE_MAINTENANCE];
      const [guards, shift, maintenance, activos, activosGuards, activosShift, activosMaint] = await Promise.all([
        prismaClient.user.count({ where: { active: true, softDelete: false, role: { name: ROLE_GUARD } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, role: { name: ROLE_SHIFT } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, role: { name: ROLE_MAINTENANCE } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, isLoggedIn: true, role: { name: { in: rolesOperativos } } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, isLoggedIn: true, role: { name: ROLE_GUARD } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, isLoggedIn: true, role: { name: ROLE_SHIFT } } }),
        prismaClient.user.count({ where: { active: true, softDelete: false, isLoggedIn: true, role: { name: ROLE_MAINTENANCE } } }),
      ]);
      const [clients, locations, assignments] = await Promise.all([
        prismaClient.client.count({ where: { active: true, softDelete: false } }),
        prismaClient.location.count({ where: { active: true, softDelete: false } }),
        prismaClient.assignment.count({ where: { deletedAt: null } }),
      ]);

      expect(data.totalBreakdown).toEqual({ guards, shift, maintenance });
      expect(data.totalGuards).toBe(guards + shift + maintenance);
      expect(data.activeBreakdown).toEqual({ total: activos, guards: activosGuards, shift: activosShift, maintenance: activosMaint });
      expect(data.activeGuardsNow).toBe(activos);
      expect(data.totalClients).toBe(clients);
      expect(data.totalLocations).toBe(locations);
      expect(data.totalAssignments).toBe(assignments);

      const [incidents, maintenances, disciplines, activeRounds, panicAlerts] = await Promise.all([
        prismaClient.incident.count({ where: { status: "PENDING", deletedAt: null } }),
        prismaClient.maintenance.count({ where: { status: "PENDING", deletedAt: null } }),
        prismaClient.guardDiscipline.count({ where: { status: "PENDING", deletedAt: null } }),
        prismaClient.round.count({ where: { status: "IN_PROGRESS" } }),
        prismaClient.panicAlert.count({ where: { status: "PENDING", deletedAt: null } }),
      ]);
      expect(data.pendingCounts).toEqual({ incidents, maintenances, disciplines, activeRounds, panicAlerts });
      expect(data.pendingCounts.incidents).toBeGreaterThanOrEqual(3);
    });

    it("debe acotar el resumen al cliente del usuario RESDN (scope CLIENT)", async () => {
      const res = await request(app).get("/api/v1/dashboard/overview").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scope).toBe("CLIENT");
      // El alcance se resuelve por la ubicación relacionada (Assignment no tiene
      // clientId propio) y los totales nunca son globales.
      expect(res.body.data.totalClients).toBe(1);
      expect(res.body.data.totalGuards).toBeGreaterThanOrEqual(1);
    });

    it("un usuario RESDN sin cliente asignado no ve datos (no recibe KPIs globales)", async () => {
      const res = await request(app).get("/api/v1/dashboard/overview").set("user", clienteSinClienteHeader());

      // Aislamiento: sin clientId asignado, un usuario RESDN no debe ver datos.
      expect(res.status).toBe(200);
      expect(res.body.data.scope).toBe("CLIENT");
      expect(res.body.data.totalClients).toBe(0);
      expect(res.body.data.totalLocations).toBe(0);
      expect(res.body.data.totalAssignments).toBe(0);
      expect(res.body.data.totalGuards).toBe(0);
    });
  });

  describe("GET /api/v1/dashboard/active-guards", () => {
    it("debe listar los guardias activos con su ronda en curso (ADMIN)", async () => {
      const res = await request(app).get("/api/v1/dashboard/active-guards").set("user", fx.adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(Array.isArray(res.body.data)).toBe(true);

      const mio = res.body.data.find((g: { id: string }) => g.id === fx.guardId);
      expect(mio).toBeDefined();
      expect(mio.role).toBe(ROLE_GUARD);
      expect(mio.clientId).toBe(fx.clientId);
      expect(mio.clientName).not.toBeNull();
      expect(mio.isLoggedIn).toBe(false);
      expect(mio.currentRoundId).toBe(roundActivoId);
      expect(mio.currentRoundStartTime).not.toBeNull();
      expect(mio.currentLocationName).toBeNull();
      expect(mio.lastKardexAt).toBeNull();
      expect(mio.lastKardexLocation).toBeNull();

      // El servicio ordena por sesión iniciada y luego por nombre.
      const flags = res.body.data.map((g: { isLoggedIn: boolean }) => g.isLoggedIn);
      expect(flags).toEqual([...flags].sort((a: boolean, b: boolean) => Number(b) - Number(a)));
    });

    it("debe reflejar el inicio de sesión del guardia en active-guards y overview", async () => {
      const antes = await request(app).get("/api/v1/dashboard/overview").set("user", fx.adminHeader);
      const logueadosAntes = antes.body.data.activeGuardsNow;

      await prismaClient.user.update({ where: { id: fx.guardId }, data: { isLoggedIn: true } });
      try {
        const res = await request(app).get("/api/v1/dashboard/active-guards").set("user", fx.adminHeader);
        expect(res.status).toBe(200);
        const mio = res.body.data.find((g: { id: string }) => g.id === fx.guardId);
        expect(mio.isLoggedIn).toBe(true);

        const despues = await request(app).get("/api/v1/dashboard/overview").set("user", fx.adminHeader);
        expect(despues.body.data.activeGuardsNow).toBe(logueadosAntes + 1);
      } finally {
        await prismaClient.user.update({ where: { id: fx.guardId }, data: { isLoggedIn: false } }).catch(() => {});
      }
    });

    it("un usuario cliente sólo ve guardias de su cliente", async () => {
      const res = await request(app).get("/api/v1/dashboard/active-guards").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((g: { clientId: string }) => g.clientId === fx.clientId)).toBe(true);
      expect(res.body.data.some((g: { id: string }) => g.id === fx.guardId)).toBe(true);
    });
  });

  describe("GET /api/v1/dashboard/pending-counts", () => {
    it("debe incrementar el conteo de pendientes al crear registros nuevos", async () => {
      const antes = await request(app).get("/api/v1/dashboard/pending-counts").set("user", fx.adminHeader);
      expect(antes.status).toBe(200);

      const incidente = await prismaClient.incident.create({
        data: { guardId: fx.guardId, clientId: fx.clientId, title: "Incidencia temporal" },
      });
      const mantenimiento = await prismaClient.maintenance.create({
        data: { guardId: fx.guardId, clientId: fx.clientId, title: "Mantenimiento temporal" },
      });
      const disciplina = await prismaClient.guardDiscipline.create({
        data: { guardId: fx.guardId, clientId: fx.clientId, createdById: fx.adminId, title: "Disciplina temporal" },
      });
      const ronda = await prismaClient.round.create({
        data: { guardId: fx.guardId, clientId: fx.clientId, status: "IN_PROGRESS" },
      });
      const panico = await prismaClient.panicAlert.create({
        data: { guardId: fx.guardId, clientId: fx.clientId, message: "Pánico temporal" },
      });

      try {
        const despues = await request(app).get("/api/v1/dashboard/pending-counts").set("user", fx.adminHeader);
        expect(despues.status).toBe(200);
        expect(despues.body.success).toBe(true);
        expect(despues.body.messages).toEqual(["Success"]);
        expect(despues.body.data.incidents).toBe(antes.body.data.incidents + 1);
        expect(despues.body.data.maintenances).toBe(antes.body.data.maintenances + 1);
        expect(despues.body.data.disciplines).toBe(antes.body.data.disciplines + 1);
        expect(despues.body.data.activeRounds).toBe(antes.body.data.activeRounds + 1);
        expect(despues.body.data.panicAlerts).toBe(antes.body.data.panicAlerts + 1);

        // Efecto real en la base: los registros temporales existen.
        const enDb = await prismaClient.incident.findUnique({ where: { id: incidente.id } });
        expect(enDb!.status).toBe("PENDING");
      } finally {
        await prismaClient.incident.delete({ where: { id: incidente.id } }).catch(() => {});
        await prismaClient.maintenance.delete({ where: { id: mantenimiento.id } }).catch(() => {});
        await prismaClient.guardDiscipline.delete({ where: { id: disciplina.id } }).catch(() => {});
        await prismaClient.round.delete({ where: { id: ronda.id } }).catch(() => {});
        await prismaClient.panicAlert.delete({ where: { id: panico.id } }).catch(() => {});
      }

      const restaurado = await request(app).get("/api/v1/dashboard/pending-counts").set("user", fx.adminHeader);
      expect(restaurado.body.data).toEqual(antes.body.data);
    });

    it("un usuario cliente sólo cuenta los pendientes de su cliente", async () => {
      const admin = await request(app).get("/api/v1/dashboard/pending-counts").set("user", fx.adminHeader);
      const res = await request(app).get("/api/v1/dashboard/pending-counts").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);

      const esperado = {
        incidents: await prismaClient.incident.count({ where: { status: "PENDING", deletedAt: null, clientId: fx.clientId } }),
        maintenances: await prismaClient.maintenance.count({ where: { status: "PENDING", deletedAt: null, clientId: fx.clientId } }),
        disciplines: await prismaClient.guardDiscipline.count({ where: { status: "PENDING", deletedAt: null, clientId: fx.clientId } }),
        activeRounds: await prismaClient.round.count({ where: { status: "IN_PROGRESS", clientId: fx.clientId } }),
        panicAlerts: await prismaClient.panicAlert.count({ where: { status: "PENDING", deletedAt: null, clientId: fx.clientId } }),
      };
      expect(res.body.data).toEqual(esperado);

      // El seed tiene pendientes de otro cliente: el alcance debe ser menor.
      expect(res.body.data.incidents).toBeLessThan(admin.body.data.incidents);
      expect(res.body.data.panicAlerts).toBeLessThan(admin.body.data.panicAlerts);
    });
  });

  describe("GET /api/v1/dashboard/recent-activity", () => {
    it("debe respetar el límite solicitado", async () => {
      const dos = await request(app).get("/api/v1/dashboard/recent-activity?limit=2").set("user", fx.clientHeader);
      expect(dos.status).toBe(200);
      expect(dos.body.success).toBe(true);
      expect(dos.body.messages).toEqual(["Success"]);
      expect(dos.body.data).toHaveLength(2);
      expect(dos.body.data.map((i: { id: string }) => i.id)).toEqual([incidenteNuevoId, incidenteMedioId]);

      const uno = await request(app).get("/api/v1/dashboard/recent-activity?limit=1").set("user", fx.clientHeader);
      expect(uno.body.data).toHaveLength(1);
      expect(uno.body.data[0].id).toBe(incidenteNuevoId);

      // Un límite no numérico o 0 cae al valor por defecto (20).
      const raro = await request(app).get("/api/v1/dashboard/recent-activity?limit=abc").set("user", fx.clientHeader);
      expect(raro.status).toBe(200);
      expect(raro.body.data.length).toBeLessThanOrEqual(20);
      expect(raro.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("debe ordenar la actividad de más reciente a más antigua", async () => {
      const res = await request(app).get("/api/v1/dashboard/recent-activity?limit=50").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      // El feed mezcla incidencias, pánico, mantenimientos y disciplinas.
      expect(res.body.data).toHaveLength(7);
      expect(res.body.data.map((i: { id: string }) => i.id)).toEqual([
        incidenteNuevoId,
        incidenteMedioId,
        incidenteViejoId,
        panicNuevoId,
        panicViejoId,
        mantenimientoId,
        disciplinaId,
      ]);

      const fechas = res.body.data.map((i: { createdAt: string }) => i.createdAt);
      const ordenadas = [...fechas].sort((a: string, b: string) => b.localeCompare(a));
      expect(fechas).toEqual(ordenadas);
    });

    it("debe devolver el feed unificado con el tipo de cada registro (ADMIN)", async () => {
      const res = await request(app).get("/api/v1/dashboard/recent-activity?limit=50").set("user", fx.adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      const ids = res.body.data.map((i: { id: string }) => i.id);
      expect(ids).toContain(incidenteNuevoId);

      const mio = res.body.data.find((i: { id: string }) => i.id === incidenteNuevoId);
      expect(mio.type).toBe("incident");
      expect(mio.title).toBe("Incidencia nueva");
      expect(mio.guardId).toBe(fx.guardId);
      expect(mio.clientId).toBe(fx.clientId);
      expect(typeof mio.guardName).toBe("string");
      expect(TIPOS_ACTIVIDAD).toContain(mio.type);
    });

    it("un usuario cliente sólo ve la actividad de su cliente", async () => {
      const res = await request(app).get("/api/v1/dashboard/recent-activity?limit=50").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((i: { clientId: string }) => i.clientId === fx.clientId)).toBe(true);
    });
  });

  describe("GET /api/v1/dashboard/panic-alerts", () => {
    it("debe respetar el límite y el orden descendente para el cliente", async () => {
      const res = await request(app).get("/api/v1/dashboard/panic-alerts?limit=1").set("user", fx.clientHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.messages).toEqual(["Success"]);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(panicNuevoId);
      expect(res.body.data[0].title).toBe("Pánico nuevo");
      expect(res.body.data[0].guardId).toBe(fx.guardId);
      expect(res.body.data[0].clientId).toBe(fx.clientId);
      expect(res.body.data[0].status).toBe("PENDING");
      expect(res.body.data[0].resolvedAt).toBeNull();

      const todas = await request(app).get("/api/v1/dashboard/panic-alerts?limit=50").set("user", fx.clientHeader);
      expect(todas.body.data.map((a: { id: string }) => a.id)).toEqual([panicNuevoId, panicViejoId]);
    });

    it("no debe exponer alertas de otros clientes a un usuario cliente", async () => {
      const res = await request(app).get("/api/v1/dashboard/panic-alerts?limit=50").set("user", fx.clientHeader);

      const ids = res.body.data.map((a: { id: string }) => a.id);
      expect(ids).not.toContain(panicSinClienteId);
      expect(res.body.data.every((a: { clientId: string }) => a.clientId === fx.clientId)).toBe(true);
    });

    it("el ADMIN sí ve las alertas sin cliente asignado", async () => {
      const res = await request(app).get("/api/v1/dashboard/panic-alerts?limit=50").set("user", fx.adminHeader);

      const ids = res.body.data.map((a: { id: string }) => a.id);
      expect(ids).toContain(panicNuevoId);
      expect(ids).toContain(panicSinClienteId);

      const sinCliente = res.body.data.find((a: { id: string }) => a.id === panicSinClienteId);
      expect(sinCliente.clientId).toBeNull();
      expect(sinCliente.clientName).toBeNull();
    });
  });
});
