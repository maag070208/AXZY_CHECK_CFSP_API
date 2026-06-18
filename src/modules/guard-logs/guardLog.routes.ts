import { Router } from "express";
import { clockIn, clockOut, getDataTable, remove } from "./guardLog.controller";
import { authenticate, authorize } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { clockInSchema, clockOutSchema } from "./schemas/guardLog.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";
import { ROLE_ADMIN, ROLE_SHIFT, ROLE_CLIENT } from "../../core/config/constants";

const router = Router();

router.post(
  "/clock-in",
  authenticate,
  validate(clockInSchema),
  clockIn
);

router.patch(
  "/clock-out",
  authenticate,
  validate(clockOutSchema),
  clockOut
);

router.post(
  "/datatable",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT, ROLE_CLIENT]),
  validate(DataTableFetchParamsSchema),
  getDataTable
);

router.delete(
  "/:id",
  authenticate,
  authorize([ROLE_ADMIN, ROLE_SHIFT]),
  remove
);

export default router;
