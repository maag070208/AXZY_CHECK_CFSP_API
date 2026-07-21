import Router from "express";
import {
  createUser,
  getAllUsers,
  login,
  updateUserProfile,
  changePassword,
  logout,
  resetPassword,
  deleteUser,
  getDataTable,
  getUserById,
  registerFCMToken,
} from "./user.controller";

import { validate } from "@src/core/middlewares/validate.middleware";
import { 
  loginSchema, 
  createUserSchema,
  userIdParamSchema,
  updateUserSchema,
  updatePasswordSchema,
  resetPasswordSchema
} from "./user.schema";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";

import { authenticate } from "@src/modules/common/middlewares/auth.middleware";

const router = Router();

router.post("/login", validate(loginSchema), login);

router.use(authenticate);

router.post("/datatable", validate(DataTableFetchParamsSchema), getDataTable);
router.get("/", getAllUsers);
router.get("/:id", validate(userIdParamSchema), getUserById);
router.post("/", validate(createUserSchema), createUser);
router.put("/:id", validate(updateUserSchema), updateUserProfile);
router.put("/:id/password", validate(updatePasswordSchema), changePassword);
router.put("/:id/reset-password", validate(resetPasswordSchema), resetPassword);
router.post("/fcm-token", registerFCMToken);
router.post("/logout", logout);
router.delete("/:id", validate(userIdParamSchema), deleteUser);

export default router;
