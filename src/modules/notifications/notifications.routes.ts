import { Router } from "express";
import { sendNotification } from "./notifications.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { SendNotificationSchema } from "./schemas/notification.schema";

const router = Router();

router.post(
  "/send",
  authenticate,
  validate(SendNotificationSchema),
  sendNotification
);

export default router;
