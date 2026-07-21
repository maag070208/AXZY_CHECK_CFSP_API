import { Router } from "express";
import * as maintenanceController from "./maintenance.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { 
  CreateMaintenanceSchema, 
  MaintenanceIdParamSchema, 
  GetMaintenancesQuerySchema, 
  DeleteMaintenanceMediaSchema 
} from "./maintenance.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

const router = Router();

router.post("/", authenticate, validate(CreateMaintenanceSchema), maintenanceController.createMaintenance);
router.post("/datatable", validate(DataTableFetchParamsSchema), maintenanceController.getDataTable);
router.get("/", authenticate, validate(GetMaintenancesQuerySchema), maintenanceController.getMaintenances);
router.get("/pending-count", authenticate, maintenanceController.getPendingCount);
router.put("/:id/resolve", authenticate, validate(MaintenanceIdParamSchema), maintenanceController.resolveMaintenance);
router.delete("/:id", authenticate, validate(MaintenanceIdParamSchema), maintenanceController.deleteMaintenance);
router.delete("/:id/media", authenticate, validate(DeleteMaintenanceMediaSchema), maintenanceController.deleteMedia);

export default router;
