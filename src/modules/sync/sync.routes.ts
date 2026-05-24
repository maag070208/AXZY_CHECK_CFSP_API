import { Router } from "express";
import * as syncController from "./sync.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "@src/core/middlewares/validate.middleware";
import { pullSchema, pushSchema } from "./sync.schema";

const router = Router();

router.use(authenticate);

router.get("/", validate(pullSchema), syncController.pull);
router.get("/check", validate(pullSchema), syncController.checkChanges);
router.post("/", validate(pushSchema), syncController.push);

export default router;
