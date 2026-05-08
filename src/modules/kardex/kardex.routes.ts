import { Router } from "express";
import { createKardexEntry, getKardexEntries, getKardexDetail, updateKardexEntry, getDataTableKardexEntries, deleteKardexEntry, deleteMedia } from "./kardex.controller";
import { authenticate } from "../common/middlewares/auth.middleware";

import { validate } from "../../core/middlewares/validate.middleware";
import { CreateKardexSchema, UpdateKardexSchema, KardexIdParamSchema } from "./kardex.schema";

const router = Router();

router.use(authenticate);

router.post("/", validate(CreateKardexSchema), createKardexEntry);
router.get("/", getKardexEntries);
router.get("/:id", validate(KardexIdParamSchema), getKardexDetail);
router.patch("/:id", validate(UpdateKardexSchema), updateKardexEntry);
router.delete("/:id", validate(KardexIdParamSchema), deleteKardexEntry);
router.delete("/:id/media", validate(KardexIdParamSchema), deleteMedia);
router.post("/datatable", getDataTableKardexEntries);

export default router;
