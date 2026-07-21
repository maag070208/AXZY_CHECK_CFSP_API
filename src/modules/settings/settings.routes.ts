import { Router } from "express";
import * as SettingsController from "./settings.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { 
  CreateIncidentCategorySchema, 
  UpdateIncidentCategorySchema, 
  CategoryIdParamSchema, 
  CreateIncidentTypeSchema, 
  UpdateIncidentTypeSchema, 
  TypeIdParamSchema, 
  UpdateSysConfigSchema, 
  SysConfigKeyParamSchema 
} from "./settings.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

const router = Router();

router.use(authenticate);

// Incident Categories
router.post("/categories/datatable", validate(DataTableFetchParamsSchema), SettingsController.getPaginatedIncidentCategories);
router.post("/categories", validate(CreateIncidentCategorySchema), SettingsController.createIncidentCategory);
router.put("/categories/:id", validate(UpdateIncidentCategorySchema), SettingsController.updateIncidentCategory);
router.delete("/categories/:id", validate(CategoryIdParamSchema), SettingsController.deleteIncidentCategory);

// Incident Types
router.post("/types/datatable", validate(DataTableFetchParamsSchema), SettingsController.getPaginatedIncidentTypes);
router.post("/types", validate(CreateIncidentTypeSchema), SettingsController.createIncidentType);
router.put("/types/:id", validate(UpdateIncidentTypeSchema), SettingsController.updateIncidentType);
router.delete("/types/:id", validate(TypeIdParamSchema), SettingsController.deleteIncidentType);

// SysConfig
router.post("/sysconfig/datatable", validate(DataTableFetchParamsSchema), SettingsController.getPaginatedSysConfig);
router.post("/sysconfig", validate(UpdateSysConfigSchema), SettingsController.updateSysConfig);
router.delete("/sysconfig/:key", validate(SysConfigKeyParamSchema), SettingsController.deleteSysConfig);

export default router;
