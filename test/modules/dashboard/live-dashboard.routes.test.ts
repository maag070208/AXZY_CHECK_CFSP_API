import request from "supertest";
import { app } from "@src/index";
import { prismaClient } from "@src/core/config/database";
import { createSupervisionFixture, ISupervisionFixture } from "../supervision.fixtures";

jest.mock("@src/modules/common/middlewares/auth.middleware", () =>
  require("../supervision.fixtures").authMiddlewareMock(),
);
jest.mock("@src/core/middlewares/token-validator.middleware", () =>
  require("../supervision.fixtures").tokenValidatorMock(),
);

jest.setTimeout(30000);

describe("Dashboard en vivo (Integración)", () => {
  let fx: ISupervisionFixture;

  beforeAll(async () => {
    fx = await createSupervisionFixture("dashboard");
    await prismaClient.shiftPlan.create({ data: { clientId: fx.clientId, scheduleId: fx.scheduleId } });
  });

  afterAll(async () => {
    await fx.cleanup();
  });

  it("debe devolver KPIs, alertas y cumplimiento del cliente", async () => {
    const res = await request(app).get(`/api/v1/dashboard/live?clientId=${fx.clientId}`).set("user", fx.adminHeader);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.scope).toBe("ALL");
    expect(data.kpis.handoverCompliance).toBe(0);
    expect(data.kpis.uniformCompliance).toBe(0);
    const types = data.alerts.map((a: { type: string }) => a.type);
    expect(types).toContain("HANDOVER_OVERDUE");
    expect(types).toContain("UNIFORM_OVERDUE");
    expect(data.compliance.pending.length).toBeGreaterThanOrEqual(2);
  });

  it("un usuario cliente siempre queda limitado a su cliente", async () => {
    const res = await request(app).get("/api/v1/dashboard/live").set("user", fx.clientHeader);
    expect(res.status).toBe(200);
    expect(res.body.data.scope).toBe("CLIENT");
    expect(
      res.body.data.alerts.every((a: { clientName: string | null }) => a.clientName === null || a.clientName.startsWith("Cliente Supervisión dashboard")),
    ).toBe(true);
  });
});
