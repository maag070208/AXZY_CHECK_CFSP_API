import { Router } from "express";
import * as subscriptionController from "./subscription.controller";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import { ROLE_ADMIN } from "@src/core/config/constants";

const router = Router();

router.use(authenticate);

router.get("/config", subscriptionController.getConfig);
router.put("/config", authorize([ROLE_ADMIN]), subscriptionController.updateConfig);

export default router;
