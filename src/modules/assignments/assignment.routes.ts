
import { Router } from "express";
import { createAssignment, getAllAssignments, getMyAssignments, updateStatus, toggleTask, getDataTable } from "./assignment.controller";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { 
  createAssignmentSchema, 
  UpdateAssignmentStatusSchema, 
  ToggleTaskSchema, 
  GetAllAssignmentsQuerySchema, 
  GetMyAssignmentsQuerySchema 
} from "./schemas/assignment.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";
import { ROLE_ADMIN, ROLE_SHIFT, ROLE_CLIENT } from "../../core/config/constants";

const router = Router();

// Admin / Shift Guard / Client Routes
router.post(
  "/",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT]),
  validate(createAssignmentSchema),
  createAssignment
);
router.post(
  "/datatable",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT]),
  validate(DataTableFetchParamsSchema),
  getDataTable
);
router.get(
  "/",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT, ROLE_CLIENT]),
  validate(GetAllAssignmentsQuerySchema),
  getAllAssignments
);
router.get(
  "/all",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT, ROLE_CLIENT]),
  validate(GetAllAssignmentsQuerySchema),
  getAllAssignments
);

// Guard Routes
router.get("/me", authenticate, validate(GetMyAssignmentsQuerySchema), getMyAssignments);

// Shared / System
router.patch("/:id/status", authenticate, validate(UpdateAssignmentStatusSchema), updateStatus);
router.patch("/tasks/:taskId/toggle", authenticate, validate(ToggleTaskSchema), toggleTask);

export default router;
