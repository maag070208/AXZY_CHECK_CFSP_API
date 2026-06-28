import { Router } from "express";
import * as panicController from "./panic.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import {
  CreatePanicAlertSchema,
  PanicAlertIdParamSchema,
  PanicAlertsDataTableSchema,
  ResolvePanicAlertSchema,
} from "./panic.schema";

const router = Router();

router.use(authenticate);

router.post("/", validate(CreatePanicAlertSchema), panicController.createPanicAlert);
router.post(
  "/datatable",
  validate(PanicAlertsDataTableSchema),
  panicController.getDataTable,
);
router.get("/recent", panicController.getRecent);
router.get("/:id", validate(PanicAlertIdParamSchema), panicController.getPanicAlert);
router.put(
  "/:id/resolve",
  validate(PanicAlertIdParamSchema),
  validate(ResolvePanicAlertSchema),
  panicController.resolvePanicAlert,
);

export default router;
