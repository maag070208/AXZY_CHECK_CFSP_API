import { Router } from "express";
import * as subscriptionController from "./subscription.controller";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { UpdateSubscriptionConfigSchema } from "./schemas/subscription.schema";
import { ROLE_ADMIN } from "@src/core/config/constants";

const router = Router();

router.use(authenticate);

router.get("/config", subscriptionController.getConfig);
router.put(
  "/config",
  authorize([ROLE_ADMIN]),
  validate(UpdateSubscriptionConfigSchema),
  subscriptionController.updateConfig,
);

export default router;
