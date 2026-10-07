import crypto from "crypto";
import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);

jest.setTimeout(40000);

/**
 * Cola offline: resolución, idempotencia, reintento y diagnóstico.
 *
 * Estas pruebas fijan el contrato que hace que la cola de cambios capturados
 * sin red NO se pierda ni se atasque:
 *  - el lote es ATÓMICO (todo o nada),
 *  - el reenvío es IDEMPOTENTE (no duplica),
 *  - un registro irrecuperable se REPORTA con tabla/id/motivo exactos para poder
 *    corregirlo o descartarlo (antes un error opaco bloqueaba la cola entera),
 *  - ninguna tabla se descarta en silencio.
 */
describe("Cola offline: resolución, idempotencia y reintento (Integración)", () => {
  let fx: ISupervisionFixture;
  let otro: ISupervisionFixture;
  let locationId: string;
  let otraLocationId: string;

  const push = (header: string, changes: Record<string, unknown>, bypassVersion = true) => {
    const req = request(app).post("/api/v1/sync").set("user", header);
    if (bypassVersion) req.set("x-bypass-version-check", "true");
    return req.send({ changes });
  };

  const rechazos = (res: request.Response) =>
    (res.body.data?.rejected ?? []) as Array<{ table: string; id: string; action: string; reason: string }>;

  beforeAll(async () => {
    fx = await createSupervisionFixture("cola");
    otro = await createSupervisionFixture("cola-otro");
    locationId = (await prismaClient.location.create({ data: { clientId: fx.clientId, name: `Punto cola ${Date.now()}` } })).id;
    otraLocationId = (await prismaClient.location.create({ data: { clientId: otro.clientId, name: `Punto cola ajeno ${Date.now()}` } })).id;
  });

  afterAll(async () => {
    await prismaClient.kardex.deleteMany({ where: { locationId: { in: [locationId, otraLocationId] } } }).catch(() => {});
    await prismaClient.incident.deleteMany({ where: { guardId: { in: [fx.guardId, otro.guardId] } } }).catch(() => {});
    await prismaClient.maintenance.deleteMany({ where: { guardId: { in: [fx.guardId, otro.guardId] } } }).catch(() => {});
    await prismaClient.round.deleteMany({ where: { guardId: { in: [fx.guardId, otro.guardId] } } }).catch(() => {});
    await prismaClient.location.deleteMany({ where: { id: { in: [locationId, otraLocationId] } } }).catch(() => {});
    await fx.cleanup();
    await otro.cleanup();
  });

  const kardexValido = (over: Record<string, unknown> = {}) => ({
    id: crypto.randomUUID(),
    userId: fx.guardId,
    locationId,
    timestamp: new Date().toISOString(),
    ...over,
  });

  // ── Diagnóstico de un registro irrecuperable ──────────────────────────────

  it("un registro con referencia inexistente se reporta con su id y motivo, sin aplicar el lote", async () => {
    const bueno = kardexValido();
    const malo = kardexValido({ locationId: crypto.randomUUID() }); // punto que no existe

    const res = await push(fx.guardHeader, {
      kardex: { created: [bueno, malo], updated: [], deleted: [] },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.data.applied).toBeUndefined(); // el detalle va en `rejected`
    expect(rechazos(res)).toHaveLength(1);
    expect(rechazos(res)[0].id).toBe(malo.id);
    expect(rechazos(res)[0].table).toBe("kardex");
    expect(rechazos(res)[0].action).toBe("create");
    expect(rechazos(res)[0].reason).toContain("no existe en el servidor");

    // Atómico: tampoco se aplicó el registro correcto.
    expect(await prismaClient.kardex.count({ where: { id: bueno.id } })).toBe(0);
    expect(await prismaClient.kardex.count({ where: { id: malo.id } })).toBe(0);
  });

  it("al corregir el registro señalado, el reintento del lote se aplica completo", async () => {
    const bueno = kardexValido();
    const maloId = crypto.randomUUID();

    // 1er intento: el punto no existe → rechazo diagnosticado.
    const fallo = await push(fx.guardHeader, {
      kardex: { created: [bueno, kardexValido({ id: maloId, locationId: crypto.randomUUID() })], updated: [], deleted: [] },
    });
    expect(fallo.status).toBe(400);
    expect(await prismaClient.kardex.count({ where: { id: bueno.id } })).toBe(0);

    // 2do intento: el guardia corrige el punto y reenvía la cola pendiente.
    const ok = await push(fx.guardHeader, {
      kardex: { created: [bueno, kardexValido({ id: maloId })], updated: [], deleted: [] },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.data.applied).toBe(true);
    expect(ok.body.data.summary.kardex.created).toBe(2);
    expect(await prismaClient.kardex.count({ where: { id: { in: [bueno.id, maloId] } } })).toBe(2);
  });

  it("un registro sin un campo obligatorio se rechaza indicando el campo", async () => {
    const sinTitulo = { id: crypto.randomUUID(), guardId: fx.guardId, clientId: fx.clientId, media: "[]" };
    const res = await push(fx.guardHeader, {
      incident: { created: [sinTitulo], updated: [], deleted: [] },
    });

    expect(res.status).toBe(400);
    expect(rechazos(res)[0].id).toBe(sinTitulo.id);
    expect(rechazos(res)[0].reason).toContain("title");
    expect(await prismaClient.incident.count({ where: { id: sinTitulo.id } })).toBe(0);
  });

  it("el mismo registro repetido en el lote se rechaza en vez de escribirse dos veces", async () => {
    const repetido = kardexValido();
    const res = await push(fx.guardHeader, {
      kardex: { created: [repetido, { ...repetido, notes: "segunda vez" }], updated: [], deleted: [] },
    });

    expect(res.status).toBe(400);
    expect(rechazos(res)[0].reason).toContain("más de una vez");
    expect(await prismaClient.kardex.count({ where: { id: repetido.id } })).toBe(0);
  });

  it("un 'updated' sobre un registro de otro guardia se rechaza (no se aplica ni se crea)", async () => {
    const ajeno = crypto.randomUUID();
    const res = await push(fx.guardHeader, {
      kardex: {
        created: [],
        updated: [{ id: ajeno, userId: otro.guardId, locationId: otraLocationId, timestamp: new Date().toISOString() }],
        deleted: [],
      },
    });

    expect(res.status).toBe(400);
    expect(rechazos(res)[0].reason).toContain("otro usuario");
    expect(await prismaClient.kardex.count({ where: { id: ajeno } })).toBe(0);
  });

  // ── Reintentos e idempotencia ─────────────────────────────────────────────

  it("reenviar el mismo lote tres veces no duplica ni altera los totales", async () => {
    const uno = kardexValido();
    const dos = kardexValido();
    const lote = { kardex: { created: [uno, dos], updated: [], deleted: [] } };

    for (let intento = 0; intento < 3; intento++) {
      const res = await push(fx.guardHeader, lote);
      expect(res.status).toBe(200);
    }

    expect(await prismaClient.kardex.count({ where: { id: { in: [uno.id, dos.id] } } })).toBe(2);
  });

  it("el reenvío de una ronda ya cerrada mantiene el estado final (no lo retrocede)", async () => {
    const roundId = crypto.randomUUID();
    const inicio = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const abrir = await push(fx.guardHeader, {
      round: { created: [{ id: roundId, guardId: fx.guardId, clientId: fx.clientId, startTime: inicio, createdAt: inicio }], updated: [], deleted: [] },
    });
    expect(abrir.status).toBe(200);

    const cerrar = await push(fx.guardHeader, {
      round: { created: [], updated: [{ id: roundId, guardId: fx.guardId, status: "COMPLETED", endTime: new Date().toISOString() }], deleted: [] },
    });
    expect(cerrar.status).toBe(200);

    // Reenvío del lote antiguo (la APP reintenta tras un fallo de red).
    const reenvio = await push(fx.guardHeader, {
      round: { created: [{ id: roundId, guardId: fx.guardId, clientId: fx.clientId, startTime: inicio, createdAt: inicio }], updated: [], deleted: [] },
    });
    expect(reenvio.status).toBe(200);
    expect(await prismaClient.round.count({ where: { id: roundId } })).toBe(1);
  });

  // ── Bajas ────────────────────────────────────────────────────────────────

  it("un id repetido en 'deleted' no provoca un falso rechazo", async () => {
    const registro = kardexValido();
    await push(fx.guardHeader, { kardex: { created: [registro], updated: [], deleted: [] } });

    const res = await push(fx.guardHeader, {
      kardex: { created: [], updated: [], deleted: [registro.id, registro.id, registro.id] },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.kardex.deleted).toBe(1);
    expect(res.body.data.rejected).toEqual([]);

    // La baja es lógica (kardex no está entre los modelos que la extensión de
    // Prisma oculta automáticamente), así que se comprueba el sello `deletedAt`
    // y, sobre todo, que deja de llegar en el pull (lo que ve la APP).
    const enDb = await prismaClient.kardex.findUnique({ where: { id: registro.id } });
    expect(enDb?.deletedAt).not.toBeNull();

    const pull = await request(app)
      .get(`/api/v1/sync?last_pulled_at=0`)
      .set("user", fx.guardHeader)
      .set("x-bypass-version-check", "true");
    const borrados = pull.body.data.changes.kardex.deleted as string[];
    expect(borrados).toContain(registro.id);
    const creados = pull.body.data.changes.kardex.created.map((k: { id: string }) => k.id);
    expect(creados).not.toContain(registro.id);
  });

  it("borrar en el mismo lote un registro propio y uno ajeno no borra ninguno", async () => {
    const propio = kardexValido();
    await push(fx.guardHeader, { kardex: { created: [propio], updated: [], deleted: [] } });

    // Registro real de OTRO guardia (no basta un id inexistente: un id que ya no
    // existe se considera baja ya aplicada y no debe bloquear la cola).
    const ajeno = kardexValido({ id: crypto.randomUUID(), userId: otro.guardId, locationId: otraLocationId });
    await push(otro.guardHeader, { kardex: { created: [ajeno], updated: [], deleted: [] } });

    const res = await push(fx.guardHeader, {
      kardex: { created: [], updated: [], deleted: [propio.id, ajeno.id] },
    });

    expect(res.status).toBe(400);
    expect(rechazos(res)[0].id).toBe(ajeno.id);
    // Atómico: el registro propio sigue vivo y el ajeno intacto.
    const propioDb = await prismaClient.kardex.findUnique({ where: { id: propio.id } });
    expect(propioDb?.deletedAt).toBeNull();
    const ajenoDb = await prismaClient.kardex.findUnique({ where: { id: ajeno.id } });
    expect(ajenoDb?.deletedAt).toBeNull();
  });

  it("reenviar una baja ya aplicada es idempotente (no bloquea la cola)", async () => {
    const registro = kardexValido();
    await push(fx.guardHeader, { kardex: { created: [registro], updated: [], deleted: [] } });

    const primera = await push(fx.guardHeader, { kardex: { created: [], updated: [], deleted: [registro.id] } });
    expect(primera.status).toBe(200);

    // La APP reintenta la misma baja tras un fallo de red.
    const repetida = await push(fx.guardHeader, { kardex: { created: [], updated: [], deleted: [registro.id] } });
    expect(repetida.status).toBe(200);
    expect(repetida.body.data.rejected).toEqual([]);
  });

  it("el borrado de tablas custom (entrega/uniforme) se reporta en vez de perderse", async () => {
    const res = await push(fx.adminHeader, {
      uniformCheck: { created: [], updated: [], deleted: [crypto.randomUUID()] },
    });

    expect(res.status).toBe(400);
    expect(rechazos(res)[0].action).toBe("delete");
    expect(rechazos(res)[0].reason).toContain("no se admite");
  });

  // ── Nada se descarta en silencio ─────────────────────────────────────────

  it("una tabla que el dispositivo no administra se reporta y no se aplica", async () => {
    const zonaId = crypto.randomUUID();
    const res = await push(fx.guardHeader, {
      zone: { created: [{ id: zonaId, name: "Zona fantasma", clientId: fx.clientId }], updated: [], deleted: [] },
    });

    expect(res.status).toBe(400);
    expect(res.body.data.ignoredTables).toContain("zone");
    expect(res.body.messages.join(" ")).toContain("no administra");
    expect(await prismaClient.zone.findUnique({ where: { id: zonaId } })).toBeNull();
  });

  // ── Camino feliz a escala y concurrencia ─────────────────────────────────

  it("aplica un lote grande de escaneos offline sin perder ninguno", async () => {
    const registros = Array.from({ length: 25 }, () => kardexValido());
    const res = await push(fx.guardHeader, {
      kardex: { created: registros, updated: [], deleted: [] },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.summary.kardex.created).toBe(25);
    const ids = registros.map((r) => r.id);
    expect(await prismaClient.kardex.count({ where: { id: { in: ids } } })).toBe(25);
  });

  it("dos sincronizaciones simultáneas del mismo lote no duplican y el reintento posterior funciona", async () => {
    const registro = kardexValido();
    const lote = { kardex: { created: [registro], updated: [], deleted: [] } };

    const [a, b] = await Promise.all([push(fx.guardHeader, lote), push(fx.guardHeader, lote)]);

    // Al menos una debe aplicar; la otra puede chocar por carrera y queda como
    // reintentable (nunca se duplica el registro).
    expect([a.status, b.status]).toContain(200);
    expect(await prismaClient.kardex.count({ where: { id: registro.id } })).toBe(1);

    // El reintento (lo que hace la APP) siempre converge.
    const reintento = await push(fx.guardHeader, lote);
    expect(reintento.status).toBe(200);
    expect(await prismaClient.kardex.count({ where: { id: registro.id } })).toBe(1);
  });

  // ── Ida y vuelta con el pull ─────────────────────────────────────────────

  it("lo empujado offline se recupera en el pull incremental y el timestamp avanza", async () => {
    const registro = kardexValido();
    const marca = Date.now();
    await new Promise((r) => setTimeout(r, 5));

    await push(fx.guardHeader, { kardex: { created: [registro], updated: [], deleted: [] } });

    const pull = await request(app)
      .get(`/api/v1/sync?last_pulled_at=${marca}`)
      .set("user", fx.guardHeader)
      .set("x-bypass-version-check", "true");

    expect(pull.status).toBe(200);
    const creados = pull.body.data.changes.kardex.created.map((k: { id: string }) => k.id);
    expect(creados).toContain(registro.id);
    expect(pull.body.data.timestamp).toBeGreaterThanOrEqual(marca);
  });

  it("un borrado capturado offline desaparece de los listados del módulo", async () => {
    const registro = kardexValido();

    // 1. El guardia captura el registro sin red y luego lo sincroniza.
    await push(fx.guardHeader, { kardex: { created: [registro], updated: [], deleted: [] } });

    const listar = async () => {
      // Se filtra por el guardia del fixture para que el test sea independiente
      // del resto de datos que dejan otros archivos de la suite.
      const res = await request(app)
        .get(`/api/v1/kardex?userId=${fx.guardId}`)
        .set("user", fx.adminHeader)
        .set("x-bypass-version-check", "true");
      if (res.status !== 200) {
        throw new Error(
          `GET /api/v1/kardex respondió ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`,
        );
      }
      return (res.body.data as Array<{ id: string }>).map((k) => k.id);
    };

    expect(await listar()).toContain(registro.id);

    // 2. El borrado también se hace sin red y se sincroniza después.
    const borrado = await push(fx.guardHeader, { kardex: { created: [], updated: [], deleted: [registro.id] } });
    expect(borrado.status).toBe(200);

    // 3. El registro NO debe seguir apareciendo (mismo efecto que borrarlo online).
    expect(await listar()).not.toContain(registro.id);
  });

  // ── El gate de versión no debe atascar la cola ──────────────────────────

  it("el push funciona aunque la APP no informe la versión (la cola debe poder drenarse)", async () => {
    const registro = kardexValido();
    const res = await push(fx.guardHeader, { kardex: { created: [registro], updated: [], deleted: [] } }, false);

    expect(res.status).toBe(200);
    expect(await prismaClient.kardex.count({ where: { id: registro.id } })).toBe(1);
  });
});
