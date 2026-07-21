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
  DeleteReportConfigurationSchema,
} from "./schemas/report-configuration.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

const router = Router();

router.post("/datatable", validate(DataTableFetchParamsSchema), getConfigurations);
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
router.delete("/:id", validate(DeleteReportConfigurationSchema), deleteConfiguration);

export default router;
