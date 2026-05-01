import { Router } from "express";
import * as locationsController from "./locations.controller";

const router = Router();

router.post("/datatable", locationsController.getDataTable);

router.get("/", locationsController.getLocations);
router.post("/", locationsController.addLocation);
router.post("/print-qrs", locationsController.printBulkQR);
router.put("/:id", locationsController.putLocation);
router.delete("/:id", locationsController.removeLocation);

export default router;
