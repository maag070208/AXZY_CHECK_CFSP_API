import { Router } from "express";
import {
  addClient,
  getClients,
  putClient,
  removeClient,
  getDataTable,
  getById,
} from "./clients.controller";

import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { CreateClientSchema, UpdateClientSchema, ClientIdParamSchema } from "./schemas/clients.schema";

const router = Router();

router.use(authenticate);

router.post("/datatable", getDataTable);
router.get("/", getClients);
router.get("/:id", validate(ClientIdParamSchema), getById);
router.post("/", validate(CreateClientSchema), addClient);
router.put("/:id", validate(UpdateClientSchema), putClient);
router.delete("/:id", validate(ClientIdParamSchema), removeClient);

export default router;
