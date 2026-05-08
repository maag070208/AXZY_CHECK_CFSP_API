import {
  create,
  getAll,
  remove,
  update,
  getDataTable,
  getUsers,
} from "./schedule.controller";

import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateScheduleSchema, UpdateScheduleSchema, ScheduleIdParamSchema } from "./schemas/schedule.schema";
import { Router } from "express";

const router = Router();

router.use(authenticate);

router.post("/datatable", getDataTable);

router.get("/", getAll);
router.get("/:id/users", validate(ScheduleIdParamSchema), getUsers);
router.post("/", validate(CreateScheduleSchema), create);
router.put("/:id", validate(UpdateScheduleSchema), update);
router.delete("/:id", validate(ScheduleIdParamSchema), remove);

export default router;
