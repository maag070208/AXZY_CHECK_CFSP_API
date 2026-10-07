import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { ATTENDANCE_STATUS } from "@src/core/config/constants";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);
jest.mock("@src/core/middlewares/token-validator.middleware", () =>
  require("../supervision.fixtures").tokenValidatorMock(),
);

jest.setTimeout(30000);

describe("Dashboard · Asistencia del día (Integración)", () => {
  let fx: ISupervisionFixture;

  beforeAll(async () => {
    fx = await createSupervisionFixture("attendance");
    await prismaClient.shiftPlan.create({
      data: { clientId: fx.clientId, scheduleId: fx.scheduleId, toleranceMinutes: 30 },
    });
  });

  afterAll(async () => {
    await prismaClient.guardLoginLog.deleteMany({ where: { userId: fx.guardId } });
    await fx.cleanup();
  });

  it("marca al guardia como ausente si no registró entrada", async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard/attendance?clientId=${fx.clientId}`)
      .set("user", fx.adminHeader);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totals.expected).toBe(1);
    expect(data.totals.absent).toBe(1);

    const item = data.items.find((i: { guardId: string }) => i.guardId === fx.guardId);
    expect(item.status).toBe(ATTENDANCE_STATUS.ABSENT);
    expect(item.checkInAt).toBeNull();
  });

  it("detecta el retardo cuando entra después de la tolerancia", async () => {
    // El horario empezó hace 2 h; entrar hace 1 h son 60 min de retardo.
    await prismaClient.guardLoginLog.create({
      data: { userId: fx.guardId, loginAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await request(app)
      .get(`/api/v1/dashboard/attendance?clientId=${fx.clientId}`)
      .set("user", fx.adminHeader);

    const item = res.body.data.items.find((i: { guardId: string }) => i.guardId === fx.guardId);
    expect(item.status).toBe(ATTENDANCE_STATUS.LATE);
    expect(item.minutesLate).toBeGreaterThan(30);
    expect(res.body.data.totals.late).toBe(1);

    await prismaClient.guardLoginLog.deleteMany({ where: { userId: fx.guardId } });
  });

  it("un usuario cliente queda limitado a su cliente", async () => {
    const res = await request(app).get("/api/v1/dashboard/attendance").set("user", fx.clientHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("CLIENT");
    expect(res.body.data.items.every((i: { clientId: string }) => i.clientId === fx.clientId)).toBe(true);
  });

  it("rechaza una fecha con formato inválido", async () => {
    const res = await request(app)
      .get("/api/v1/dashboard/attendance?date=04-10-2026")
      .set("user", fx.adminHeader);

    expect(res.status).toBe(400);
  });
});
