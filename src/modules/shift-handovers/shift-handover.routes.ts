import { Router } from "express";
import {
  PLANNING_ADMIN_ROLES,
  SUPERVISION_READ_ROLES,
  SUPERVISION_ROLES,
} from "@src/core/config/constants";
import { DataTableFetchParamsSchema } from "@src/core/dto/datatable.schema";
import { validate } from "@src/core/middlewares/validate.middleware";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import * as ShiftHandoverController from "./shift-handover.controller";
import { createShiftHandoverSchema, shiftHandoverIdParamSchema } from "./schemas/shift-handover.schema";

const router = Router();

router.use(authenticate);

router.get("/catalog", authorize(SUPERVISION_READ_ROLES), ShiftHandoverController.getCatalog);
router.post("/datatable", authorize(SUPERVISION_READ_ROLES), validate(DataTableFetchParamsSchema), ShiftHandoverController.getDataTable);
router.post("/", authorize(SUPERVISION_ROLES), validate(createShiftHandoverSchema), ShiftHandoverController.createShiftHandover);
router.get("/:id", authorize(SUPERVISION_READ_ROLES), validate(shiftHandoverIdParamSchema), ShiftHandoverController.getById);
router.delete("/:id", authorize(PLANNING_ADMIN_ROLES), validate(shiftHandoverIdParamSchema), ShiftHandoverController.deleteShiftHandover);

export default router;
