import { Router } from "express";
import { createKardexEntry, getKardexEntries, getKardexDetail, updateKardexEntry, getDataTableKardexEntries, deleteKardexEntry, deleteMedia } from "./kardex.controller";
import { authenticate } from "../common/middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

router.post("/", createKardexEntry);
router.get("/", getKardexEntries);
router.get("/:id", getKardexDetail);
router.patch("/:id", updateKardexEntry);
router.delete("/:id", deleteKardexEntry);
router.delete("/:id/media", deleteMedia);
router.post("/datatable", getDataTableKardexEntries);

export default router;
