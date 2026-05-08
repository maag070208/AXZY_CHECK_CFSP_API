import { Router } from "express";
import * as locationsController from "./locations.controller";

import { authenticate } from '../common/middlewares/auth.middleware';
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateLocationSchema, UpdateLocationSchema, LocationIdParamSchema } from "./schemas/locations.schema";

const router = Router();

router.use(authenticate);

router.post("/datatable", locationsController.getDataTable);

router.get("/", locationsController.getLocations);
router.post("/", validate(CreateLocationSchema), locationsController.addLocation);
router.post("/print-qrs", locationsController.printBulkQR);
router.put("/:id", validate(UpdateLocationSchema), locationsController.putLocation);
router.delete("/:id", validate(LocationIdParamSchema), locationsController.removeLocation);

export default router;
