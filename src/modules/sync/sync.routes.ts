import { Router } from "express";
import * as syncController from "./sync.controller";

import { authenticate } from "../common/middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", syncController.pull);
router.post("/", syncController.push);

export default router;
