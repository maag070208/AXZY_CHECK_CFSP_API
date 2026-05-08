import { Router } from "express";
import * as zonesController from "./zones.controller";

import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateZoneSchema, UpdateZoneSchema, ZoneIdParamSchema, ZoneClientIdParamSchema } from "./schemas/zones.schema";


const router = Router();

router.use(authenticate);

router.post("/datatable", zonesController.getZonesDataTable);
router.get("/client/:clientId", validate(ZoneClientIdParamSchema), zonesController.getZones);
router.post("/", validate(CreateZoneSchema), zonesController.addZone);
router.put("/:id", validate(UpdateZoneSchema), zonesController.putZone);
router.delete("/:id", validate(ZoneIdParamSchema), zonesController.removeZone);


export default router;
