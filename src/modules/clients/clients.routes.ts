import { Router } from "express";
import {
  addClient,
  getClients,
  putClient,
  removeClient,
  getDataTable,
  getById,
} from "./clients.controller";

const router = Router();

router.post("/datatable", getDataTable);
router.get("/", getClients);
router.get("/:id", getById);
router.post("/", addClient);
router.put("/:id", putClient);
router.delete("/:id", removeClient);

export default router;
