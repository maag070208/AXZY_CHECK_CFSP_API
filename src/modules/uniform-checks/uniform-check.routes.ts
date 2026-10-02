import { Router } from "express";
import {
  PLANNING_ADMIN_ROLES,
  SUPERVISION_READ_ROLES,
  SUPERVISION_ROLES,
} from "@src/core/config/constants";
import { DataTableFetchParamsSchema } from "@src/core/dto/datatable.schema";
import { validate } from "@src/core/middlewares/validate.middleware";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import * as UniformCheckController from "./uniform-check.controller";
import { createUniformCheckSchema, uniformCheckIdParamSchema } from "./schemas/uniform-check.schema";

const router = Router();

router.use(authenticate);

router.get("/catalog", authorize(SUPERVISION_READ_ROLES), UniformCheckController.getCatalog);
router.post("/datatable", authorize(SUPERVISION_READ_ROLES), validate(DataTableFetchParamsSchema), UniformCheckController.getDataTable);
router.post("/", authorize(SUPERVISION_ROLES), validate(createUniformCheckSchema), UniformCheckController.createUniformCheck);
router.get("/:id", authorize(SUPERVISION_READ_ROLES), validate(uniformCheckIdParamSchema), UniformCheckController.getById);
router.delete("/:id", authorize(PLANNING_ADMIN_ROLES), validate(uniformCheckIdParamSchema), UniformCheckController.deleteUniformCheck);

export default router;
