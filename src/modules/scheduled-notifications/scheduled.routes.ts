import { Router } from "express";
import * as controller from "./scheduled.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateScheduledSchema, UpdateScheduledSchema, ScheduledIdParam } from "./schemas/scheduled.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

const router = Router();
router.use(authenticate);

router.post("/datatable", validate(DataTableFetchParamsSchema), controller.getDataTable);
router.get("/:id", validate(ScheduledIdParam), controller.getById);
router.post("/", validate(CreateScheduledSchema), controller.create);
router.put("/:id", validate(UpdateScheduledSchema), controller.update);
router.delete("/:id", validate(ScheduledIdParam), controller.remove);

export default router;
