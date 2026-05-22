import { validate } from "@src/core/middlewares/validate.middleware";
import { Router } from "express";
import {
  createConfiguration,
  deleteConfiguration,
  getConfigurations,
  updateConfiguration,
} from "./report-configurations.controller";
import {
  createReportConfigurationSchema,
  updateReportConfigurationSchema,
} from "./schemas/report-configuration.schema";

const router = Router();

router.post("/datatable", getConfigurations);
router.post(
  "/",
  validate(createReportConfigurationSchema),
  createConfiguration,
);
router.put(
  "/:id",
  validate(updateReportConfigurationSchema),
  updateConfiguration,
);
router.delete("/:id", deleteConfiguration);

export default router;
