import { Router } from "express";
import * as recurringController from "./recurring.controller";
import { validate } from "@src/core/middlewares/validate.middleware";
import { createRecurringSchema, updateRecurringSchema, RecurringIdParamSchema, RecurringGuardIdParamSchema } from "./schemas/recurring.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";
import { authenticate } from "../common/middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", recurringController.getAllRecurring);
router.post("/datatable", validate(DataTableFetchParamsSchema), recurringController.getDataTable);
router.get("/:id", validate(RecurringIdParamSchema), recurringController.getRecurring);
router.get("/guard/:guardId", validate(RecurringGuardIdParamSchema), recurringController.getRecurringByGuard);
router.post("/", validate(createRecurringSchema), recurringController.postRecurring);
router.put("/:id", validate(updateRecurringSchema), recurringController.putRecurring);
router.delete("/:id", validate(RecurringIdParamSchema), recurringController.deleteRecurring);

export default router;
