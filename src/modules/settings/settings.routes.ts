import { Router } from "express";
import * as SettingsController from "./settings.controller";

import { authenticate } from "../common/middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// Incident Categories
router.post("/categories/datatable", SettingsController.getPaginatedIncidentCategories);
router.post("/categories", SettingsController.createIncidentCategory);
router.put("/categories/:id", SettingsController.updateIncidentCategory);
router.delete("/categories/:id", SettingsController.deleteIncidentCategory);

// Incident Types
router.post("/types/datatable", SettingsController.getPaginatedIncidentTypes);
router.post("/types", SettingsController.createIncidentType);
router.put("/types/:id", SettingsController.updateIncidentType);
router.delete("/types/:id", SettingsController.deleteIncidentType);

// SysConfig
router.post("/sysconfig/datatable", SettingsController.getPaginatedSysConfig);
router.post("/sysconfig", SettingsController.updateSysConfig);
router.delete("/sysconfig/:key", SettingsController.deleteSysConfig);

export default router;
