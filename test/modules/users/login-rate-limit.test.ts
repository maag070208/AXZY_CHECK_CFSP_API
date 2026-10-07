import request from "supertest";
import { app } from "@src/index";
import {
  AUTH_RATE_LIMIT_MAX_REQUESTS,
} from "@src/core/config/constants";

jest.setTimeout(30000);

/**
 * Protección del login contra fuerza bruta.
 *
 * `POST /users/login` es la única ruta pública sensible: el limitador se aplica
 * por IP. Las pruebas normalmente lo saltan (`NODE_ENV=test`) para no
 * auto-bloquear la suite; aquí se fuerza con la cabecera `x-force-rate-limit`
 * para verificar el comportamiento REAL.
 */
describe("Rate limiting de POST /api/v1/users/login", () => {
  const intentoDeLogin = (forzarLimite = true) => {
    const req = request(app).post("/api/v1/users/login");
    if (forzarLimite) req.set("x-force-rate-limit", "true");
    return req.send({ username: "usuario_inexistente", password: "credencial_mala" });
  };

  it("bloquea con 429 al superar el límite de intentos", async () => {
    // Los primeros intentos llegan al controlador (401 por credenciales inválidas).
    for (let i = 0; i < AUTH_RATE_LIMIT_MAX_REQUESTS; i++) {
      const res = await intentoDeLogin();
      if (res.status === 429) {
        throw new Error(`El intento ${i + 1} se limitó antes de tiempo (límite: ${AUTH_RATE_LIMIT_MAX_REQUESTS})`);
      }
    }

    // El siguiente ya se rechaza sin llegar al controlador.
    const bloqueado = await intentoDeLogin();
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.success).toBe(false);
    expect(bloqueado.body.data).toBeNull();
    expect(bloqueado.body.messages[0]).toContain("Demasiados intentos");

    // Cabeceras estándar del limiter (útiles para el cliente).
    expect(bloqueado.headers["ratelimit"] ?? bloqueado.headers["ratelimit-limit"]).toBeDefined();
  });

  it("no limita una petición normal de la suite (NODE_ENV=test)", async () => {
    // Sin la cabecera de forzar: el limitador se salta para no romper los tests.
    const res = await intentoDeLogin(false);
    expect(res.status).not.toBe(429);
  });

  it("el límite no afecta a otras rutas de la API", async () => {
    const res = await request(app)
      .get("/api/v1/")
      .set("x-force-rate-limit", "true");
    expect(res.status).not.toBe(429);
  });
});
