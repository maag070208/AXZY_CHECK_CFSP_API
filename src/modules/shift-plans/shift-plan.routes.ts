import { Router } from "express";
import { PLANNING_ADMIN_ROLES, SUPERVISION_READ_ROLES } from "@src/core/config/constants";
import { validate } from "@src/core/middlewares/validate.middleware";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import * as ShiftPlanController from "./shift-plan.controller";
import {
  agendaQuerySchema,
  createShiftPlanSchema,
  listShiftPlansSchema,
  shiftPlanIdParamSchema,
  updateShiftPlanSchema,
} from "./schemas/shift-plan.schema";

const router = Router();

router.use(authenticate);

router.get("/agenda", authorize(SUPERVISION_READ_ROLES), validate(agendaQuerySchema), ShiftPlanController.getAgenda);
router.get("/agenda/current", authorize(SUPERVISION_READ_ROLES), validate(agendaQuerySchema), ShiftPlanController.getCurrentAgenda);

router.get("/", authorize(SUPERVISION_READ_ROLES), validate(listShiftPlansSchema), ShiftPlanController.listShiftPlans);
router.post("/", authorize(PLANNING_ADMIN_ROLES), validate(createShiftPlanSchema), ShiftPlanController.createShiftPlan);
router.put("/:id", authorize(PLANNING_ADMIN_ROLES), validate(updateShiftPlanSchema), ShiftPlanController.updateShiftPlan);
router.delete("/:id", authorize(PLANNING_ADMIN_ROLES), validate(shiftPlanIdParamSchema), ShiftPlanController.deleteShiftPlan);

export default router;
