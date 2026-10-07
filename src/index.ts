import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { env } from "@src/core/config/env.config";
import { logger } from "@src/core/utils/logger";
import { errorMiddleware } from "@src/core/middlewares/error.middleware";
import apiRouter from "@src/modules/api.router";

// Load swagger once
const swaggerDocument = YAML.load("./swagger.yaml");

export const app = express();

app.use([
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  }),
  express.json(),
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
  }),
  // NOTA sobre rate limiting: el límite estricto está en `POST /users/login`
  // (ver `core/middlewares/rate-limit.middleware.ts`), que es la única ruta
  // pública sensible a fuerza bruta. NO se aplica un límite global aquí porque
  // el panel WEB consulta varios endpoints por sesión y varios usuarios pueden
  // compartir una misma IP (NAT de oficina): un umbral bajo por IP rompería el
  // uso legítimo. Si se quiere un límite general, usar `createRateLimiter(...)`
  // con un umbral holgado y medirlo antes con tráfico real.
  morgan(env.NODE_ENV === "development" ? "dev" : "combined"),
]);

// Documentation
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/swagger.json", (req, res) => res.json(swaggerDocument));
app.get("/swagger.yaml", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  res.sendFile(path.resolve("./swagger.yaml"));
});

// Routes
app.use("/api/v1", apiRouter);

// Global Error Handler
app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info(
      `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`,
    );
    // Start scheduled notification processor
    const { startScheduledNotificationProcessor } = require("./core/cron/scheduled-notifications.cron");
    startScheduledNotificationProcessor();
  });
  server.timeout = 60000; // 1 minute timeout
}
