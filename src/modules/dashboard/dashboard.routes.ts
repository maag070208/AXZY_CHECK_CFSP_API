import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "@src/core/middlewares/validate.middleware";
import { attendanceQuerySchema } from "./schemas/dashboard.schema";

const router = Router();

router.use(authenticate);

router.get("/live", dashboardController.getLiveDashboardHandler);
router.get(
  "/attendance",
  validate(attendanceQuerySchema),
  dashboardController.getAttendanceHandler,
);
router.get("/overview", dashboardController.getOverviewHandler);
router.get("/active-guards", dashboardController.getActiveGuardsHandler);
router.get("/pending-counts", dashboardController.getPendingCountsHandler);
router.get("/recent-activity", dashboardController.getRecentActivityHandler);
router.get("/panic-alerts", dashboardController.getRecentPanicAlertsHandler);

export default router;
