import { Router } from "express";
import * as homeController from "./home.controller";
import authenticate from "@src/core/middlewares/token-validator.middleware";

const router = Router();

router.use(authenticate);

router.get("/stats", homeController.getDashboardStats);

export default router;
