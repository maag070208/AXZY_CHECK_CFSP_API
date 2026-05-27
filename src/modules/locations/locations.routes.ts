import { Router } from "express";
import * as locationsController from "./locations.controller";

import { authenticate } from '../common/middlewares/auth.middleware';
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateLocationSchema, UpdateLocationSchema, LocationIdParamSchema, PrintBulkQRSchema, GetLocationsQuerySchema } from "./schemas/locations.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

const router = Router();

router.use(authenticate);

router.post("/datatable", validate(DataTableFetchParamsSchema), locationsController.getDataTable);

router.get("/", validate(GetLocationsQuerySchema), locationsController.getLocations);
router.post("/", validate(CreateLocationSchema), locationsController.addLocation);
router.post("/print-qrs", validate(PrintBulkQRSchema), locationsController.printBulkQR);
router.put("/:id", validate(UpdateLocationSchema), locationsController.putLocation);
router.delete("/:id", validate(LocationIdParamSchema), locationsController.removeLocation);

export default router;
