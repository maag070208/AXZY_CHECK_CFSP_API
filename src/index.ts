import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import { env } from "@src/core/config/env.config";
import { logger } from "@src/core/utils/logger";
import { errorMiddleware } from "@src/core/middlewares/error.middleware";
import apiRouter from "@src/modules/api.router";

import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "@src/core/config/constants";
import rateLimit from "express-rate-limit";

// Load swagger once
const swaggerDocument = YAML.load("./swagger.yaml");

export const app = express();

const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    messages: ["Demasiadas peticiones desde esta IP, por favor intente de nuevo más tarde."],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use([
  express.json(),
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  }),
  cors(),
  limiter,
  morgan(env.NODE_ENV === "development" ? "dev" : "combined"),
]);

// Documentation
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/swagger.json", (req, res) => res.json(swaggerDocument));

// Routes
app.use("/api/v1", apiRouter);

// Global Error Handler
app.use(errorMiddleware);

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(env.PORT, "0.0.0.0", () => {
    logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
  server.timeout = 60000; // 1 minute timeout
}
