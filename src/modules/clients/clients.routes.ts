import { Router } from "express";
import { addClient, getClients, putClient, removeClient, getDataTable } from "./clients.controller";

const router = Router();

router.post("/datatable", getDataTable);
router.get("/", getClients);
router.post("/", addClient);
router.put("/:id", putClient);
router.delete("/:id", removeClient);

export default router;
