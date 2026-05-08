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
} from "./user.controller";

import { validate } from "@src/core/middlewares/validate.middleware";
import { loginSchema, createUserSchema } from "./user.schema";

import { authenticate } from "@src/modules/common/middlewares/auth.middleware";

const router = Router();

router.post("/login", validate(loginSchema), login);

router.use(authenticate);

router.post("/datatable", getDataTable);
router.get("/", getAllUsers);
router.get("/:id", getUserById);
router.post("/", validate(createUserSchema), createUser);
router.put("/:id", updateUserProfile);
router.put("/:id/password", changePassword);
router.put("/:id/reset-password", resetPassword);
router.post("/logout", logout);
router.delete("/:id", deleteUser);

export default router;
