import { Router } from "express";
import * as DisciplineController from "./discipline.controller";
import { authenticate } from "../common/middlewares/auth.middleware";
import { validate } from "../../core/middlewares/validate.middleware";
import { DataTableFetchParamsSchema } from "../../core/dto/datatable.schema";
import {
  createCategorySchema, updateCategorySchema, categoryIdParamSchema,
  createTypeSchema, updateTypeSchema, typeIdParamSchema,
  createDisciplineSchema, updateDisciplineSchema, resolveDisciplineSchema,
} from "./schemas/discipline.schema";

const router = Router();

router.use(authenticate);

// Categories
router.post("/categories/datatable", validate(DataTableFetchParamsSchema), DisciplineController.getPaginatedCategories);
router.post("/categories", validate(createCategorySchema), DisciplineController.createCategory);
router.put("/categories/:id", validate(updateCategorySchema), DisciplineController.updateCategory);
router.delete("/categories/:id", validate(categoryIdParamSchema), DisciplineController.deleteCategory);

// Types
router.post("/types/datatable", validate(DataTableFetchParamsSchema), DisciplineController.getPaginatedTypes);
router.post("/types", validate(createTypeSchema), DisciplineController.createType);
router.put("/types/:id", validate(updateTypeSchema), DisciplineController.updateType);
router.delete("/types/:id", validate(typeIdParamSchema), DisciplineController.deleteType);

// Discipline Records
router.post("/datatable", validate(DataTableFetchParamsSchema), DisciplineController.getPaginatedDisciplines);
router.post("/", validate(createDisciplineSchema), DisciplineController.createDiscipline);
router.put("/:id/resolve", validate(resolveDisciplineSchema), DisciplineController.resolveDiscipline);
router.delete("/:id", DisciplineController.removeDiscipline);

export default router;
