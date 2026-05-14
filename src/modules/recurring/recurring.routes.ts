import { Router } from "express";
import * as recurringController from "./recurring.controller";
import { validate } from "@src/core/middlewares/validate.middleware";
import { createRecurringSchema, updateRecurringSchema } from "./schemas/recurring.schema";
import { authenticate } from "../common/middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/", recurringController.getAllRecurring);
router.post("/datatable", recurringController.getDataTable);
router.get("/:id", recurringController.getRecurring);
router.get("/guard/:guardId", recurringController.getRecurringByGuard);
router.post("/", validate(createRecurringSchema), recurringController.postRecurring);
router.put("/:id", validate(updateRecurringSchema), recurringController.putRecurring);
router.delete("/:id", recurringController.deleteRecurring);

export default router;
