import request from "supertest";
import { app } from "@src/index";

jest.setTimeout(30000);

/**
 * `GET /api/v1/` NO pasa por `authenticate`: en `api.router.ts` el router de índice
 * se monta antes y su única ruta es `helloWorld` (sin middleware de auth). Por eso
 * este archivo no mockea el middleware de autenticación ni envía header "user".
 */
describe("Rutas de Índice (Integración)", () => {
  it("debe responder Hello World sin autenticación", async () => {
    const response = await request(app).get("/api/v1/");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messages).toEqual(["Success"]);
    expect(response.body.data).toEqual({ message: "Hello World" });
  });

  it("debe responder igual aunque se envíe header de usuario", async () => {
    const response = await request(app)
      .get("/api/v1/")
      .set("user", JSON.stringify({ id: "usuario-irrelevante", role: "ADMIN" }));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.messages).toEqual(["Success"]);
    expect(response.body.data).toEqual({ message: "Hello World" });
  });

  it("debe devolver 404 en una ruta inexistente", async () => {
    const response = await request(app).get("/api/v1/ruta-que-no-existe");

    expect(response.status).toBe(404);
  });
});
