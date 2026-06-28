import { Router } from "express";
import * as panicController from "./panic.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import {
  CreatePanicAlertSchema,
  PanicAlertIdParamSchema,
} from "./panic.schema";

const router = Router();

router.use(authenticate);

router.post("/", validate(CreatePanicAlertSchema), panicController.createPanicAlert);
router.get("/:id", validate(PanicAlertIdParamSchema), panicController.getPanicAlert);

export default router;
