import { Router } from "express";
import * as zonesController from "./zones.controller";

const router = Router();

router.post("/datatable", zonesController.getZonesDataTable);
router.get("/client/:clientId", zonesController.getZones);
router.post("/", zonesController.addZone);
router.put("/:id", zonesController.putZone);
router.delete("/:id", zonesController.removeZone);

export default router;
