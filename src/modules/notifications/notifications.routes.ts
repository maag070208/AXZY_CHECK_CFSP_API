import { Router } from "express";
import { sendNotification } from "./notifications.controller";
import { getMyNotifications, markAsRead, markAllAsRead } from "./notification-log.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { SendNotificationSchema } from "./schemas/notification.schema";

const router = Router();
router.use(authenticate);

router.post("/send", validate(SendNotificationSchema), sendNotification);

router.get("/my", getMyNotifications);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);

export default router;
