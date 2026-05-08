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

// Load swagger once
const swaggerDocument = YAML.load("./swagger.yaml");

export const app = express();

app.use([
  express.json(),
  helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }),
  cors(),
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
