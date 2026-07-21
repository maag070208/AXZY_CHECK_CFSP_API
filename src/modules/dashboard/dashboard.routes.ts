import { Router } from "express";
import * as dashboardController from "./dashboard.controller";
import authenticate from "@src/core/middlewares/token-validator.middleware";

const router = Router();

router.use(authenticate);

router.get("/overview", dashboardController.getOverviewHandler);
router.get("/active-guards", dashboardController.getActiveGuardsHandler);
router.get("/pending-counts", dashboardController.getPendingCountsHandler);
router.get("/recent-activity", dashboardController.getRecentActivityHandler);
router.get("/panic-alerts", dashboardController.getRecentPanicAlertsHandler);

export default router;
