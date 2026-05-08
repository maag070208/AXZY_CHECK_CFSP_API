import { Router } from "express";
import * as incidentController from "./incident.controller";
import { authenticate } from "../common/middlewares/auth.middleware";

import { validate } from "../../core/middlewares/validate.middleware";
import { CreateIncidentSchema, IncidentIdParamSchema } from "./incident.schema";

const router = Router();

router.use(authenticate);

router.post("/", validate(CreateIncidentSchema), incidentController.createIncident);
router.post("/datatable", incidentController.getDataTable);
router.get("/", incidentController.getIncidents);
router.get("/pending-count", incidentController.getPendingCount);
router.put("/:id/resolve", validate(IncidentIdParamSchema), incidentController.resolveIncident);
router.delete("/:id", validate(IncidentIdParamSchema), incidentController.deleteIncident);
router.delete("/:id/media", validate(IncidentIdParamSchema), incidentController.deleteMedia);

export default router;
