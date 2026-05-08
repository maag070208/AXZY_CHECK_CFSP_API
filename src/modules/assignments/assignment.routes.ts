
import { Router } from "express";
import { createAssignment, getAllAssignments, getMyAssignments, updateStatus, toggleTask, getDataTable } from "./assignment.controller";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { createAssignmentSchema } from "./schemas/assignment.schema";
import { ROLE_ADMIN, ROLE_SHIFT } from "../../core/config/constants";

const router = Router();

// Admin / Shift Guard Routes
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
  getDataTable
);
router.get(
  "/",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT]),
  getAllAssignments
);
router.get(
  "/all",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT]),
  getAllAssignments
);

// Guard Routes
router.get("/me", authenticate, getMyAssignments);

// Shared / System
router.patch("/:id/status", authenticate, updateStatus);
router.patch("/tasks/:taskId/toggle", authenticate, toggleTask);

export default router;
