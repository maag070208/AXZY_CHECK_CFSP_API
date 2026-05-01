import { Router } from "express";
import * as recurringController from "./recurring.controller";

const router = Router();

router.get("/", recurringController.getAllRecurring);
router.post("/datatable", recurringController.getDataTable);
router.get("/:id", recurringController.getRecurring);
router.get("/guard/:guardId", recurringController.getRecurringByGuard);
router.post("/", recurringController.postRecurring);
router.put("/:id", recurringController.putRecurring);
router.delete("/:id", recurringController.deleteRecurring);

export default router;
