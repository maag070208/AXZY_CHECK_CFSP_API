import { Router } from "express";
import * as syncController from "./sync.controller";

const router = Router();

router.get("/", syncController.pull);
router.post("/", syncController.push);

export default router;
